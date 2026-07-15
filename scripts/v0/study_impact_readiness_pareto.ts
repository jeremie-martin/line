/**
 * Observation-only current-impact / next-readiness Pareto study.
 *
 * For every exact SearchNode pool, measure how much current-impact error can be
 * removed without giving up more than a bounded amount of the forward winner's
 * predicted next-contact readiness. This distinguishes an admission/ranking
 * problem (joint candidates already exist) from a generation problem.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import {
  compileHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
  type HandoffPoolProbeRecord,
} from "./optimizer/handoff.ts";
import { AXES, type AxisValues } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const defaultSpecs = [
  "solo_run",
  "drums_dropout",
  "drums_pulse",
  "drums_swell",
  "drums_tide",
  "drums_signature",
].join(",");
const specs = (argValue("specs") ?? defaultSpecs).split(",");
const seeds = (argValue("seeds") ?? "0,1,2").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const outPath = argValue("out");
const benchmarkSpecs = new Map(
  developmentCases.map((entry) => [entry.case.metadata.id, entry.case.spec] as const),
);
for (const spec of specs) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec) && !benchmarkSpecs.has(spec)) {
    throw new Error(`unknown spec "${spec}"`);
  }
}

async function loadStudySpec(name: string) {
  const benchmarkSpec = benchmarkSpecs.get(name);
  return benchmarkSpec === undefined
    ? loadGoldenSpec(name as GoldenSpecName, "base")
    : applyJolt(benchmarkSpec, benchmarkPolicy.transform.joltMs);
}

const readinessAllowances = [0, 0.025, 0.05, 0.10, 0.20, 0.30] as const;
type CandidateSummary = {
  impactError: number;
  currentQuality: number;
  scorerWindowRms: number;
  readiness: number;
  arrivalAngleDeg: number | null;
  arrivalSpeed: number | null;
  releaseVy: number | null;
  admitted: boolean;
  handoffScore: number | null;
  handoffRank: number | null;
};
type Row = {
  spec: string;
  seed: number;
  pool: number;
  gapIndex: number;
  target: number;
  candidates: number;
  winner: CandidateSummary;
  specialist: CandidateSummary;
  constrained: Record<string, CandidateSummary | null>;
};

let activeSpec = "";
let activeSeed = 0;
let pool = 0;
const rows: Row[] = [];

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function impactOf(candidate: HandoffPoolProbeCandidate): number | null {
  const axes = candidate.achievedAtEnd ?? candidate.achieved;
  return finite(axes.impact) ? axes.impact : null;
}

function scorerWindowRms(candidate: HandoffPoolProbeCandidate, targets: AxisValues): number {
  const achieved = candidate.achievedAtEnd ?? candidate.achieved;
  const errors = AXES.flatMap((axis) => {
    const target = targets[axis];
    const value = achieved[axis];
    return finite(target) && finite(value) ? [value - target] : [];
  });
  return errors.length === 0
    ? Infinity
    : Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length);
}

function summarize(
  candidate: HandoffPoolProbeCandidate,
  target: number,
  targets: AxisValues,
  handoffRanks: Map<HandoffPoolProbeCandidate, number>,
): CandidateSummary {
  return {
    impactError: Math.abs(impactOf(candidate)! - target),
    currentQuality: candidate.currentQuality,
    scorerWindowRms: scorerWindowRms(candidate, targets),
    readiness: candidate.readiness!,
    arrivalAngleDeg: candidate.arrivalAngleDeg,
    arrivalSpeed: candidate.arrivalSpeed,
    releaseVy: candidate.releaseVy,
    admitted: candidate.admitted,
    handoffScore: finite(candidate.handoffScore) ? candidate.handoffScore : null,
    handoffRank: handoffRanks.get(candidate) ?? null,
  };
}

function minImpactError(
  candidates: HandoffPoolProbeCandidate[],
  target: number,
): HandoffPoolProbeCandidate {
  return candidates.reduce((best, candidate) =>
    Math.abs(impactOf(candidate)! - target) < Math.abs(impactOf(best)! - target)
      ? candidate
      : best
  );
}

setHandoffPoolProbeHook((record: HandoffPoolProbeRecord) => {
  const poolIndex = pool++;
  const target = record.targets.impact;
  if (target === undefined || record.nextTargets === null) return;
  const candidates = record.candidates.filter(
    (candidate) => finite(impactOf(candidate)) && finite(candidate.readiness),
  );
  const scored = candidates.filter((candidate) => finite(candidate.handoffScore));
  if (candidates.length === 0 || scored.length === 0) return;
  const scoredOrder = [...scored].sort((a, b) => a.handoffScore! - b.handoffScore!);
  const handoffRanks = new Map(scoredOrder.map((candidate, index) => [candidate, index]));
  const winner = scoredOrder[0];
  const specialist = minImpactError(candidates, target);
  const constrained: Record<string, CandidateSummary | null> = {};
  for (const allowance of readinessAllowances) {
    const eligible = candidates.filter(
      (candidate) => candidate.readiness! >= winner.readiness! - allowance,
    );
    constrained[String(allowance)] = eligible.length === 0
      ? null
      : summarize(minImpactError(eligible, target), target, record.targets, handoffRanks);
  }
  rows.push({
    spec: activeSpec,
    seed: activeSeed,
    pool: poolIndex,
    gapIndex: record.gapIndex,
    target,
    candidates: candidates.length,
    winner: summarize(winner, target, record.targets, handoffRanks),
    specialist: summarize(specialist, target, record.targets, handoffRanks),
    constrained,
  });
});

for (const spec of specs) {
  const loaded = await loadStudySpec(spec);
  for (const seed of seeds) {
    activeSpec = spec;
    activeSeed = seed;
    const before = rows.length;
    const started = Date.now();
    compileHandoff(loaded, seed, { budget });
    console.error(
      `  ${spec}/s${seed}: ${rows.length - before} pools, ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}
setHandoffPoolProbeHook(null);

const mean = (values: number[]): number =>
  values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
const f3 = (value: number): string => Number.isFinite(value) ? value.toFixed(3) : "n/a";
const material = 0.025;

console.log(`\n=== impact/readiness Pareto (${rows.length} exact-prefix pools) ===`);
console.log(
  `winner impact error ${f3(mean(rows.map((row) => row.winner.impactError)))}, ` +
    `specialist ${f3(mean(rows.map((row) => row.specialist.impactError)))}`,
);
for (const allowance of readinessAllowances) {
  const available = rows.flatMap((row) => {
    const candidate = row.constrained[String(allowance)];
    return candidate === null ? [] : [{ row, candidate }];
  });
  const improved = available.filter(
    ({ row, candidate }) => candidate.impactError + material < row.winner.impactError,
  );
  console.log(
    `readiness loss <= ${allowance.toFixed(3)}: ` +
      `impact error ${f3(mean(available.map(({ candidate }) => candidate.impactError)))}, ` +
      `material wins ${improved.length}/${available.length}, ` +
      `arrival angle ${f3(mean(available.flatMap(({ candidate }) =>
        finite(candidate.arrivalAngleDeg) ? [candidate.arrivalAngleDeg] : []
      )))}, scorer RMS ${f3(mean(available.map(({ candidate }) => candidate.scorerWindowRms)))}, ` +
      `admitted ${f3(mean(available.map(({ candidate }) => candidate.admitted ? 1 : 0)))}, ` +
      `branch-3 ${f3(mean(available.map(({ candidate }) =>
        candidate.handoffRank !== null && candidate.handoffRank < 3 ? 1 : 0
      )))}`,
  );
}

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify({ budget, specs, seeds, readinessAllowances, rows }, null, 2) + "\n",
  );
  console.log(`\nrows -> ${outPath}`);
}
