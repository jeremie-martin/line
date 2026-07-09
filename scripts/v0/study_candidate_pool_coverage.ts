/**
 * Candidate-pool coverage study (observation only).
 *
 * Every row compares candidates produced from one exact SearchNode prefix. It
 * separates quality-sort admission from handoff selection without combining
 * candidates that reached the same authored gap through different states.
 */
import { writeFileSync } from "node:fs";
import {
  compileHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
  type HandoffPoolProbeRecord,
} from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { AXES, type AxisName, type AxisValues } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_SPECS = [
  "drums_dropout",
  "drums_pulse",
  "drums_signature",
  "skyline_push",
  "terrace_sprint",
  "dense_echo_climb",
  "syncopated_lift",
  "rolling_drop",
].join(",");
const specNames = (argValue("specs") ?? DEFAULT_SPECS).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1,2").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const outPath = argValue("out");
for (const spec of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) throw new Error(`unknown spec "${spec}"`);
}

type CoverageRow = {
  spec: string;
  seed: number;
  pool: number;
  gapIndex: number;
  axis: AxisName;
  target: number;
  viableCandidates: number;
  scoredCandidates: number;
  winnerAbsError: number;
  bestViableAbsError: number;
  bestScoredAbsError: number;
  winnerAxisRms: number;
  bestViableCandidateAxisRms: number;
  bestScoredCandidateAxisRms: number;
  bestCurrentQualityAdmitted: boolean;
  winnerQualityObjective: number | null;
  bestViableQualityObjective: number | null;
  winnerCurrentQuality: number;
  bestViableCurrentQuality: number;
  winnerReadiness: number | null;
  bestViableReadiness: number | null;
  winnerCatchability: number | null;
  bestViableCatchability: number | null;
  winnerSpeedFit: number | null;
  bestViableSpeedFit: number | null;
  winnerImpactFeasibility: number | null;
  bestViableImpactFeasibility: number | null;
  winnerAirFit: number | null;
  bestViableAirFit: number | null;
  winnerElevationFit: number | null;
  bestViableElevationFit: number | null;
};

const rows: CoverageRow[] = [];
let activeSpec = "";
let activeSeed = 0;
let poolCount = 0;

const axesOf = (candidate: HandoffPoolProbeCandidate): AxisValues =>
  candidate.achievedAtEnd ?? candidate.achieved;

function axisRms(candidate: HandoffPoolProbeCandidate, targets: AxisValues): number {
  const achieved = axesOf(candidate);
  const squared: number[] = [];
  for (const axis of AXES) {
    const target = targets[axis];
    const value = achieved[axis];
    if (target !== undefined && value !== undefined && Number.isFinite(value)) {
      squared.push((value - target) ** 2);
    }
  }
  return squared.length === 0
    ? Infinity
    : Math.sqrt(squared.reduce((sum, value) => sum + value, 0) / squared.length);
}

setHandoffPoolProbeHook((record: HandoffPoolProbeRecord) => {
  const pool = poolCount++;
  const scored = record.candidates.filter(
    (candidate): candidate is HandoffPoolProbeCandidate & { handoffScore: number } =>
      candidate.handoffScore !== undefined && Number.isFinite(candidate.handoffScore),
  );
  if (scored.length === 0) return;
  const winner = scored.reduce((best, candidate) =>
    candidate.handoffScore < best.handoffScore ? candidate : best
  );
  const bestCurrentQuality = record.candidates.reduce((best, candidate) =>
    axisRms(candidate, record.targets) < axisRms(best, record.targets) ? candidate : best
  );

  for (const axis of AXES) {
    const target = record.targets[axis];
    if (target === undefined) continue;
    const withError = (candidates: HandoffPoolProbeCandidate[]) => candidates
      .map((candidate) => ({
        candidate,
        error: Math.abs((axesOf(candidate)[axis] ?? Infinity) - target),
      }))
      .filter((entry) => Number.isFinite(entry.error));
    const viable = withError(record.candidates);
    const admitted = withError(scored);
    if (viable.length === 0 || admitted.length === 0) continue;
    const bestViable = viable.reduce((best, entry) => entry.error < best.error ? entry : best);
    const bestScored = admitted.reduce((best, entry) => entry.error < best.error ? entry : best);
    rows.push({
      spec: activeSpec,
      seed: activeSeed,
      pool,
      gapIndex: record.gapIndex,
      axis,
      target,
      viableCandidates: viable.length,
      scoredCandidates: admitted.length,
      winnerAbsError: Math.abs((axesOf(winner)[axis] ?? Infinity) - target),
      bestViableAbsError: bestViable.error,
      bestScoredAbsError: bestScored.error,
      winnerAxisRms: axisRms(winner, record.targets),
      bestViableCandidateAxisRms: axisRms(bestViable.candidate, record.targets),
      bestScoredCandidateAxisRms: axisRms(bestScored.candidate, record.targets),
      bestCurrentQualityAdmitted: bestCurrentQuality.admitted,
      winnerQualityObjective: winner.qualityObjective,
      bestViableQualityObjective: bestViable.candidate.qualityObjective,
      winnerCurrentQuality: winner.currentQuality,
      bestViableCurrentQuality: bestViable.candidate.currentQuality,
      winnerReadiness: winner.readiness,
      bestViableReadiness: bestViable.candidate.readiness,
      winnerCatchability: winner.catchability,
      bestViableCatchability: bestViable.candidate.catchability,
      winnerSpeedFit: winner.speedFit,
      bestViableSpeedFit: bestViable.candidate.speedFit,
      winnerImpactFeasibility: winner.impactFeasibility,
      bestViableImpactFeasibility: bestViable.candidate.impactFeasibility,
      winnerAirFit: winner.airFit,
      bestViableAirFit: bestViable.candidate.airFit,
      winnerElevationFit: winner.elevationFit,
      bestViableElevationFit: bestViable.candidate.elevationFit,
    });
  }
});

for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    activeSpec = specName;
    activeSeed = seed;
    const beforePools = poolCount;
    const beforeRows = rows.length;
    const started = Date.now();
    compileHandoff(spec, seed, { budget });
    console.error(
      `  ${specName}/s${seed}: ${poolCount - beforePools} pools, ${rows.length - beforeRows} axis rows, ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}
setHandoffPoolProbeHook(null);

const mean = (values: number[]): number =>
  values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
const f3 = (value: number): string => Number.isFinite(value) ? value.toFixed(3) : "n/a";
const material = 0.025;

console.log(`\n=== per-prefix candidate pool coverage (budget ${budget}, ${specNames.length} specs x ${seeds.length} seeds) ===`);
for (const axis of AXES) {
  const axisRows = rows.filter((row) => row.axis === axis);
  if (axisRows.length === 0) continue;
  const generationOpportunity = axisRows.filter(
    (row) => row.bestViableAbsError + material < row.winnerAbsError,
  );
  const poolOpportunity = axisRows.filter(
    (row) => row.bestViableAbsError + material < row.bestScoredAbsError,
  );
  const selectionOpportunity = axisRows.filter(
    (row) => row.bestScoredAbsError + material < row.winnerAbsError,
  );
  const viableSpecialistNetGain = generationOpportunity.filter(
    (row) => row.bestViableCandidateAxisRms < row.winnerAxisRms,
  );
  const scoredSpecialistNetGain = selectionOpportunity.filter(
    (row) => row.bestScoredCandidateAxisRms < row.winnerAxisRms,
  );
  const currentWinnerAdmissionRate = mean(axisRows.map((row) => row.bestCurrentQualityAdmitted ? 1 : 0));
  console.log(
    `${axis.padEnd(10)} rows=${String(axisRows.length).padStart(6)}` +
      ` winner=${f3(mean(axisRows.map((row) => row.winnerAbsError)))}` +
      ` viable=${f3(mean(axisRows.map((row) => row.bestViableAbsError)))}` +
      ` scored=${f3(mean(axisRows.map((row) => row.bestScoredAbsError)))}` +
      ` opportunities generated/pool/selection=` +
      `${generationOpportunity.length}/${poolOpportunity.length}/${selectionOpportunity.length}` +
      ` · locally net-positive viable/scored=${viableSpecialistNetGain.length}/${scoredSpecialistNetGain.length}` +
      ` · current-quality winner admitted=${f3(currentWinnerAdmissionRate)}`,
  );
  if (axis === "impact" && generationOpportunity.length > 0) {
    const pairedMean = (key: keyof CoverageRow): number => mean(
      generationOpportunity.map((row) => row[key]).filter((value): value is number =>
        typeof value === "number" && Number.isFinite(value)
      ),
    );
    console.log(
      `  impact opportunity winner->specialist:` +
        ` current=${f3(pairedMean("winnerCurrentQuality"))}->${f3(pairedMean("bestViableCurrentQuality"))}` +
        ` readiness=${f3(pairedMean("winnerReadiness"))}->${f3(pairedMean("bestViableReadiness"))}` +
        ` catch=${f3(pairedMean("winnerCatchability"))}->${f3(pairedMean("bestViableCatchability"))}` +
        ` speed=${f3(pairedMean("winnerSpeedFit"))}->${f3(pairedMean("bestViableSpeedFit"))}` +
        ` nextImpact=${f3(pairedMean("winnerImpactFeasibility"))}->${f3(pairedMean("bestViableImpactFeasibility"))}` +
        ` air=${f3(pairedMean("winnerAirFit"))}->${f3(pairedMean("bestViableAirFit"))}` +
        ` elevation=${f3(pairedMean("winnerElevationFit"))}->${f3(pairedMean("bestViableElevationFit"))}`,
    );
  }
}

if (outPath !== undefined) {
  writeFileSync(outPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  console.log(`\nrows -> ${outPath}`);
}
