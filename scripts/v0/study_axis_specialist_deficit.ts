/** Observation-only comparison of axis specialists within exact candidate pools. */
import { writeFileSync } from "node:fs";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import {
  compileHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
  type HandoffPoolProbeRecord,
} from "./optimizer/handoff.ts";
import { AXES, type AxisName, type AxisValues } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const argFlag = (name: string): boolean => argv.includes(`--${name}`);
const axis = (argValue("axis") ?? "elevation") as AxisName;
if (!(AXES as readonly string[]).includes(axis)) throw new Error(`unknown axis "${axis}"`);
const nextGap = argFlag("next");
if (nextGap && axis !== "elevation") {
  throw new Error(`--next currently requires --axis=elevation`);
}
const defaultSpecs = [
  "climb_terrace", "swoop_dive", "rolling_hills", "summit_push", "mixed_grade",
  "canyon_steps", "ridge_pulse", "valley_bounce", "switchback_pop", "terrace_sprint",
  "glide_stairs", "dense_echo_climb", "rolling_drop", "skyline_push", "syncopated_lift",
].join(",");
const specs = (argValue("specs") ?? defaultSpecs).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const minAdvantage = Number(argValue("min-advantage") ?? "0.025");
const outPath = argValue("out");
for (const spec of specs) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) throw new Error(`unknown spec "${spec}"`);
}

type CandidateSummary = {
  qualityRank: number;
  admitted: boolean;
  handoffScore: number | null;
  qualityObjective: number | null;
  currentQuality: number | null;
  readiness: number | null;
  catchability: number | null;
  speedFit: number | null;
  impactFeasibility: number | null;
  airFit: number | null;
  elevationFit: number | null;
  axes: AxisValues;
  axisValue: number;
  axisError: number;
};

type Row = {
  spec: string;
  seed: number;
  pool: number;
  gapIndex: number;
  target: number;
  viableCandidates: number;
  admittedCandidates: number;
  winner: CandidateSummary;
  admittedSpecialist: CandidateSummary;
  proposedSpecialist: CandidateSummary;
};

const rows: Row[] = [];
let activeSpec = "";
let activeSeed = 0;
let poolCount = 0;

const axesOf = (candidate: HandoffPoolProbeCandidate): AxisValues =>
  candidate.achievedAtEnd ?? candidate.achieved;

function candidateAxisValue(candidate: HandoffPoolProbeCandidate): number | null {
  const value = nextGap ? candidate.arrivalElevation : axesOf(candidate)[axis];
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function summary(candidate: HandoffPoolProbeCandidate, target: number): CandidateSummary {
  const axes = axesOf(candidate);
  const axisValue = candidateAxisValue(candidate)!;
  return {
    qualityRank: candidate.qualityRank,
    admitted: candidate.admitted,
    handoffScore: candidate.handoffScore ?? null,
    qualityObjective: candidate.qualityObjective,
    currentQuality: candidate.currentQuality,
    readiness: candidate.readiness,
    catchability: candidate.catchability,
    speedFit: candidate.speedFit,
    impactFeasibility: candidate.impactFeasibility,
    airFit: candidate.airFit,
    elevationFit: candidate.elevationFit,
    axes,
    axisValue,
    axisError: Math.abs(axisValue - target),
  };
}

function minBy<T>(values: T[], value: (item: T) => number): T {
  return values.reduce((best, item) => value(item) < value(best) ? item : best);
}

setHandoffPoolProbeHook((record: HandoffPoolProbeRecord) => {
  const pool = poolCount++;
  const target = nextGap ? record.nextTargets?.[axis] : record.targets[axis];
  if (target === undefined) return;
  const viable = record.candidates.filter((candidate) => candidateAxisValue(candidate) !== null);
  const admitted = viable.filter((candidate) => Number.isFinite(candidate.handoffScore));
  if (viable.length === 0 || admitted.length === 0) return;
  const winner = minBy(admitted, (candidate) => candidate.handoffScore!);
  const admittedSpecialist = minBy(admitted, (candidate) => Math.abs(candidateAxisValue(candidate)! - target));
  const proposedSpecialist = minBy(viable, (candidate) => Math.abs(candidateAxisValue(candidate)! - target));
  const winnerError = Math.abs(candidateAxisValue(winner)! - target);
  if (Math.min(
    Math.abs(candidateAxisValue(admittedSpecialist)! - target),
    Math.abs(candidateAxisValue(proposedSpecialist)! - target),
  ) + minAdvantage >= winnerError) return;
  rows.push({
    spec: activeSpec,
    seed: activeSeed,
    pool,
    gapIndex: record.gapIndex,
    target,
    viableCandidates: viable.length,
    admittedCandidates: admitted.length,
    winner: summary(winner, target),
    admittedSpecialist: summary(admittedSpecialist, target),
    proposedSpecialist: summary(proposedSpecialist, target),
  });
});

for (const specName of specs) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    activeSpec = specName;
    activeSeed = seed;
    const before = rows.length;
    const started = Date.now();
    compileHandoff(spec, seed, { budget });
    console.error(
      `  ${specName}/s${seed}: ${rows.length - before} opportunities, ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}
setHandoffPoolProbeHook(null);

const finitePairs = (
  select: (candidate: CandidateSummary) => number | null,
  specialist: "admittedSpecialist" | "proposedSpecialist",
): [number, number][] => rows.flatMap((row) => {
  const a = select(row.winner);
  const b = select(row[specialist]);
  return a !== null && Number.isFinite(a) && b !== null && Number.isFinite(b) ? [[a, b]] : [];
});
const mean = (values: number[]): number =>
  values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
const f3 = (value: number): string => Number.isFinite(value) ? value.toFixed(3) : "n/a";

console.log(
  `\n=== ${nextGap ? "next " : ""}${axis} specialist deficit ` +
    `(${rows.length} exact-prefix opportunities) ===`,
);
for (const specialist of ["admittedSpecialist", "proposedSpecialist"] as const) {
  console.log(`\n${specialist}:`);
  const metrics: [string, (candidate: CandidateSummary) => number | null][] = [
    ["axisError", (candidate) => candidate.axisError],
    ["axisValue", (candidate) => candidate.axisValue],
    ["qualityRank", (candidate) => candidate.qualityRank],
    ["currentQuality", (candidate) => candidate.currentQuality],
    ["readiness", (candidate) => candidate.readiness],
    ["catchability", (candidate) => candidate.catchability],
    ["speedFit", (candidate) => candidate.speedFit],
    ["impactFeasibility", (candidate) => candidate.impactFeasibility],
    ["airFit", (candidate) => candidate.airFit],
    ["elevationFit", (candidate) => candidate.elevationFit],
  ];
  for (const [name, select] of metrics) {
    const pairs = finitePairs(select, specialist);
    console.log(
      `${name.padEnd(20)} n=${String(pairs.length).padStart(5)} ` +
        `${f3(mean(pairs.map(([value]) => value)))} -> ` +
        `${f3(mean(pairs.map(([, value]) => value)))}`,
    );
  }
  for (const otherAxis of AXES) {
    const pairs = finitePairs(
      (candidate) => candidate.axes[otherAxis] ?? null,
      specialist,
    );
    if (pairs.length === 0) continue;
    console.log(
      `${(`axis.${otherAxis}`).padEnd(20)} n=${String(pairs.length).padStart(5)} ` +
        `${f3(mean(pairs.map(([value]) => value)))} -> ` +
        `${f3(mean(pairs.map(([, value]) => value)))}`,
    );
  }
}

if (outPath !== undefined) {
  writeFileSync(
    outPath,
    JSON.stringify({ axis, nextGap, budget, minAdvantage, specs, seeds, rows }, null, 2) + "\n",
  );
  console.log(`\nrows -> ${outPath}`);
}
