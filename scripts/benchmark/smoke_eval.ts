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
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireCurrentDecisionCalibration } from "../v0/benchmark_v2/calibration_guard.ts";

const ROOT = resolve("generated/benchmark-v2/smoke-eval");
const STATE = resolve(ROOT, "confirmation-state.json");
const FLAGS = [
  `--confirmation-state=${STATE}`,
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
copyFileSync("benchmark/v2/confirmation-state.json", STATE);
// The scratch copy is stamped to the CURRENT contract so the smoke can run
// against in-flight protocol edits before their closing migration lands; the
// real state is only ever re-stamped by `benchmark migrate`.
{
  const state = JSON.parse(readFileSync(STATE, "utf8"));
  const contract = requireCurrentDecisionCalibration(state.baseline.suiteFingerprint);
  state.baseline.inferenceFingerprint = contract.inferenceFingerprint;
  state.baseline.protocolFingerprint = contract.protocolFingerprint;
  state.baseline.calibrationFingerprint = contract.calibrationFingerprint;
  writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);
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
    ["diff", "--name-only", "--", "benchmark/v2/confirmation-state.json"],
    { encoding: "utf8" },
  ).trim();
  if (changed !== "") throw new Error(`smoke modified the real confirmation state`);
  if (existsSync("benchmark/v2/attempts.jsonl") !== realLedgerExistedBefore ||
    existsSync("benchmark/v2/era-state.json") !== realEraStateExistedBefore) {
    throw new Error(`smoke created or removed the real eval ledger files`);
  }
});

console.log(`\nsmoke_eval: ALL STEPS PASSED (scratch state under ${ROOT})`);
