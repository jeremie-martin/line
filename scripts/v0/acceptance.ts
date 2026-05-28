import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

import { compile } from "./compile.ts";
import { budgetFor, GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { scoreDriftReport, shiftedGeometricMean, type V0ContractScore } from "./score.ts";
import type { Spec } from "./types.ts";

const REPRESENTATIVE_SPECS: GoldenSpecName[] = [
  "drums_signature",
  "dense_sprint",
  "syncopated_switchback",
  "grain_staircase",
];
const REPRESENTATIVE_SEEDS = [0, 1, 2] as const;
const FULL_SEEDS = [0, 1, 2, 3, 4] as const;
const REPRESENTATIVE_FACTORS = [0.35, 0.7, 1] as const;
const FULL_FACTORS = [0.25, 0.5, 1, 1.5] as const;
const QUALITY_TOLERANCE = 0.01;
const DEFAULT_CV_THRESHOLD = 0.25;
const BASELINE_PATH = "baselines/greedy_v1.json";

type BudgetRow = {
  name: GoldenSpecName;
  seed: number;
  factor: number;
  budget_units: number;
  elapsed_ms: number;
  work_units: number;
  wall_ms_per_work_unit: number;
  track_hash: string;
  score: number;
  passed: boolean;
  axis_quality: number;
  contract_gated_quality: number;
  leaf_fingerprints: string[];
};

type CaseSummary = {
  name: GoldenSpecName;
  seed: number;
  rows: BudgetRow[];
  monotone_ok: boolean;
  prefix_ok: boolean;
  failures: string[];
};

type Baseline = {
  goal_score: number;
  passed: number;
  total: number;
  spec_scores: Array<{ name: string; score: number; passed: number; total: number }>;
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
  if (raw !== null) {
    const seeds = raw.split(",").map((part) => Number(part.trim()));
    if (seeds.some((seed) => !Number.isInteger(seed))) {
      throw new Error(`--seeds must be comma-separated integers, got ${raw}`);
    }
    return seeds;
  }
  return has("full") ? [...FULL_SEEDS] : [...REPRESENTATIVE_SEEDS];
}

function parseFactors(): number[] {
  const raw = arg("factors");
  if (raw !== null) {
    const factors = raw.split(",").map((part) => Number(part.trim()));
    if (factors.some((factor) => !Number.isFinite(factor) || factor <= 0)) {
      throw new Error(`--factors must be comma-separated positive numbers, got ${raw}`);
    }
    return factors;
  }
  return has("full") ? [...FULL_FACTORS] : [...REPRESENTATIVE_FACTORS];
}

function parseSpecs(): GoldenSpecName[] {
  const raw = arg("specs");
  if (raw === null) return has("full") ? [...GOLDEN_SPECS] : [...REPRESENTATIVE_SPECS];
  const specs = raw.split(",").map((part) => part.trim());
  for (const spec of specs) {
    if (!GOLDEN_SPECS.includes(spec as GoldenSpecName)) {
      throw new Error(`unknown golden spec ${spec}`);
    }
  }
  return specs as GoldenSpecName[];
}

function parseCvThreshold(): number {
  const raw = arg("max-cv");
  if (raw === null) return DEFAULT_CV_THRESHOLD;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--max-cv must be a positive number, got ${raw}`);
  }
  return value;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function contractGatedQuality(score: V0ContractScore): number {
  return score.passed ? score.axis_quality : 0;
}

function prefixOk(prev: string[], next: string[]): boolean {
  if (prev.length > next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((value) => Math.pow(value - m, 2))));
}

function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  return m === 0 ? 0 : stddev(values) / m;
}

function budgetUnits(spec: Spec, factor: number): number {
  return Math.max(1, Math.ceil(budgetFor(spec).units * factor));
}

function scoreRows(rows: BudgetRow[]): number {
  const bySpec = new Map<GoldenSpecName, BudgetRow[]>();
  for (const row of rows) {
    bySpec.set(row.name, [...(bySpec.get(row.name) ?? []), row]);
  }
  const specScores = [...bySpec.values()].map((specRows) =>
    shiftedGeometricMean(specRows.map((row) => row.score))
  );
  return shiftedGeometricMean(specScores);
}

async function compileBudget(
  name: GoldenSpecName,
  spec: Spec,
  seed: number,
  factor: number,
): Promise<BudgetRow> {
  const budget_units = budgetUnits(spec, factor);
  const t0 = performance.now();
  const result = compile(spec, {
    seed,
    strategy: "lds",
    budget: { kind: "work", units: budget_units },
  });
  const elapsed_ms = performance.now() - t0;
  const score = scoreDriftReport(result.report);
  return {
    name,
    seed,
    factor,
    budget_units,
    elapsed_ms,
    work_units: result.stats.work_units_used,
    wall_ms_per_work_unit: result.stats.work_units_used > 0
      ? elapsed_ms / result.stats.work_units_used
      : 0,
    track_hash: stableHash(result.track),
    score: score.score,
    passed: score.passed,
    axis_quality: score.axis_quality,
    contract_gated_quality: contractGatedQuality(score),
    leaf_fingerprints: result.stats.scored_leaf_fingerprints,
  };
}

async function runCase(
  name: GoldenSpecName,
  seed: number,
  factors: number[],
): Promise<CaseSummary> {
  const spec = await loadGoldenSpec(name, "base");
  const rows: BudgetRow[] = [];
  for (const factor of factors) {
    rows.push(await compileBudget(name, spec, seed, factor));
  }

  const failures: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const next = rows[i];
    if (next.contract_gated_quality + QUALITY_TOLERANCE < prev.contract_gated_quality) {
      failures.push(
        `quality ${prev.factor}->${next.factor}: ${prev.contract_gated_quality.toFixed(4)} > ${next.contract_gated_quality.toFixed(4)}`,
      );
    }
    if (!prefixOk(prev.leaf_fingerprints, next.leaf_fingerprints)) {
      failures.push(`leaf prefix ${prev.factor}->${next.factor} is not stable`);
    }
  }

  return {
    name,
    seed,
    rows,
    monotone_ok: failures.every((failure) => !failure.startsWith("quality")),
    prefix_ok: failures.every((failure) => !failure.startsWith("leaf prefix")),
    failures,
  };
}

async function runDeterminism(
  names: GoldenSpecName[],
  seeds: number[],
): Promise<{ ok: boolean; failures: string[] }> {
  if (has("skip-determinism")) return { ok: true, failures: [] };
  const failures: string[] = [];
  for (const name of names) {
    const spec = await loadGoldenSpec(name, "base");
    const units = budgetUnits(spec, 1);
    for (const seed of seeds) {
      const a = compile(spec, { seed, strategy: "lds", budget: { kind: "work", units } });
      const b = compile(spec, { seed, strategy: "lds", budget: { kind: "work", units } });
      if (stableHash(a.track) !== stableHash(b.track)) {
        failures.push(`${name} seed=${seed} track hash mismatch`);
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

async function readBaseline(): Promise<Baseline> {
  return JSON.parse(await readFile(resolve(BASELINE_PATH), "utf8")) as Baseline;
}

async function compareBaseline(
  rows: BudgetRow[],
  names: GoldenSpecName[],
  seeds: number[],
  factors: number[],
): Promise<{ enabled: boolean; ok: boolean; message: string; goal_score: number | null; failures: string[] }> {
  const enabled = has("baseline") || (has("full") && !has("skip-baseline"));
  if (!enabled) {
    return { enabled, ok: true, message: "skipped", goal_score: null, failures: [] };
  }

  const baseline = await readBaseline();
  const baselineSeeds = [0, 1, 2];
  const hasDefaultFactor = factors.some((factor) => Math.abs(factor - 1) < 1e-9);
  const coversSuite = GOLDEN_SPECS.every((name) => names.includes(name));
  const coversSeeds = baselineSeeds.every((seed) => seeds.includes(seed));
  if (!hasDefaultFactor || !coversSuite || !coversSeeds) {
    return {
      enabled,
      ok: false,
      message: "baseline comparison requires full suite, seeds 0,1,2, and factor 1",
      goal_score: null,
      failures: ["incomplete baseline comparison input"],
    };
  }

  const defaultRows = rows.filter((row) =>
    Math.abs(row.factor - 1) < 1e-9 && baselineSeeds.includes(row.seed)
  );
  const goal_score = Number(scoreRows(defaultRows).toFixed(2));
  const failures: string[] = [];
  if (goal_score + 1e-9 < baseline.goal_score * 0.95) {
    failures.push(`goal_score ${goal_score} below 95% of baseline ${baseline.goal_score}`);
  }

  for (const specBaseline of baseline.spec_scores) {
    const passed = defaultRows.filter((row) => row.name === specBaseline.name && row.passed).length;
    if (passed < specBaseline.passed) {
      failures.push(`${specBaseline.name} pass count ${passed} below baseline ${specBaseline.passed}`);
    }
  }

  return {
    enabled,
    ok: failures.length === 0,
    message: failures.length === 0 ? "passed" : "failed",
    goal_score,
    failures,
  };
}

async function main(): Promise<void> {
  const names = parseSpecs();
  const seeds = parseSeeds();
  const factors = parseFactors();
  const maxCv = parseCvThreshold();

  const cases: CaseSummary[] = [];
  for (const seed of seeds) {
    for (const name of names) {
      cases.push(await runCase(name, seed, factors));
    }
  }

  const allRows = cases.flatMap((row) => row.rows);
  const ratios = allRows
    .map((row) => row.wall_ms_per_work_unit)
    .filter((value) => Number.isFinite(value) && value > 0);
  const cv = coefficientOfVariation(ratios);
  const wallClock = {
    skipped: has("skip-wall"),
    max_cv: maxCv,
    cv,
    ok: has("skip-wall") || cv < maxCv,
  };
  const determinism = await runDeterminism(names, seeds);
  const baseline = await compareBaseline(allRows, names, seeds, factors);

  const monotonicityFailures = cases.flatMap((row) =>
    row.failures.map((failure) => `${row.name} seed=${row.seed}: ${failure}`)
  );
  const summary = {
    ok: monotonicityFailures.length === 0 && wallClock.ok && determinism.ok && baseline.ok,
    mode: has("full") ? "full" : "representative",
    names,
    seeds,
    factors,
    quality_tolerance: QUALITY_TOLERANCE,
    monotonicity: {
      ok: monotonicityFailures.length === 0,
      failures: monotonicityFailures,
    },
    wall_clock: wallClock,
    determinism,
    baseline,
    cases: cases.map((row) => ({
      name: row.name,
      seed: row.seed,
      ok: row.failures.length === 0,
      rows: row.rows.map((budget) => ({
        factor: budget.factor,
        budget_units: budget.budget_units,
        work_units: budget.work_units,
        elapsed_ms: Math.round(budget.elapsed_ms),
        wall_ms_per_work_unit: Number(budget.wall_ms_per_work_unit.toFixed(8)),
        score: Number(budget.score.toFixed(2)),
        passed: budget.passed,
        axis_quality: Number(budget.axis_quality.toFixed(4)),
        contract_gated_quality: Number(budget.contract_gated_quality.toFixed(4)),
        leaves: budget.leaf_fingerprints.length,
        track_hash: budget.track_hash.slice(0, 12),
      })),
    })),
  };

  if (has("json")) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } else {
    console.log(
      `v0 acceptance ${summary.mode} ok=${summary.ok} cases=${cases.length} ` +
        `cv=${cv.toFixed(3)} baseline=${baseline.message}`,
    );
    for (const failure of monotonicityFailures) console.log(`  monotonicity: ${failure}`);
    for (const failure of determinism.failures) console.log(`  determinism: ${failure}`);
    for (const failure of baseline.failures) console.log(`  baseline: ${failure}`);
    if (!wallClock.ok) console.log(`  wall-clock cv ${cv.toFixed(3)} >= ${maxCv}`);
  }

  if (!summary.ok) process.exitCode = 1;
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
