/**
 * v0 CLI entry — load a spec module, compile it, write Track JSON +
 * DriftReport to disk.
 *
 *   npx tsx scripts/v0/run.ts --spec=scripts/v0/specs/first.ts
 *   npx tsx scripts/v0/run.ts --spec=scripts/v0/specs/first.ts --seed=42 --out=generated/v0_first
 *   npx tsx scripts/v0/run.ts --spec=... --compiler=handoff --budget=200000
 *
 * --compiler: handoff (default). Kept explicit so future compilers can be
 *             added without changing the CLI shape. Default budget 200000.
 *
 * Outputs:
 *   <out>.track.json
 *   <out>.report.json
 */

import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { applyJolt, JOLT_DEFAULT_MS } from "../produce/seed.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { AXES, FPS, type Spec } from "./types.ts";
import { axisDetails, scoreDriftReport } from "./score.ts";
import { specCameraToSidecar } from "./core/camera.ts";
import { extractTrace, TRACE_EMIT } from "./core/trace.ts";

const COMPILERS = {
  handoff: compileHandoff,
} as const;

type CompilerName = keyof typeof COMPILERS;

function isCompilerName(value: string): value is CompilerName {
  return Object.hasOwn(COMPILERS, value);
}

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const specPath = arg("spec");
if (!specPath) {
  console.error("usage: npx tsx scripts/v0/run.ts --spec=<path.ts> [--seed=N] [--out=<prefix>]");
  process.exit(1);
}

const seed = arg("seed") !== null ? parseInt(arg("seed")!, 10) : 0;

const rawCompiler = arg("compiler") ?? "handoff";
if (!isCompilerName(rawCompiler)) {
  console.error(`unknown --compiler=${rawCompiler} (expected handoff)`);
  process.exit(1);
}
const compiler: CompilerName = rawCompiler;
const rawBudget = arg("budget");
const budgetUnits = rawBudget !== null ? Number(rawBudget) : 200_000;
if (!Number.isSafeInteger(budgetUnits) || budgetUnits <= 0) {
  console.error(`invalid --budget=${arg("budget")} (expected positive integer)`);
  process.exit(1);
}

const specName = basename(specPath).replace(/\.ts$/, "");
const outPrefix = arg("out") ?? `generated/v0_${specName}`;

console.log(`spec=${specPath}  compiler=${compiler}  seed=${seed}  budget=${budgetUnits}  out=${outPrefix}`);

const specMod = await import(resolve(specPath));
const spec: Spec = specMod.default;
if (!spec) {
  console.error(`spec module at ${specPath} did not default-export a Spec`);
  process.exit(1);
}

// Felt-jolt beat alignment (production default). The slam the viewer feels — the
// peak per-frame velocity redirection — trails first contact by a systematic
// ~2-3 frames (~50-75ms; measured p50 +3 over 7,501 episodes, see
// docs/impact_generation_and_landing_notes.md § "Empirical verdict"). Shifting
// every contact earlier puts the slam, not the touch, on the musical beat.
// A/B-validated on shelter_amp (2026-06-09). LR_JOLT_OFFSET_MS overrides; 0
// disables. This is an authoring-layer transform on THIS production CLI only:
// the golden suite, verify:optimizer, and tests call compileHandoff directly
// and stay offset-free by construction.
const rawJoltMs = process.env.LR_JOLT_OFFSET_MS;
const joltOffsetMs = rawJoltMs === undefined || rawJoltMs === ""
  ? JOLT_DEFAULT_MS
  : Number(rawJoltMs);
if (!Number.isFinite(joltOffsetMs)) {
  console.error(`invalid LR_JOLT_OFFSET_MS=${rawJoltMs} (expected a finite number of ms; positive shifts contacts earlier, negative later)`);
  process.exit(1);
}
// Shift contacts so the felt slam (not the touch) lands on the beat; applyJolt
// clamps to the detector's earliest catchable contact and is the shared transform
// the produce pipeline uses, so the two can never drift.
const compiledSpec: Spec = applyJolt(spec, joltOffsetMs);
if (joltOffsetMs !== 0) {
  const dir = joltOffsetMs > 0 ? "earlier" : "later";
  console.log(`jolt offset: contacts shifted ${Math.abs(joltOffsetMs)}ms ${dir} (LR_JOLT_OFFSET_MS=0 to disable)`);
}

const t0 = Date.now();
const { track, report } = COMPILERS[compiler](compiledSpec, seed, { budget: budgetUnits });
const elapsedMs = Date.now() - t0;

mkdirSync(dirname(resolve(`${outPrefix}.track.json`)), { recursive: true });
writeFileSync(resolve(`${outPrefix}.track.json`), JSON.stringify(track, null, 2));
writeFileSync(resolve(`${outPrefix}.report.json`), JSON.stringify(report, null, 2));
const cameraSidecar = specCameraToSidecar(spec);
const cameraPath = resolve(`${outPrefix}.camera.json`);
if (cameraSidecar !== null) {
  writeFileSync(cameraPath, JSON.stringify(cameraSidecar, null, 2));
} else if (existsSync(cameraPath)) {
  rmSync(cameraPath, { force: true });
}
// Opt-in observation layer (LR_EMIT_TRACE=1): per-frame trace + rotation/spin
// features of the final track, for exploring aesthetic dimensions. Off by
// default; never touches the score or the benchmark.
if (TRACE_EMIT) {
  writeFileSync(resolve(`${outPrefix}.trace.json`), JSON.stringify(extractTrace(track), null, 2));
}

// Console summary
// Terminal summary: small and sync-first. Full per-gap detail lives in the
// report JSON (and the dashboard); the terminal shows only what you scan for.
const contactSummary = report.contacts.reduce(
  (acc, c) => { acc[c.status]++; return acc; },
  { hit: 0, drift: 0, missing: 0 } as Record<string, number>,
);
const score = scoreDriftReport(report, { totalFrames: track.duration });
const axes = axisDetails(report);

// Per-axis mean |error| roll-up (which axis is hurting, without listing gaps).
const byAxis = AXES.map((name) => {
  const errs = axes.filter((a) => a.axis === name).map((a) => Math.abs(a.error));
  if (errs.length === 0) return null;
  const mean = errs.reduce((s, e) => s + e, 0) / errs.length;
  return `${name} ${mean.toFixed(2)}`;
}).filter((s): s is string => s !== null);

// The few worst-error gaps (target→achieved per axis on that gap).
const worstGaps = [...report.gaps]
  .map((g) => ({
    g,
    maxErr: Math.max(0, ...Object.values(g.axes).map((v) => Math.abs(v.error))),
  }))
  .filter((x) => x.maxErr > 0)
  .sort((a, b) => b.maxErr - a.maxErr)
  .slice(0, 5)
  .map(({ g }) => {
    const parts = Object.entries(g.axes)
      .map(([k, v]) => `${k} ${v.target.toFixed(2)}→${v.achieved.toFixed(2)}`)
      .join("  ");
    return `  g${g.gap_index} ${g.t_end.toFixed(1)}s  ${parts}`;
  });

const durS = (track.duration / FPS).toFixed(1);
const lines = [
  `compiled ${durS}s → ${track.lines.length} lines  (${elapsedMs}ms)`,
  `contacts  ${contactSummary.hit}/${report.contacts.length} hit · ${contactSummary.drift} drift · ` +
    `${contactSummary.missing} missing · ${report.off_beat_landings.length} off-beat`,
  `survival  ${report.terminus.reason}@${report.terminus.frame}   ` +
    `score ${score.score.toFixed(1)}   axis_rms ${score.axis_error_rms.toFixed(3)}`,
];
if (byAxis.length > 0) lines.push(`by axis (mean|err|):  ${byAxis.join("  ")}`);
if (worstGaps.length > 0) lines.push("worst gaps (target→achieved):", ...worstGaps);
lines.push(`full report → ${outPrefix}.report.json`);
if (cameraSidecar !== null) lines.push(`camera → ${outPrefix}.camera.json`);
if (TRACE_EMIT) lines.push(`trace → ${outPrefix}.trace.json`);
console.log("\n" + lines.join("\n") + "\n");
