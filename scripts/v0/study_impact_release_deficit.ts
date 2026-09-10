/**
 * Observation-only study of the state tradeoff behind current-impact specialists.
 * Candidates are compared only within one exact SearchNode pool.
 */
import { writeFileSync } from "node:fs";
import {
  compileLegacyHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
  type HandoffPoolProbeRecord,
} from "./optimizer/legacy_handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import type { AxisValues } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const defaultSpecs = "drums_dropout,drums_pulse,dense_echo_climb,solo_run";
const specNames = (argValue("specs") ?? defaultSpecs).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const outPath = argValue("out");
for (const spec of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) throw new Error(`unknown spec "${spec}"`);
}

type CandidateState = Pick<
  HandoffPoolProbeCandidate,
  | "currentQuality"
  | "readiness"
  | "catchability"
  | "speedFit"
  | "impactFeasibility"
  | "airFit"
  | "elevationFit"
  | "releaseFrame"
  | "releaseSpeed"
  | "releaseVx"
  | "releaseVy"
  | "releaseGrounded"
  | "releaseAirborne"
  | "arrivalSpeed"
  | "arrivalAngleDeg"
  | "arrivalAir"
  | "arrivalGapFrames"
  | "arrivalElevation"
> & {
  impact: number;
  impactError: number;
  handoffScore: number | null;
};

type DeficitRow = {
  spec: string;
  seed: number;
  pool: number;
  gapIndex: number;
  impactTarget: number;
  nextTargets: AxisValues | null;
  viableCandidates: number;
  scoredCandidates: number;
  winner: CandidateState;
  specialist: CandidateState;
};

const rows: DeficitRow[] = [];
let activeSpec = "";
let activeSeed = 0;
let poolCount = 0;

const axesOf = (candidate: HandoffPoolProbeCandidate): AxisValues =>
  candidate.achieved;

function stateOf(candidate: HandoffPoolProbeCandidate, target: number): CandidateState {
  const impact = axesOf(candidate).impact!;
  return {
    impact,
    impactError: Math.abs(impact - target),
    handoffScore: candidate.handoffScore ?? null,
    currentQuality: candidate.currentQuality,
    readiness: candidate.readiness,
    catchability: candidate.catchability,
    speedFit: candidate.speedFit,
    impactFeasibility: candidate.impactFeasibility,
    airFit: candidate.airFit,
    elevationFit: candidate.elevationFit,
    releaseFrame: candidate.releaseFrame,
    releaseSpeed: candidate.releaseSpeed,
    releaseVx: candidate.releaseVx,
    releaseVy: candidate.releaseVy,
    releaseGrounded: candidate.releaseGrounded,
    releaseAirborne: candidate.releaseAirborne,
    arrivalSpeed: candidate.arrivalSpeed,
    arrivalAngleDeg: candidate.arrivalAngleDeg,
    arrivalAir: candidate.arrivalAir,
    arrivalGapFrames: candidate.arrivalGapFrames,
    arrivalElevation: candidate.arrivalElevation,
  };
}

setHandoffPoolProbeHook((record: HandoffPoolProbeRecord) => {
  const pool = poolCount++;
  const target = record.targets.impact;
  if (target === undefined || record.nextTargets === null) return;
  const viable = record.candidates.filter((candidate) => Number.isFinite(axesOf(candidate).impact));
  const scored = viable.filter((candidate) => Number.isFinite(candidate.handoffScore));
  if (viable.length === 0 || scored.length === 0) return;
  const winner = scored.reduce((best, candidate) =>
    candidate.handoffScore! < best.handoffScore! ? candidate : best
  );
  const specialist = viable.reduce((best, candidate) =>
    Math.abs(axesOf(candidate).impact! - target) < Math.abs(axesOf(best).impact! - target)
      ? candidate
      : best
  );
  if (Math.abs(axesOf(specialist).impact! - target) + 0.025 >= Math.abs(axesOf(winner).impact! - target)) {
    return;
  }
  rows.push({
    spec: activeSpec,
    seed: activeSeed,
    pool,
    gapIndex: record.gapIndex,
    impactTarget: target,
    nextTargets: record.nextTargets,
    viableCandidates: viable.length,
    scoredCandidates: scored.length,
    winner: stateOf(winner, target),
    specialist: stateOf(specialist, target),
  });
});

for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    activeSpec = specName;
    activeSeed = seed;
    const before = rows.length;
    const started = Date.now();
    compileLegacyHandoff(spec, seed, { budget });
    console.error(
      `  ${specName}/s${seed}: ${rows.length - before} opportunities, ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}
setHandoffPoolProbeHook(null);

const finitePairs = (key: keyof CandidateState): [number, number][] =>
  rows.flatMap((row) => {
    const a = row.winner[key];
    const b = row.specialist[key];
    return typeof a === "number" && Number.isFinite(a) && typeof b === "number" && Number.isFinite(b)
      ? [[a, b]]
      : [];
  });
const mean = (values: number[]): number =>
  values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
const f3 = (value: number): string => Number.isFinite(value) ? value.toFixed(3) : "n/a";

console.log(`\n=== impact specialist release deficit (${rows.length} exact-prefix opportunities) ===`);
for (const key of [
  "impactError",
  "currentQuality",
  "readiness",
  "catchability",
  "speedFit",
  "impactFeasibility",
  "airFit",
  "elevationFit",
  "releaseFrame",
  "releaseSpeed",
  "releaseVx",
  "releaseVy",
  "releaseGrounded",
  "arrivalSpeed",
  "arrivalAngleDeg",
  "arrivalAir",
  "arrivalGapFrames",
  "arrivalElevation",
] as const) {
  const pairs = finitePairs(key);
  console.log(
    `${key.padEnd(22)} n=${String(pairs.length).padStart(4)} ` +
      `${f3(mean(pairs.map(([value]) => value)))} -> ${f3(mean(pairs.map(([, value]) => value)))}`,
  );
}

if (outPath !== undefined) {
  writeFileSync(outPath, JSON.stringify({ budget, specs: specNames, seeds, rows }, null, 2) + "\n");
  console.log(`\nrows -> ${outPath}`);
}
