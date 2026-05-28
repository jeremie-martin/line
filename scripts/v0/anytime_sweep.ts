import { scoreDriftReport } from "./score.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { compile } from "./compile.ts";

type BudgetRow = {
  budget_units: number;
  work_units_used: number;
  budget_exhausted: boolean;
  leaves_scored: number;
  prefix_ok: boolean;
  score: number;
  passed: boolean;
  axis_quality: number;
  monotone_score_ok: boolean;
  monotone_axis_quality_ok: boolean;
};

type CaseRow = {
  name: GoldenSpecName;
  seed: number;
  floor_units: number;
  ok: boolean;
  budgets: BudgetRow[];
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseSeeds(): number[] {
  const raw = arg("seeds");
  if (raw === null) return [0];
  const seeds = raw.split(",").map((part) => Number(part.trim()));
  if (seeds.some((seed) => !Number.isInteger(seed))) {
    throw new Error(`--seeds must be comma-separated integers, got ${raw}`);
  }
  return seeds;
}

function parseLimit(): number {
  const raw = arg("limit");
  if (raw === null) return GOLDEN_SPECS.length;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--limit must be a positive integer, got ${raw}`);
  }
  return value;
}

function parseFactors(): number[] {
  const raw = arg("factors");
  if (raw === null) return [1, 1.25, 1.5];
  const factors = raw.split(",").map((part) => Number(part.trim()));
  if (factors.some((factor) => !Number.isFinite(factor) || factor <= 0)) {
    throw new Error(`--factors must be comma-separated positive numbers, got ${raw}`);
  }
  return factors;
}

function prefixOk(prev: string[], next: string[]): boolean {
  if (prev.length > next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

async function runCase(name: GoldenSpecName, seed: number, factors: number[]): Promise<CaseRow> {
  const spec = await loadGoldenSpec(name, "base");
  const floor = compile(spec, {
    seed,
    strategy: "lds",
    budget: { kind: "work", units: 1 },
  });
  const floorUnits = Math.max(1, floor.stats.subfloor_fallback_units);

  let previousFingerprints = floor.stats.scored_leaf_fingerprints;
  let previousScore = scoreDriftReport(floor.report);
  const rows: BudgetRow[] = [{
    budget_units: 1,
    work_units_used: floor.stats.work_units_used,
    budget_exhausted: floor.stats.budget_exhausted,
    leaves_scored: floor.stats.leaves_scored,
    prefix_ok: true,
    score: previousScore.score,
    passed: previousScore.passed,
    axis_quality: previousScore.axis_quality,
    monotone_score_ok: true,
    monotone_axis_quality_ok: true,
  }];

  for (const factor of factors) {
    const budgetUnits = Math.ceil(floorUnits * factor);
    const result = compile(spec, {
      seed,
      strategy: "lds",
      budget: { kind: "work", units: budgetUnits },
    });
    const scored = scoreDriftReport(result.report);
    const prefix = prefixOk(previousFingerprints, result.stats.scored_leaf_fingerprints);
    const monotoneScore = scored.score + 1e-9 >= previousScore.score;
    const monotoneAxis = !scored.passed || !previousScore.passed
      || scored.axis_quality + 1e-9 >= previousScore.axis_quality;
    rows.push({
      budget_units: budgetUnits,
      work_units_used: result.stats.work_units_used,
      budget_exhausted: result.stats.budget_exhausted,
      leaves_scored: result.stats.leaves_scored,
      prefix_ok: prefix,
      score: scored.score,
      passed: scored.passed,
      axis_quality: scored.axis_quality,
      monotone_score_ok: monotoneScore,
      monotone_axis_quality_ok: monotoneAxis,
    });
    previousFingerprints = result.stats.scored_leaf_fingerprints;
    previousScore = scored;
  }

  return {
    name,
    seed,
    floor_units: floorUnits,
    ok: rows.every((row) => row.prefix_ok && row.monotone_score_ok && row.monotone_axis_quality_ok),
    budgets: rows,
  };
}

async function main(): Promise<void> {
  const factors = parseFactors();
  const names = GOLDEN_SPECS.slice(0, parseLimit());
  const seeds = parseSeeds();
  const cases: CaseRow[] = [];
  for (const seed of seeds) {
    for (const name of names) {
      cases.push(await runCase(name, seed, factors));
    }
  }
  const summary = {
    ok: cases.every((row) => row.ok),
    seeds,
    factors,
    cases,
  };
  if (has("json")) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } else {
    console.log(`anytime sweep ok=${summary.ok} cases=${cases.length}`);
    for (const row of cases) {
      console.log(`${row.name} seed=${row.seed} ok=${row.ok} floor=${row.floor_units}`);
      for (const budget of row.budgets) {
        console.log(
          `  budget=${budget.budget_units} used=${budget.work_units_used} ` +
            `leaves=${budget.leaves_scored} score=${budget.score.toFixed(2)} ` +
            `prefix=${budget.prefix_ok} monoScore=${budget.monotone_score_ok} monoAxis=${budget.monotone_axis_quality_ok}`,
        );
      }
    }
  }
  if (!summary.ok) process.exitCode = 1;
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
