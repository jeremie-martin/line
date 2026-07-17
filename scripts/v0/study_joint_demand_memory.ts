/**
 * Read-only test of whether an authored multi-contact demand integral precedes
 * speed-and-impact failure onset in the accepted V2 development archive.
 *
 *   npx tsx scripts/v0/study_joint_demand_memory.ts \
 *     --out=generated/studies/joint-demand-memory/v1/result.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";

const ARCHIVE = "benchmark/v2/runs/2026-07-16T16-45-07Z-8257f266-development.json.gz";
const BUDGET = 500_000;
const HORIZON_SECONDS = 2;
const DECAY_SECONDS = 1;
const IMPACT_UNDERSHOOT = 0.15;
const SPEED_UNDERSHOOT_PX_PER_FRAME = 0.1;

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: study_joint_demand_memory.ts [--out=generated/studies/joint-demand-memory/v1/result.json]\n");
  process.exit(0);
}
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = argument("out");
const unknown = argv.filter((value) => !value.startsWith("--out="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);

type Axis = { target?: number; achieved?: number; raw?: { target?: number; achieved?: number } };
type GapReport = { gap_index: number; t_end: number; axes: { air?: Axis; speed?: Axis; impact?: Axis } };
type ArchiveRun = {
  status: string;
  task: { sourceId: string; budget: number; actualSeed: number };
  score: { valid: boolean };
  report: { gaps: GapReport[] };
};
type Archive = { schema: string; runs: ArchiveRun[] };
type Observation = {
  sourceId: string;
  seed: number;
  gapIndex: number;
  currentDemand: number;
  forwardDemand: number;
  bothBad: boolean;
  onset: boolean;
};

const archive = JSON.parse(gunzipSync(readFileSync(ARCHIVE)).toString("utf8")) as Archive;
if (archive.schema !== "line.benchmark-v2.run-archive.v5") throw new Error(`unexpected archive schema ${archive.schema}`);
const selectedRuns = archive.runs.filter((run) =>
  run.status === "ok" && run.score.valid && run.task.budget === BUDGET
);
if (selectedRuns.length === 0) throw new Error("accepted archive contains no valid 500k runs");

const observations = selectedRuns.flatMap(observationsFromRun);
const result = {
  schema: "line.study-joint-demand-memory.v1",
  purpose: [
    "read-only test of a prospective authored two-second speed-impact-air demand signal",
    "both-bad onset is defined without the future integral: impact undershoot >=0.15 and raw speed undershoot >0.1 px/frame after a non-both-bad contact",
    "no compiler behavior, target, rank, or evaluation was changed",
  ],
  frozenConfig: {
    archive: ARCHIVE,
    budget: BUDGET,
    validRuns: selectedRuns.length,
    horizonSeconds: HORIZON_SECONDS,
    decaySeconds: DECAY_SECONDS,
    jointDemand: "sum(exp(-deltaTime / 1s) * speedTarget * impactTarget * airTarget) over subsequent contacts within 2s",
    onset: { impactUndershoot: IMPACT_UNDERSHOOT, rawSpeedUndershootPxPerFrame: SPEED_UNDERSHOOT_PX_PER_FRAME },
  },
  summary: {
    all: summarizePopulation(observations),
    denseDialogue: summarizePopulation(observations.filter((row) => row.sourceId === "dense_dialogue")),
    believer: summarizePopulation(observations.filter((row) => row.sourceId === "believer_56_6s")),
    currentDemandControlled: currentDemandContrasts(observations),
  },
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function observationsFromRun(run: ArchiveRun): Observation[] {
  const gaps = run.report.gaps;
  const bothBad = gaps.map(isBothBad);
  return gaps.map((gap, index) => {
    const currentDemand = jointDemandOf(gap);
    let forwardDemand = 0;
    for (let later = index + 1; later < gaps.length; later++) {
      const dt = gaps[later].t_end - gap.t_end;
      if (dt > HORIZON_SECONDS) break;
      forwardDemand += Math.exp(-dt / DECAY_SECONDS) * jointDemandOf(gaps[later]);
    }
    return {
      sourceId: run.task.sourceId,
      seed: run.task.actualSeed,
      gapIndex: gap.gap_index,
      currentDemand,
      forwardDemand,
      bothBad: bothBad[index],
      onset: bothBad[index] && (index === 0 || !bothBad[index - 1]),
    };
  });
}

function jointDemandOf(gap: GapReport): number {
  const speed = finiteOrZero(gap.axes.speed?.target);
  const impact = finiteOrZero(gap.axes.impact?.target);
  const air = finiteOrZero(gap.axes.air?.target);
  return speed * impact * air;
}

function isBothBad(gap: GapReport): boolean {
  const impact = gap.axes.impact;
  const speed = gap.axes.speed;
  const impactUndershoot = finiteOrNull(impact?.target) !== null && finiteOrNull(impact?.achieved) !== null &&
    impact!.target! - impact!.achieved! >= IMPACT_UNDERSHOOT;
  const raw = speed?.raw;
  const speedUndershoot = finiteOrNull(raw?.target) !== null && finiteOrNull(raw?.achieved) !== null &&
    raw!.target! - raw!.achieved! > SPEED_UNDERSHOOT_PX_PER_FRAME;
  return impactUndershoot && speedUndershoot;
}

function summarizePopulation(rows: readonly Observation[]) {
  const withFuture = rows.filter((row) => Number.isFinite(row.forwardDemand));
  const quartiles = quartileCutoffs(withFuture.map((row) => row.forwardDemand));
  const low = withFuture.filter((row) => row.forwardDemand <= quartiles.q1);
  const high = withFuture.filter((row) => row.forwardDemand >= quartiles.q3);
  const onsetRateLow = rate(low);
  const onsetRateHigh = rate(high);
  return {
    observations: rows.length,
    bothBad: rows.filter((row) => row.bothBad).length,
    onsets: rows.filter((row) => row.onset).length,
    forwardDemandQuartiles: quartiles,
    lowQuartile: onsetSummary(low),
    highQuartile: onsetSummary(high),
    highToLowOnsetRateRatio: ratio(onsetRateHigh, onsetRateLow),
  };
}

function currentDemandContrasts(rows: readonly Observation[]) {
  const current = quartileCutoffs(rows.map((row) => row.currentDemand));
  return [
    { label: "q1", rows: rows.filter((row) => row.currentDemand <= current.q1) },
    { label: "q2", rows: rows.filter((row) => row.currentDemand > current.q1 && row.currentDemand <= current.q2) },
    { label: "q3", rows: rows.filter((row) => row.currentDemand > current.q2 && row.currentDemand <= current.q3) },
    { label: "q4", rows: rows.filter((row) => row.currentDemand > current.q3) },
  ].map(({ label, rows: stratum }) => {
    const future = quartileCutoffs(stratum.map((row) => row.forwardDemand));
    const low = stratum.filter((row) => row.forwardDemand <= future.q1);
    const high = stratum.filter((row) => row.forwardDemand >= future.q3);
    return {
      currentDemandQuartile: label,
      observations: stratum.length,
      forwardDemandQuartiles: future,
      low: onsetSummary(low),
      high: onsetSummary(high),
      highToLowOnsetRateRatio: ratio(rate(high), rate(low)),
    };
  });
}

function onsetSummary(rows: readonly Observation[]) {
  const onsets = rows.filter((row) => row.onset).length;
  return { observations: rows.length, onsets, onsetRate: round(rate(rows)) };
}

function quartileCutoffs(values: readonly number[]) {
  if (values.length === 0) return { q1: 0, q2: 0, q3: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
  return { q1: round(at(0.25)), q2: round(at(0.5)), q3: round(at(0.75)) };
}

function rate(rows: readonly Observation[]): number {
  return rows.length === 0 ? 0 : rows.filter((row) => row.onset).length / rows.length;
}
function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round(numerator / denominator);
}
function finiteOrZero(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function finiteOrNull(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
