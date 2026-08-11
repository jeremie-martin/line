/**
 * verify_compiler_behavior — strict compiler behavior oracle.
 *
 * Runs the curated 12-case compiler suite across budget rungs that exercise both
 * scarce and mature policy, hashes the real compile output, and compares against
 * a recorded baseline. Default verification is fail-fast: stop on the first
 * mismatch so behavior drift is cheap to localize.
 *
 *   npm run verify:compiler:behavior
 *   npm run verify:compiler:behavior -- --all
 *   npm run verify:compiler:behavior -- --update
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGoldenSpec } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";
import { scoreDriftReport } from "../score.ts";
import { secToFrame } from "../types.ts";
import { WIDE_VERIFY_CASES, type VerifyOptimizerCase } from "./optimizer_verify_cases.ts";
import {
  currentCampaignVerificationProvenance,
  formatVerificationProvenance,
  type VerificationProvenance,
} from "./verification_provenance.ts";

const OUT_DIR = "generated/verify-compiler-behavior";
const BASELINE = resolve(OUT_DIR, "baseline.json");
const DEFAULT_BUDGETS = [61_000, 100_000, 150_000, 200_000] as const;
const CASES = WIDE_VERIFY_CASES;
const VERSION = 1;

/**
 * The 61k rung deliberately reaches below the compiler's reliable operating
 * surface. `rhythm_ladder` is the one known-invalid cell on the governed
 * compiler; retaining it is useful because its exact failure, output, and work
 * trajectory are still a sensitive behavior oracle. Any other invalid cell is
 * a verification failure, and making this cell valid also requires an explicit
 * fixture refresh rather than silently changing the contract.
 */
const EXPECTED_INVALID_CELLS = new Set([
  "rhythm_ladder|seed2|budget61000",
]);

type Cell = {
  hash: string;
  track_hash: string;
  report_hash: string;
  stats_hash: string;
  lines: number;
  sim_frames: number;
  score: number;
  contract_passed: boolean;
  hard_failures: string[];
  repair_restarts: number;
  repair_frames_spent: number;
};

type Coverage = {
  cells: number;
  repair_cells: number;
  repair_restarts: number;
  repair_frames_spent: number;
};

type Baseline = {
  version: number;
  budgets: number[];
  cases: VerifyOptimizerCase[];
  provenance?: VerificationProvenance;
  cells: Record<string, Cell>;
  coverage: Coverage;
};

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function parseBudgetList(source: string | null): number[] {
  if (source === null) return [...DEFAULT_BUDGETS];
  const budgets = source.split(",").map((part) => Number(part.trim()));
  if (budgets.length === 0 || budgets.some((budget) => !Number.isSafeInteger(budget) || budget <= 0)) {
    throw new Error(`--budgets must be a comma-separated list of positive integer frame budgets, got ${source}`);
  }
  return [...new Set(budgets)].sort((a, b) => a - b);
}

function key(spec: string, seed: number, budget: number): string {
  return `${spec}|seed${seed}|budget${budget}`;
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function behaviorStats(stats: unknown): unknown {
  const clone = structuredClone(stats) as { repair?: { records?: unknown[] } };
  if (clone?.repair?.records !== undefined) delete clone.repair.records;
  return clone;
}

function fmtBudget(n: number): string {
  return n.toLocaleString("en-US");
}

async function compileCell(specName: string, seed: number, budget: number): Promise<Cell> {
  // deno-lint-ignore no-explicit-any
  const spec = await loadGoldenSpec(specName as any, "base" as any);
  const cp = compileHandoff(spec, seed, { budget });
  const stats = behaviorStats(cp.stats);
  const score = scoreDriftReport(cp.report, { totalFrames: secToFrame(spec.duration) });
  const repair = (stats as { repair?: { restarts?: number; frames_spent?: number } })?.repair;
  const trackHash = hashJson(cp.track);
  const reportHash = hashJson(cp.report);
  const statsHash = hashJson(stats);

  return {
    hash: hashJson({ track: cp.track, report: cp.report, stats }),
    track_hash: trackHash,
    report_hash: reportHash,
    stats_hash: statsHash,
    lines: cp.track?.lines?.length ?? -1,
    sim_frames: cp.stats?.sim_frames ?? -1,
    score: score.score,
    contract_passed: score.contract_passed,
    hard_failures: score.hard_failures,
    repair_restarts: repair?.restarts ?? 0,
    repair_frames_spent: repair?.frames_spent ?? 0,
  };
}

function diffCell(want: Cell, got: Cell): string | null {
  if (got.hash === want.hash) return null;
  const parts: string[] = [];
  if (got.track_hash !== want.track_hash) parts.push("track");
  if (got.report_hash !== want.report_hash) parts.push("report");
  if (got.stats_hash !== want.stats_hash) parts.push("stats");
  if (got.sim_frames !== want.sim_frames) parts.push(`sim_frames ${want.sim_frames}->${got.sim_frames}`);
  if (got.lines !== want.lines) parts.push(`lines ${want.lines}->${got.lines}`);
  if (got.contract_passed !== want.contract_passed) {
    parts.push(`valid ${want.contract_passed ? "yes" : "no"}->${got.contract_passed ? "yes" : "no"}`);
  }
  return `${want.hash} -> ${got.hash} [${parts.join(", ") || "bytes changed"}]`;
}

function addCoverage(coverage: Coverage, cell: Cell): void {
  coverage.cells++;
  if (cell.repair_restarts > 0 || cell.repair_frames_spent > 0) coverage.repair_cells++;
  coverage.repair_restarts += cell.repair_restarts;
  coverage.repair_frames_spent += cell.repair_frames_spent;
}

function coverageError(coverage: Coverage): string | null {
  if (coverage.repair_cells === 0 || coverage.repair_restarts === 0) {
    return "coverage failure: no checked cell exercised repair";
  }
  return null;
}

function assertCompatibleBaseline(baseline: Baseline, budgets: number[]): void {
  if (baseline.version !== VERSION) {
    throw new Error(`baseline version ${baseline.version} != verifier version ${VERSION}; re-record with --update`);
  }
  if (JSON.stringify(baseline.budgets) !== JSON.stringify(budgets)) {
    throw new Error(
      `baseline budgets ${baseline.budgets.join(",")} != current budgets ${budgets.join(",")}; re-record with --update`,
    );
  }
  if (JSON.stringify(baseline.cases) !== JSON.stringify(CASES)) {
    throw new Error("baseline case set differs from current WIDE_VERIFY_CASES; re-record with --update");
  }
}

async function main(): Promise<void> {
  const update = has("update");
  const all = has("all") || update;
  const budgets = parseBudgetList(arg("budgets"));
  const current: Record<string, Cell> = {};
  const coverage: Coverage = { cells: 0, repair_cells: 0, repair_restarts: 0, repair_frames_spent: 0 };

  let baseline: Baseline | null = null;
  if (!update) {
    if (!existsSync(BASELINE)) {
      throw new Error(`No baseline at ${BASELINE}. Record it on known-good HEAD: npm run verify:compiler:behavior -- --update`);
    }
    baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
    assertCompatibleBaseline(baseline, budgets);
    console.log(`fixture provenance: ${formatVerificationProvenance(baseline.provenance)}`);
  }

  const diffs: string[] = [];
  console.log(
    `verify_compiler_behavior cases=${CASES.length} budgets=${budgets.map(fmtBudget).join(",")} ` +
      `${all ? "mode=all" : "mode=fail-fast"}`,
  );

  for (const budget of budgets) {
    for (const [spec, seed] of CASES) {
      const k = key(spec, seed, budget);
      const cell = await compileCell(spec, seed, budget);
      current[k] = cell;
      addCoverage(coverage, cell);

      if (!cell.contract_passed && !EXPECTED_INVALID_CELLS.has(k)) {
        const msg = `${k}: INVALID (${cell.hard_failures.join(";") || "contract failed"})`;
        if (!all) throw new Error(msg);
        diffs.push(`  ${msg}`);
      }

      if (baseline !== null) {
        const want = baseline.cells[k];
        const diff = want === undefined ? "NEW cell (no baseline)" : diffCell(want, cell);
        if (diff !== null) {
          const msg = `${k}: ${diff}`;
          if (!all) throw new Error(msg);
          diffs.push(`  ${msg}`);
        }
      }

      console.log(
        `  ${k.padEnd(42)} lines=${String(cell.lines).padStart(4)} ` +
          `sim_frames=${String(cell.sim_frames).padStart(7)} score=${cell.score.toFixed(2).padStart(6)} ` +
          `repair=${String(cell.repair_restarts).padStart(2)} ${cell.hash}`,
      );
    }
  }

  const covErr = coverageError(coverage);
  if (covErr !== null) {
    if (!all) throw new Error(covErr);
    diffs.push(`  ${covErr}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  if (update) {
    if (diffs.length > 0) {
      throw new Error(`Refusing to record invalid behavior baseline:\n${diffs.join("\n")}`);
    }
    const next: Baseline = {
      version: VERSION,
      budgets,
      cases: [...CASES],
      provenance: currentCampaignVerificationProvenance(),
      cells: current,
      coverage,
    };
    writeFileSync(BASELINE, JSON.stringify(next, null, 2) + "\n");
    console.log(`\nRe-baselined ${coverage.cells} compiler behavior cells -> ${BASELINE}`);
    console.log(
      `coverage: repair_cells=${coverage.repair_cells} ` +
        `repair_restarts=${coverage.repair_restarts} repair_frames=${coverage.repair_frames_spent}`,
    );
    return;
  }

  if (diffs.length > 0) {
    throw new Error(`compiler behavior DIVERGED from baseline:\n${diffs.join("\n")}`);
  }

  console.log(
    `\nOK compiler behavior bit-identical (${coverage.cells} cells; ` +
      `repair_cells=${coverage.repair_cells}, repair_restarts=${coverage.repair_restarts})`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
