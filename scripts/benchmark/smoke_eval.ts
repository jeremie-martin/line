/**
 * Manual smoke of the eval chain against scratch state (NOT vitest — this
 * compiles for real). ~10 minutes at 48 workers:
 *
 *   1. stage 0 of the current tree vs the stored probe baseline (~1 min)
 *   2. --to-verdict with a known-broken candidate (LR_QUALITY_NCAND=1):
 *      the futility rule must stop the attempt at an early look (exit 4)
 *   3. --resume of the stopped attempt: the durable futility short-circuits
 *      without recompiling (exit 4, seconds)
 *
 * All state paths point at generated/benchmark-v2/smoke-eval; the real
 * ledger, confirmation state, and baseline files are never written.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/benchmark/smoke_eval.ts
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { requireCurrentDecisionCalibration } from "../v0/benchmark_v2/calibration_guard.ts";
import { readBaselineContract, assertCurrentDecisionContract } from "../v0/benchmark_v2/confirmation.ts";

const ROOT = resolve("generated/benchmark-v2/smoke-eval");
const FLAGS = [
  `--attempts-ledger=${resolve(ROOT, "attempts.jsonl")}`,
  `--era-state=${resolve(ROOT, "era-state.json")}`,
  `--declaration-dir=${resolve(ROOT, "confirmations")}`,
  `--out-dir=${resolve(ROOT, "runs")}`,
  `--archive-dir=${resolve(ROOT, "retained")}`,
];

function evalCommand(args: string[], env: Record<string, string>): number {
  try {
    execFileSync(process.execPath, [
      "--import", "tsx", "scripts/benchmark/cli.ts", "eval", ...args, "--no-resource-stats",
    ], {
      stdio: "inherit",
      env: { ...process.env, LR_ENGINE: "wasm", ...env },
    });
    return 0;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (typeof status !== "number") throw error;
    return status;
  }
}

function step(label: string, run: () => void): void {
  const startedAt = performance.now();
  console.log(`\n=== smoke: ${label} ===`);
  run();
  console.log(`=== smoke: ${label} OK (${((performance.now() - startedAt) / 1000).toFixed(0)}s) ===`);
}

if (process.env.LR_ENGINE !== "wasm") throw new Error(`smoke_eval requires LR_ENGINE=wasm`);
const realLedgerExistedBefore = existsSync("benchmark/v2/attempts.jsonl");
const realEraStateExistedBefore = existsSync("benchmark/v2/era-state.json");
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });
// The smoke declares against the REAL baseline of record (read-only), so the
// decision contract must be current: run `benchmark migrate` before smoking
// in-flight protocol edits.
{
  const baseline = readBaselineContract();
  assertCurrentDecisionContract(baseline, requireCurrentDecisionCalibration(baseline.suiteFingerprint));
}

step("stage 0 (informational screen, real compiles)", () => {
  const code = evalCommand([`--out=${resolve(ROOT, "stage0.json")}`, ...FLAGS], {});
  if (code !== 0) throw new Error(`stage 0 exited ${code}, expected 0`);
});

step("--to-verdict on a known regression fires futility (exit 4)", () => {
  const code = evalCommand(["--to-verdict", ...FLAGS], { LR_QUALITY_NCAND: "1" });
  if (code !== 4) throw new Error(`known-regression eval exited ${code}, expected 4 (futility stop)`);
  const ledger = readFileSync(resolve(ROOT, "attempts.jsonl"), "utf8");
  if (!ledger.includes('"type":"futility"') && !ledger.includes('"type": "futility"')) {
    throw new Error(`futility event missing from the smoke ledger`);
  }
});

step("--resume short-circuits on the durable futility stop", () => {
  const startedAt = performance.now();
  const code = evalCommand(["--to-verdict", "--resume", ...FLAGS], { LR_QUALITY_NCAND: "1" });
  if (code !== 4) throw new Error(`resume exited ${code}, expected 4`);
  const seconds = (performance.now() - startedAt) / 1000;
  if (seconds > 120) throw new Error(`durable futility resume took ${seconds.toFixed(0)}s; it must not recompile`);
});

step("real state untouched", () => {
  const changed = execFileSync(
    "git",
    ["diff", "--name-only", "--", "benchmark/v2/baseline.json", "benchmark/v2/attempts.jsonl", "benchmark/v2/era-state.json"],
    { encoding: "utf8" },
  ).trim();
  if (changed !== "") throw new Error(`smoke modified real state:\n${changed}`);
  if (existsSync("benchmark/v2/attempts.jsonl") !== realLedgerExistedBefore ||
    existsSync("benchmark/v2/era-state.json") !== realEraStateExistedBefore) {
    throw new Error(`smoke created or removed the real eval ledger files`);
  }
});

console.log(`\nsmoke_eval: ALL STEPS PASSED (scratch state under ${ROOT})`);
