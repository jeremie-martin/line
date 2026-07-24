import { axisQualityForTargets } from "../score.ts";
import {
  type AxisValues,
  type Gap,
} from "../types.ts";
import type { GapFit } from "../core/substrate.ts";
import {
  ballisticLaunchOf,
  projectBallisticGap,
  type BallisticFitFields,
  type BallisticLaunchObservation,
} from "../core/ballistic_projection.ts";
import {
  isElevationReadinessEnabled,
  scoreReadiness,
  setElevationReadinessEnabled,
  type ReadinessInput,
  type ReadinessScore,
} from "./readiness.ts";

function objectiveEnvNum(name: string, fallback: number): number {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(4, Math.max(0.25, n)) : fallback;
}

const OBJECTIVE_CURRENT_QUALITY_POWER_ENV = objectiveEnvNum("LR_M64_OBJECTIVE_CURRENT_POWER", 1);
const OBJECTIVE_READINESS_POWER_ENV = objectiveEnvNum("LR_M75_OBJECTIVE_READINESS_POWER", 1);
let objectiveCurrentQualityPower = OBJECTIVE_CURRENT_QUALITY_POWER_ENV;
let objectiveReadinessPower = OBJECTIVE_READINESS_POWER_ENV;

type ObjectiveBlendPowerConfig = {
  currentQualityPower?: number;
  readinessPower?: number;
  elevationReadiness?: boolean;
};

export function setObjectiveBlendPowers(config: ObjectiveBlendPowerConfig = {}): void {
  objectiveCurrentQualityPower = normalizeObjectivePower(
    config.currentQualityPower ?? OBJECTIVE_CURRENT_QUALITY_POWER_ENV,
  );
  objectiveReadinessPower = normalizeObjectivePower(
    config.readinessPower ?? OBJECTIVE_READINESS_POWER_ENV,
  );
  setElevationReadinessEnabled(config.elevationReadiness === true);
}

function normalizeObjectivePower(power: number): number {
  return Number.isFinite(power) && power > 0 ? Math.min(4, Math.max(0.25, power)) : 1;
}

export type ObjectiveArrivalState = ReadinessInput;
export type NextGapReadinessScore = ReadinessScore;

/**
 * Projection is deterministic for one immutable launch packet, target frame,
 * and enabled output set. All compiler consumers share this memo so telemetry,
 * ranking, and support lanes cannot repeat the exact constraint walk.
 */
const projectedArrivalCache = new WeakMap<
  BallisticLaunchObservation,
  Map<string, ObjectiveArrivalState | null>
>();

export type GapObjectiveScore = NextGapReadinessScore & {
  currentQuality: number;
  value: number;
};

/** Exact current-gap axes on the scorer-owned interval. */
export function currentGapAxes(fit: Pick<GapFit, "achieved">): AxisValues {
  return fit.achieved;
}

export function scoreCurrentTargetQuality(targets: AxisValues, achieved: AxisValues): number {
  return axisQualityForTargets(targets, achieved).axis_quality;
}

export function scoreNextTargetReadiness(
  arrival: ObjectiveArrivalState,
  nextTargets: AxisValues,
): NextGapReadinessScore | null {
  return scoreReadiness(arrival, nextTargets);
}

export function scoreGapObjectiveForTargets(
  currentTargets: AxisValues,
  currentAxes: AxisValues,
  arrival: ObjectiveArrivalState,
  nextTargets: AxisValues,
): GapObjectiveScore | null {
  const currentQuality = scoreCurrentTargetQuality(currentTargets, currentAxes);
  return scoreGapObjectiveWithCurrentQuality(currentQuality, arrival, nextTargets);
}

export function scoreGapObjectiveWithCurrentQuality(
  currentQuality: number,
  arrival: ObjectiveArrivalState,
  nextTargets: AxisValues,
): GapObjectiveScore | null {
  const readiness = scoreNextTargetReadiness(arrival, nextTargets);
  if (readiness === null) return null;
  return {
    ...readiness,
    currentQuality,
    value: proposalUtility(currentQuality, readiness),
  };
}

/** Search-policy value; deliberately separate from readiness semantics. */
export function proposalUtility(
  currentQuality: number,
  readiness: Pick<ReadinessScore, "readiness">,
): number {
  return objectivePower(currentQuality, objectiveCurrentQualityPower) *
    objectivePower(readiness.readiness, objectiveReadinessPower);
}

function objectivePower(value: number, power: number): number {
  if (power === 1) return value;
  return Math.max(0, Math.min(1, value)) ** power;
}

export function nextContactGap(gap: Gap, gaps: readonly Gap[]): Gap | null {
  return nextContactGapFromIndex(gaps, gap.index + 1);
}

export function nextContactGapFromIndex(gaps: readonly Gap[], from: number): Gap | null {
  const index = nextContactGapIndex(gaps, from);
  return index < 0 ? null : gaps[index];
}

export function nextContactGapIndex(gaps: readonly Gap[], from: number): number {
  for (let i = Math.max(0, from | 0); i < gaps.length; i++) {
    if (gaps[i].endsWithContact) return i;
  }
  return -1;
}

export function frontierReadinessFromFit(
  fit: GapFit & BallisticFitFields,
  nextGap: Gap,
): NextGapReadinessScore | null {
  const arrival = predictArrivalAtNextContact(fit, nextGap);
  return arrival === null ? null : scoreNextTargetReadiness(arrival, nextGap.targets);
}

export function predictArrivalAtNextContact(
  fit: GapFit | BallisticFitFields,
  nextGap: Pick<Gap, "startFrame" | "endFrame">,
): ObjectiveArrivalState | null {
  const launch = ballisticLaunchOf(fit);
  if (
    launch === undefined ||
    launch.gapStartFrame !== nextGap.startFrame
  ) return null;
  const includeElevation = isElevationReadinessEnabled();
  const cacheKey = `${nextGap.endFrame}:${includeElevation ? 1 : 0}`;
  let launchCache = projectedArrivalCache.get(launch);
  if (launchCache === undefined) {
    launchCache = new Map();
    projectedArrivalCache.set(launch, launchCache);
  } else if (launchCache.has(cacheKey)) {
    return launchCache.get(cacheKey)!;
  }
  const projection = projectBallisticGap(launch, nextGap.endFrame, {
    terminalContact: "grounded",
    includeElevation,
  });
  const arrival: ObjectiveArrivalState | null = projection === null
    ? null
    : {
      incoming: projection.boundary.incoming,
      meanSpeedPx: projection.meanSpeedPx,
      airFraction: projection.airFraction,
      gapFrameCount: projection.frameCount,
      ...(projection.elevation === null
        ? {}
        : { elevation: projection.elevation }),
    };
  launchCache.set(cacheKey, arrival);
  return arrival;
}

/** Frame count of a gap window — the denominator of measureAir's
 *  airborne-fraction statistic ([startFrame, endFrame] inclusive). */
export function nextGapFrameCount(nextGap: Pick<Gap, "startFrame" | "endFrame">): number {
  return Math.max(1, nextGap.endFrame - nextGap.startFrame + 1);
}
