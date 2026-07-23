/** Register one explicit, fixed-N improvement operating point.
 *
 * This intentionally has no adaptive stopping and no compiler execution.  It
 * runs the two established independent-reference certification simulations at
 * the requested N, checks the safety artifacts through the ordinary guard,
 * and records immutable hashes in the registry.  `--smoke` exercises the
 * same parser/plan/path logic without launching the simulation workers.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeFileAtomicDurable } from "../v0/benchmark_v2/durable_fs.ts";
import { assertFixedSeedCount } from "../v0/benchmark_v2/baseline_cache.ts";
import {
  FIXED_N_OPERATING_POINTS_PATH,
  FIXED_N_OPERATING_POINTS_SCHEMA,
  fixedNOperatingPointFingerprint,
  registeredFixedNPoint,
  type RegisteredFixedNPoint,
} from "../v0/benchmark_v2/operating_points.ts";
import { requireCertifiedOperatingPoint } from "../v0/benchmark_v2/calibration_guard.ts";
import { loadSourceManifest, resolveSources } from "../v0/benchmark_v2/model.ts";
import { suiteIdentity } from "../v0/benchmark_v2/suite_model.ts";

const POOLED = "benchmark/v2/runs/calibration-v2.6-pooled-reference-seeds-0-23.json.gz";
const HOLDOUT = "benchmark/v2/runs/calibration-v2.6-holdout-reference-seeds-36-47.json.gz";

export function runCalibrateOperatingPointCommand(argv: string[]): number {
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const mode = argument("mode");
  if (mode !== "improve") throw new Error(`calibrate-point requires --mode=improve`);
  const rawSeeds = argument("seeds");
  if (rawSeeds === undefined || !/^\d+$/.test(rawSeeds)) throw new Error(`calibrate-point requires --seeds=N`);
  const seeds = assertFixedSeedCount(Number(rawSeeds));
  const smoke = argv.includes("--smoke");
  const workersRaw = argument("workers");
  const workers = workersRaw === undefined ? 32 : Number(workersRaw);
  if (!Number.isSafeInteger(workers) || workers < 1 || workers > 64) throw new Error(`--workers must be an integer in 1..64`);
  for (const value of argv) {
    if (value === "--smoke" || value === "--json") continue;
    const name = value.startsWith("--") ? value.slice(2, value.indexOf("=") === -1 ? undefined : value.indexOf("=")) : "";
    if (!value.startsWith("--") || !["mode", "seeds", "workers"].includes(name) || !value.includes("=")) {
      throw new Error(`unsupported calibrate-point argument ${value}`);
    }
  }
  const paths = artifactPaths(seeds);
  if (smoke) {
    emit(argv, {
      schema: "line.benchmark-v2.fixed-n-calibration-smoke.v1",
      status: "ready",
      seeds,
      plan: { mode: "improvement", futilitySchedule: [], criticalAlpha: 0.01, workers },
      artifacts: paths,
      commands: commands(seeds, workers, paths),
      note: "No simulation or compiler work was run. This validates the exact fixed-N registration plan.",
    });
    return 0;
  }
  if (registeredFixedNPoint(seeds) !== undefined) {
    throw new Error(`a fixed-N operating point is already registered for N=${seeds}; registry entries are immutable`);
  }
  for (const command of commands(seeds, workers, paths)) run(command);
  const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
  const suite = suiteIdentity("benchmark/v2/compat/suite-manifest.json", "benchmark/v2/compat/source-manifest.json", sources);
  const reports = [paths.menuCertification, paths.holdoutValidation].map((path) => JSON.parse(readFileSync(path, "utf8")));
  const point: RegisteredFixedNPoint = {
    id: `improve-fixed-n${seeds}`,
    mode: "improvement",
    margin: null,
    depth: seeds,
    criticalAlpha: 0.01,
    futilitySchedule: [],
    futilityAlpha: 0.05,
    cells: {
      // +2 is informative only for on-demand N.  Safety remains the three
      // empirical/validity/hard-zero null controls below.
      power: { id: "improve_power_2", statistic: "accept" },
      spendNull: { id: "improve_null_empirical", statistic: "accept" },
      additionalNulls: [
        { id: "improve_null_validity_flips", statistic: "accept" },
        { id: "improve_null_hard_zero", statistic: "accept" },
      ],
    },
    certifiedDetectableEffect: 2,
    certification: {
      menuCertification: paths.menuCertification,
      menuCertificationSha256: sha256(readFileSync(paths.menuCertification)),
      holdoutValidation: paths.holdoutValidation,
      holdoutValidationSha256: sha256(readFileSync(paths.holdoutValidation)),
    },
    calibrationFingerprint: sha256(JSON.stringify({
      reports: reports.map((report) => ({
        suite: report.suiteFingerprint,
        inference: report.decisionInferenceFingerprint,
        evalChain: report.evalChainInferenceFingerprint,
        plan: report.predeclared,
      })),
    })),
    registeredAt: new Date().toISOString(),
  };
  // The existing guard now treats dynamic-point power as diagnostic but still
  // enforces both artifact identities, all three null/stress controls,
  // determinism, exact N, and exact no-look plan.
  const registry = readRegistry();
  registry.points.push(point);
  writeFileAtomicDurable(FIXED_N_OPERATING_POINTS_PATH, `${JSON.stringify(registry, null, 2)}\n`);
  try {
    const certified = requireCertifiedOperatingPoint("improvement", null, seeds, suite.suiteFingerprint);
    emit(argv, {
      schema: "line.benchmark-v2.fixed-n-operating-point.v1",
      status: "registered",
      id: point.id,
      seeds,
      certificationFingerprint: certified.certificationFingerprint,
      registryFingerprint: fixedNOperatingPointFingerprint(point),
      spend: certified.spend,
      diagnosticMde: certified.mde80,
      nextCommand: `npm run benchmark -- baseline-cache status --seeds=${seeds}`,
    });
    return 0;
  } catch (error) {
    // Do not leave a point that failed the live guard registered.  The two raw
    // reports remain retained evidence of the failed calibration.
    registry.points.pop();
    writeFileAtomicDurable(FIXED_N_OPERATING_POINTS_PATH, `${JSON.stringify(registry, null, 2)}\n`);
    throw error;
  }
}

function artifactPaths(seeds: number): { menuCertification: string; holdoutValidation: string } {
  return {
    menuCertification: `benchmark/v2/studies/operating-points/improve-n${seeds}-menu.json`,
    holdoutValidation: `benchmark/v2/studies/operating-points/improve-n${seeds}-holdout.json`,
  };
}

function commands(seeds: number, workers: number, paths: ReturnType<typeof artifactPaths>): string[][] {
  const base = [
    "--import", "tsx", "scripts/benchmark/validate_independent_reference.ts",
    `--depth=${seeds}`, "--futility-schedule=none", `--workers=${workers}`,
  ];
  return [
    [
      ...base, "--mode=certify", "--allow-in-sample",
      `--independent-reference=${POOLED}`, `--original-reference=${POOLED}`,
      `--out=${paths.menuCertification}`,
    ],
    [
      ...base, "--mode=holdout",
      `--independent-reference=${HOLDOUT}`, `--original-reference=${POOLED}`,
      `--out=${paths.holdoutValidation}`,
    ],
  ];
}

function run(args: string[]): void {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), stdio: "inherit" });
  if (result.error !== undefined) throw result.error;
  // A certification may report a failed power bar with exit 2. The dynamic
  // guard decides whether its safety cells are still promotable; malformed or
  // infrastructure failures remain hard errors.
  if (result.status !== 0 && result.status !== 2) throw new Error(`fixed-N certification command failed with exit ${result.status}`);
}

function readRegistry(): { schema: typeof FIXED_N_OPERATING_POINTS_SCHEMA; points: RegisteredFixedNPoint[] } {
  const path = resolve(FIXED_N_OPERATING_POINTS_PATH);
  if (!existsSync(path)) throw new Error(`fixed-N operating-point registry is missing`);
  const registry = JSON.parse(readFileSync(path, "utf8"));
  if (registry.schema !== FIXED_N_OPERATING_POINTS_SCHEMA || !Array.isArray(registry.points)) {
    throw new Error(`fixed-N operating-point registry is malformed`);
  }
  return registry;
}

function emit(argv: string[], value: Record<string, unknown>): void {
  if (argv.includes("--json")) console.log(JSON.stringify(value, null, 2));
  else console.log(JSON.stringify(value, null, 2));
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}
