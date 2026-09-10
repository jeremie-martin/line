/**
 * Candidate-pool coverage study (observation only).
 *
 * Every row compares candidates produced from one exact SearchNode prefix. It
 * separates quality-sort admission from handoff selection without combining
 * candidates that reached the same authored gap through different states.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  compileLegacyHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
  type HandoffPoolProbeContactResponse,
  type HandoffPoolProbeRecord,
} from "./optimizer/legacy_handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { AXES, type AxisName, type AxisValues } from "./types.ts";
import type { PrecontactMulticontactHistoryReady } from "./trajectory/precontact_multicontact_history.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./benchmark_v2/model.ts";

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
const v2SourceNames = argValue("v2-sources")?.split(",").filter(Boolean) ?? [];
const seeds = (argValue("seeds") ?? "0,1,2").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const outPath = argValue("out");
const impactCandidatesOutPath = argValue("impact-candidates-out");
if (v2SourceNames.length === 0) {
  for (const spec of specNames) {
    if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) throw new Error(`unknown spec "${spec}"`);
  }
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
  winnerArrivalGapFrames: number | null;
  bestViableArrivalGapFrames: number | null;
  winnerResponse: ResponseHistory | null;
  bestViableResponse: ResponseHistory | null;
  precontactHistory: PrecontactMulticontactHistoryReady | null;
  impactEfficiency: ImpactEfficiency | null;
};

type ResponseHistory = {
  frameCount: number;
  contactedFrames: number;
  collectiveTurnDeg: number;
  poseTurnDeg: number;
  phaseSlipDeg: number;
  collectiveSpeedDelta: number;
  rmsPairDistanceChange: number;
  rmsRelativeVelocityChange: number;
};

type ImpactEfficiency = {
  materiallyBetter: number;
  locallyBetter: number;
  speedRetaining: number;
  deformationSafe: number;
  relativeMotionSafe: number;
  phaseCoherent: number;
  responseSafe: number;
  locallyBetterAndResponseSafe: number;
  bestSafeAbsError: number | null;
  bestSafeAdmitted: boolean | null;
  bestSafeAxisRms: number | null;
  bestSafeQualityRank: number | null;
  bestSafeCurrentQuality: number | null;
  bestSafeReadiness: number | null;
  bestSafeCatchability: number | null;
  bestSafeSpeedFit: number | null;
  bestSafeNextImpactFeasibility: number | null;
  bestSafeLineCount: number | null;
  bestSafeMeanSegmentLength: number | null;
  bestSafeTotalTurnDeg: number | null;
  safeWithinLocalTop1: boolean;
  safeWithinLocalTop3: boolean;
  safeWithinLocalTop5: boolean;
  safeWithinImpactTop1: boolean;
  safeWithinImpactTop3: boolean;
  safeWithinImpactTop5: boolean;
};

const rows: CoverageRow[] = [];
const impactCandidateRows: Array<Record<string, string | number | boolean | null>> = [];
let activeSpec = "";
let activeSeed = 0;
let poolCount = 0;
const material = 0.025;

function writeCheckpoints(): void {
  if (outPath !== undefined) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  }
  if (impactCandidatesOutPath !== undefined) {
    mkdirSync(dirname(impactCandidatesOutPath), { recursive: true });
    writeFileSync(
      impactCandidatesOutPath,
      impactCandidateRows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    );
  }
}

const axesOf = (candidate: HandoffPoolProbeCandidate): AxisValues =>
  candidate.achieved;

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

function responseHistory(response: HandoffPoolProbeContactResponse | null): ResponseHistory | null {
  if (response === null || response.samples.length < 2) return null;
  const snapshots = response.samples.map((sample) => {
    const points = SLED_POINTS.map((name) => sample.points[name]);
    if (points.some((point) =>
      point === undefined || point.vx === null || point.vy === null
    )) return null;
    const readable = points as Array<NonNullable<typeof points[number]>>;
    const center = {
      x: readable.reduce((sum, point) => sum + point.x / readable.length, 0),
      y: readable.reduce((sum, point) => sum + point.y / readable.length, 0),
    };
    const velocity = {
      x: readable.reduce((sum, point) => sum + point.vx! / readable.length, 0),
      y: readable.reduce((sum, point) => sum + point.vy! / readable.length, 0),
    };
    const relativeVelocities = readable.map((point) => ({
      x: point.vx! - velocity.x,
      y: point.vy! - velocity.y,
    }));
    const pairDistances: number[] = [];
    for (let left = 0; left < readable.length; left++) {
      for (let right = left + 1; right < readable.length; right++) {
        pairDistances.push(Math.hypot(
          readable[left]!.x - readable[right]!.x,
          readable[left]!.y - readable[right]!.y,
        ));
      }
    }
    const tail = readable[SLED_POINTS.indexOf("TAIL")]!;
    const nose = readable[SLED_POINTS.indexOf("NOSE")]!;
    return {
      center,
      velocity,
      relativeVelocities,
      pairDistances,
      pose: Math.atan2(nose.y - tail.y, nose.x - tail.x),
    };
  });
  if (snapshots.some((snapshot) => snapshot === null)) return null;
  const first = snapshots[0]!;
  const last = snapshots[snapshots.length - 1]!;
  if (first === null || last === null) return null;
  const collectiveTurnDeg = angleDeltaDeg(first.velocity, last.velocity);
  const poseTurnDeg = angleDeltaRad(first.pose, last.pose) * 180 / Math.PI;
  const rms = (values: readonly number[]) => Math.sqrt(
    values.reduce((sum, value) => sum + value * value / values.length, 0),
  );
  return {
    frameCount: response.samples.length,
    contactedFrames: response.samples.filter((sample) => sample.sledContacts.length > 0).length,
    collectiveTurnDeg,
    poseTurnDeg,
    phaseSlipDeg: poseTurnDeg - collectiveTurnDeg,
    collectiveSpeedDelta: Math.hypot(last.velocity.x, last.velocity.y) -
      Math.hypot(first.velocity.x, first.velocity.y),
    rmsPairDistanceChange: rms(last.pairDistances.map((distance, index) =>
      distance - first.pairDistances[index]!
    )),
    rmsRelativeVelocityChange: rms(last.relativeVelocities.map((velocity, index) =>
      Math.hypot(
        velocity.x - first.relativeVelocities[index]!.x,
        velocity.y - first.relativeVelocities[index]!.y,
      )
    )),
  };
}

function angleDeltaDeg(
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  return angleDeltaRad(Math.atan2(from.y, from.x), Math.atan2(to.y, to.x)) * 180 / Math.PI;
}

function angleDeltaRad(from: number, to: number): number {
  let delta = to - from;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  return delta;
}

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
  const responseCache = new Map<number, ResponseHistory | null>();
  const responseFor = (candidate: HandoffPoolProbeCandidate): ResponseHistory | null => {
    if (responseCache.has(candidate.qualityRank)) return responseCache.get(candidate.qualityRank)!;
    const response = responseHistory(record.contactResponseAtQualityRank(candidate.qualityRank));
    responseCache.set(candidate.qualityRank, response);
    return response;
  };

  let impactEfficiency: ImpactEfficiency | null = null;
  const impactTarget = record.targets.impact;
  const winnerImpact = winner.achieved.impact;
  const winnerResponse = responseFor(winner);
  if (
    impactTarget !== undefined && winnerImpact !== undefined &&
    Number.isFinite(winnerImpact) && winnerResponse !== null
  ) {
    const winnerError = Math.abs(winnerImpact - impactTarget);
    const materiallyBetter = record.candidates.filter((candidate) => {
      const achieved = candidate.achieved.impact;
      return achieved !== undefined && Number.isFinite(achieved) &&
        Math.abs(achieved - impactTarget) + material < winnerError;
    });
    const withResponse = materiallyBetter.flatMap((candidate) => {
      const response = responseFor(candidate);
      return response === null ? [] : [{ candidate, response }];
    });
    const locallyBetter = withResponse.filter(({ candidate }) =>
      axisRms(candidate, record.targets) < axisRms(winner, record.targets)
    );
    for (const { candidate, response } of locallyBetter) {
      impactCandidateRows.push({
        spec: activeSpec,
        seed: activeSeed,
        pool,
        gapIndex: record.gapIndex,
        target: impactTarget,
        winnerAbsError: winnerError,
        winnerAxisRms: axisRms(winner, record.targets),
        winnerSpeedDelta: winnerResponse.collectiveSpeedDelta,
        winnerPairDistanceChange: winnerResponse.rmsPairDistanceChange,
        winnerRelativeVelocityChange: winnerResponse.rmsRelativeVelocityChange,
        winnerAbsPhaseSlip: Math.abs(winnerResponse.phaseSlipDeg),
        qualityRank: candidate.qualityRank,
        admitted: candidate.admitted,
        absError: Math.abs(candidate.achieved.impact! - impactTarget),
        axisRms: axisRms(candidate, record.targets),
        currentQuality: candidate.currentQuality,
        qualityObjective: candidate.qualityObjective,
        readiness: candidate.readiness,
        catchability: candidate.catchability,
        speedFit: candidate.speedFit,
        nextImpactFeasibility: candidate.impactFeasibility,
        lineLength: candidate.lineLength,
        lineCount: candidate.lineCount,
        meanSegmentLength: candidate.meanSegmentLength,
        minSegmentLength: candidate.minSegmentLength,
        maxSegmentLength: candidate.maxSegmentLength,
        totalTurnDeg: candidate.totalTurnDeg,
        releaseElapsedFrames: candidate.releaseElapsedFrames,
        catchWindowGroundedFrames: candidate.catchWindowGroundedFrames,
        releaseDisplacement: candidate.releaseDisplacement,
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
        responseSpeedDelta: response.collectiveSpeedDelta,
        responsePairDistanceChange: response.rmsPairDistanceChange,
        responseRelativeVelocityChange: response.rmsRelativeVelocityChange,
        responseAbsPhaseSlip: Math.abs(response.phaseSlipDeg),
        responseCollectiveTurnDeg: response.collectiveTurnDeg,
        responsePoseTurnDeg: response.poseTurnDeg,
        responseContactedFrames: response.contactedFrames,
        responseSafe:
          response.collectiveSpeedDelta >= winnerResponse.collectiveSpeedDelta - .05 &&
          response.rmsPairDistanceChange <= winnerResponse.rmsPairDistanceChange + .05 &&
          response.rmsRelativeVelocityChange <= winnerResponse.rmsRelativeVelocityChange + .05 &&
          Math.abs(response.phaseSlipDeg) <= Math.abs(winnerResponse.phaseSlipDeg) + 3,
      });
    }
    const speedRetaining = withResponse.filter(({ response }) =>
      response.collectiveSpeedDelta >= winnerResponse.collectiveSpeedDelta - .05
    );
    const deformationSafe = withResponse.filter(({ response }) =>
      response.rmsPairDistanceChange <= winnerResponse.rmsPairDistanceChange + .05
    );
    const relativeMotionSafe = withResponse.filter(({ response }) =>
      response.rmsRelativeVelocityChange <= winnerResponse.rmsRelativeVelocityChange + .05
    );
    const phaseCoherent = withResponse.filter(({ response }) =>
      Math.abs(response.phaseSlipDeg) <= Math.abs(winnerResponse.phaseSlipDeg) + 3
    );
    const responseSafe = withResponse.filter(({ response }) =>
      response.collectiveSpeedDelta >= winnerResponse.collectiveSpeedDelta - .05 &&
      response.rmsPairDistanceChange <= winnerResponse.rmsPairDistanceChange + .05 &&
      response.rmsRelativeVelocityChange <= winnerResponse.rmsRelativeVelocityChange + .05 &&
      Math.abs(response.phaseSlipDeg) <= Math.abs(winnerResponse.phaseSlipDeg) + 3
    );
    const locallyBetterAndResponseSafe = responseSafe.filter(({ candidate }) =>
      axisRms(candidate, record.targets) < axisRms(winner, record.targets)
    );
    const localOrder = [...locallyBetter].sort((left, right) =>
      axisRms(left.candidate, record.targets) - axisRms(right.candidate, record.targets)
    );
    const impactOrder = [...locallyBetter].sort((left, right) =>
      Math.abs(left.candidate.achieved.impact! - impactTarget) -
        Math.abs(right.candidate.achieved.impact! - impactTarget)
    );
    const isResponseSafe = ({ response }: typeof withResponse[number]): boolean =>
      response.collectiveSpeedDelta >= winnerResponse.collectiveSpeedDelta - .05 &&
      response.rmsPairDistanceChange <= winnerResponse.rmsPairDistanceChange + .05 &&
      response.rmsRelativeVelocityChange <= winnerResponse.rmsRelativeVelocityChange + .05 &&
      Math.abs(response.phaseSlipDeg) <= Math.abs(winnerResponse.phaseSlipDeg) + 3;
    const hasSafeWithin = (
      candidates: typeof withResponse,
      count: number,
    ): boolean => candidates.slice(0, count).some(isResponseSafe);
    const bestSafe = locallyBetterAndResponseSafe.reduce<
      { candidate: HandoffPoolProbeCandidate; error: number } | null
    >((best, { candidate }) => {
      const error = Math.abs(candidate.achieved.impact! - impactTarget);
      return best === null || error < best.error ? { candidate, error } : best;
    }, null);
    impactEfficiency = {
      materiallyBetter: materiallyBetter.length,
      locallyBetter: locallyBetter.length,
      speedRetaining: speedRetaining.length,
      deformationSafe: deformationSafe.length,
      relativeMotionSafe: relativeMotionSafe.length,
      phaseCoherent: phaseCoherent.length,
      responseSafe: responseSafe.length,
      locallyBetterAndResponseSafe: locallyBetterAndResponseSafe.length,
      bestSafeAbsError: bestSafe?.error ?? null,
      bestSafeAdmitted: bestSafe?.candidate.admitted ?? null,
      bestSafeAxisRms: bestSafe === null ? null : axisRms(bestSafe.candidate, record.targets),
      bestSafeQualityRank: bestSafe?.candidate.qualityRank ?? null,
      bestSafeCurrentQuality: bestSafe?.candidate.currentQuality ?? null,
      bestSafeReadiness: bestSafe?.candidate.readiness ?? null,
      bestSafeCatchability: bestSafe?.candidate.catchability ?? null,
      bestSafeSpeedFit: bestSafe?.candidate.speedFit ?? null,
      bestSafeNextImpactFeasibility: bestSafe?.candidate.impactFeasibility ?? null,
      bestSafeLineCount: bestSafe?.candidate.lineCount ?? null,
      bestSafeMeanSegmentLength: bestSafe?.candidate.meanSegmentLength ?? null,
      bestSafeTotalTurnDeg: bestSafe?.candidate.totalTurnDeg ?? null,
      safeWithinLocalTop1: hasSafeWithin(localOrder, 1),
      safeWithinLocalTop3: hasSafeWithin(localOrder, 3),
      safeWithinLocalTop5: hasSafeWithin(localOrder, 5),
      safeWithinImpactTop1: hasSafeWithin(impactOrder, 1),
      safeWithinImpactTop3: hasSafeWithin(impactOrder, 3),
      safeWithinImpactTop5: hasSafeWithin(impactOrder, 5),
    };
  }

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
      winnerArrivalGapFrames: winner.arrivalGapFrames,
      bestViableArrivalGapFrames: bestViable.candidate.arrivalGapFrames,
      winnerResponse: responseFor(winner),
      bestViableResponse: responseFor(bestViable.candidate),
      precontactHistory: record.precontactHistory,
      impactEfficiency: axis === "impact" ? impactEfficiency : null,
    });
  }
});

const v2Sources = v2SourceNames.length === 0
  ? []
  : resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
const requestedV2Sources = v2SourceNames.map((name) => {
  const source = v2Sources.find((candidate) => candidate.id === name);
  if (source === undefined) throw new Error(`unknown V2 source "${name}"`);
  return source;
});
const compileInputs: Array<{ name: string; spec: Awaited<ReturnType<typeof loadGoldenSpec>> }> =
  v2SourceNames.length === 0
    ? await Promise.all(specNames.map(async (name) => ({
      name,
      spec: await loadGoldenSpec(name, "base"),
    })))
    : await Promise.all(requestedV2Sources.map(async (source) => ({
      name: source.id,
      spec: applyJolt(await loadSourceSpec(source), -15),
    })));

for (const { name: specName, spec } of compileInputs) {
  for (const seed of seeds) {
    activeSpec = specName;
    activeSeed = seed;
    const beforePools = poolCount;
    const beforeRows = rows.length;
    const started = Date.now();
    compileLegacyHandoff(spec, seed, { budget });
    writeCheckpoints();
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
console.log(`\n=== per-prefix candidate pool coverage (budget ${budget}, ${compileInputs.length} specs x ${seeds.length} seeds) ===`);
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
    const efficiency = axisRows.flatMap((row) => row.impactEfficiency === null
      ? []
      : [row.impactEfficiency]);
    const poolsWith = (key: keyof ImpactEfficiency): number => efficiency.filter((entry) => {
      const value = entry[key];
      return value === true || (typeof value === "number" && value > 0);
    }).length;
    console.log(
      `  impact efficient-pool coverage (${efficiency.length} readable):` +
        ` better=${poolsWith("materiallyBetter")}` +
        ` local=${poolsWith("locallyBetter")}` +
        ` speed=${poolsWith("speedRetaining")}` +
        ` deform=${poolsWith("deformationSafe")}` +
        ` relative=${poolsWith("relativeMotionSafe")}` +
        ` phase=${poolsWith("phaseCoherent")}` +
        ` response-safe=${poolsWith("responseSafe")}` +
        ` local+safe=${poolsWith("locallyBetterAndResponseSafe")}` +
        ` · local top1/3/5=${poolsWith("safeWithinLocalTop1")}/` +
          `${poolsWith("safeWithinLocalTop3")}/${poolsWith("safeWithinLocalTop5")}` +
        ` impact top1/3/5=${poolsWith("safeWithinImpactTop1")}/` +
          `${poolsWith("safeWithinImpactTop3")}/${poolsWith("safeWithinImpactTop5")}`,
    );
  }
}

writeCheckpoints();
if (outPath !== undefined) {
  console.log(`\nrows -> ${outPath}`);
}
if (impactCandidatesOutPath !== undefined) {
  console.log(`impact candidates -> ${impactCandidatesOutPath}`);
}
