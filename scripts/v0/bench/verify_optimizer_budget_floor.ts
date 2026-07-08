/**
 * Find the lowest shared compile budget where the 12-case optimizer parity suite
 * produces contract-valid tracks.
 *
 * "Valid" means the v0 scorer's hard contract passes: every authored contact is
 * hit within tolerance, no off-beat landings, and the rider reaches endOfSpec.
 * The search is a practical bisection over a budget grid; use --granularity=1
 * for an exact integer search if the extra runtime is acceptable.
 *
 *   npm run verify:optimizer:floor
 *   npm run verify:optimizer:floor -- --lo=1000 --hi=80000 --granularity=500
 */
import { loadGoldenSpec } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";
import { scoreDriftReport } from "../score.ts";
import { secToFrame } from "../types.ts";
import { WIDE_VERIFY_CASES } from "./optimizer_verify_cases.ts";

type CaseResult = {
  spec: string;
  seed: number;
  valid: boolean;
  lines: number;
  sim_frames: number;
  score: number;
  failures: string[];
};

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}

function fmtBudget(n: number): string {
  return n.toLocaleString("en-US");
}

function ceilToGrid(n: number, granularity: number): number {
  return Math.ceil(n / granularity) * granularity;
}

function floorToGrid(n: number, granularity: number): number {
  return Math.floor(n / granularity) * granularity;
}

async function runCase(specName: string, seed: number, budget: number): Promise<CaseResult> {
  // deno-lint-ignore no-explicit-any
  const spec = await loadGoldenSpec(specName as any, "base" as any);
  const cp = compileHandoff(spec, seed, { budget });
  const score = scoreDriftReport(cp.report, { totalFrames: secToFrame(spec.duration) });
  return {
    spec: specName,
    seed,
    valid: score.contract_passed,
    lines: cp.track?.lines?.length ?? -1,
    sim_frames: cp.stats?.sim_frames ?? -1,
    score: score.score,
    failures: score.hard_failures,
  };
}

async function runBudget(budget: number): Promise<{ budget: number; allValid: boolean; rows: CaseResult[] }> {
  const rows: CaseResult[] = [];
  for (const [spec, seed] of WIDE_VERIFY_CASES) {
    rows.push(await runCase(spec, seed, budget));
  }
  return { budget, allValid: rows.every((row) => row.valid), rows };
}

function printBudget(result: { budget: number; allValid: boolean; rows: CaseResult[] }): void {
  const valid = result.rows.filter((row) => row.valid).length;
  const worst = result.rows
    .filter((row) => !row.valid)
    .map((row) => `${row.spec}|seed${row.seed} [${row.failures.join(";") || "invalid"}]`);
  console.log(
    `${result.allValid ? "PASS" : "fail"} budget=${fmtBudget(result.budget)} ` +
      `valid=${valid}/${result.rows.length}` +
      (worst.length > 0 ? `  first_fail=${worst[0]}` : ""),
  );
}

async function main(): Promise<void> {
  const granularity = Math.max(1, Number(arg("granularity", "1000")));
  let lo = floorToGrid(Math.max(0, Number(arg("lo", "0"))), granularity);
  let hi = ceilToGrid(Math.max(1, Number(arg("hi", "80000"))), granularity);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(granularity)) {
    throw new Error("lo, hi, and granularity must be finite numbers");
  }
  if (lo >= hi) throw new Error(`lo must be < hi, got lo=${lo} hi=${hi}`);

  console.log(
    `verify_optimizer_budget_floor cases=${WIDE_VERIFY_CASES.length} ` +
      `lo=${fmtBudget(lo)} hi=${fmtBudget(hi)} granularity=${fmtBudget(granularity)}`,
  );

  let hiResult = await runBudget(hi);
  printBudget(hiResult);
  while (!hiResult.allValid) {
    lo = hi;
    hi = ceilToGrid(hi * 2, granularity);
    if (hi > 2_000_000) throw new Error("failed to find a passing upper bound by 2,000,000 frames");
    hiResult = await runBudget(hi);
    printBudget(hiResult);
  }

  let pass = hi;
  let passResult = hiResult;
  let fail = lo;
  while (pass - fail > granularity) {
    const mid = ceilToGrid(Math.floor((fail + pass) / 2), granularity);
    const result = await runBudget(mid);
    printBudget(result);
    if (result.allValid) {
      pass = mid;
      passResult = result;
    } else {
      fail = mid;
    }
  }

  console.log("");
  console.log(`minimum passing shared budget: ${fmtBudget(pass)} frames (${fmtBudget(granularity)}-frame granularity)`);
  console.log(`largest failing checked lower bound: ${fmtBudget(fail)} frames`);
  console.log("");
  for (const row of passResult.rows) {
    console.log(
      `  ${`${row.spec}|seed${row.seed}`.padEnd(28)} ` +
        `valid=${row.valid ? "yes" : "no "} lines=${String(row.lines).padStart(4)} ` +
        `sim_frames=${String(row.sim_frames).padStart(7)} score=${row.score.toFixed(2)}` +
        (row.failures.length > 0 ? ` failures=${row.failures.join(";")}` : ""),
    );
  }
}

main();
