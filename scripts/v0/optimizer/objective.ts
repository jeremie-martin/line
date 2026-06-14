import { axisQualityForTargets } from "../score.ts";
import {
  authoredSpeedToPx,
  impactToRedirArcPx,
  type AxisValues,
  type Gap,
} from "../types.ts";
import type { GapFit } from "../core/substrate.ts";
import { aimTargets } from "./planning.ts";
import {
  propagateBallisticArrivalState,
  type RiderArrivalState,
} from "./arc_model.ts";
import {
  readinessCatchState,
  type ReadinessArrivalState,
} from "./readiness.ts";

export const OBJECTIVE_READINESS_MIN = 0.1;
export const OBJECTIVE_SPEED_SCALE_PXF = 0.75;
export const OBJECTIVE_IMPACT_MIN_ASK = 0.3;

export type ObjectiveArrivalState =
  & Pick<ReadinessArrivalState, "speed" | "comAngleDeg">
  & Partial<ReadinessArrivalState>
  // Mean speed over the predicted flight to the next contact (trapezoidal of launch+arrival).
  // The authored speed target is a mean-of-flight; this is the apples-to-apples statistic for
  // speedFit. Absent on call sites built from a single catch-instant state (they fall back).
  & { meanSpeed?: number };

export type NextGapReadinessScore = {
  readiness: number;
  catchability: number;
  speedFit: number;
  impactFeasibility: number;
};

export type GapObjectiveScore = NextGapReadinessScore & {
  currentQuality: number;
  value: number;
};

export function scoreCurrentGapQuality(gap: Gap, achieved: AxisValues): number {
  return axisQualityForTargets(aimTargets(gap), achieved).axis_quality;
}

export function scoreNextGapReadiness(
  arrival: ObjectiveArrivalState,
  nextGap: Gap,
): NextGapReadinessScore | null {
  if (!Number.isFinite(arrival.speed) || arrival.comAngleDeg === null || !Number.isFinite(arrival.comAngleDeg)) {
    return null;
  }
  const catchability = Math.max(OBJECTIVE_READINESS_MIN, readinessCatchState(arrival));
  const speedFit = speedFitFactor(arrival.meanSpeed ?? arrival.speed, nextGap);
  const impactFeasibility = impactFeasibilityFactor(arrival, nextGap);
  return {
    readiness: catchability * speedFit * impactFeasibility,
    catchability,
    speedFit,
    impactFeasibility,
  };
}

export function scoreGapObjective(
  currentGap: Gap,
  currentAxes: AxisValues,
  arrival: ObjectiveArrivalState,
  nextGap: Gap,
): GapObjectiveScore | null {
  const readiness = scoreNextGapReadiness(arrival, nextGap);
  if (readiness === null) return null;
  const currentQuality = scoreCurrentGapQuality(currentGap, currentAxes);
  return {
    ...readiness,
    currentQuality,
    value: currentQuality * readiness.readiness,
  };
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

export function arrivalStateFromFit(
  fit: GapFit,
  nextEndFrame: number,
): ObjectiveArrivalState | null {
  return predictArrivalAtNextContact(fit, nextEndFrame);
}

export function frontierReadinessFromFit(
  fit: GapFit,
  nextGap: Gap,
): NextGapReadinessScore | null {
  const arrival = arrivalStateFromFit(fit, nextGap.endFrame);
  return arrival === null ? null : scoreNextGapReadiness(arrival, nextGap);
}

export function predictArrivalAtNextContact(
  fit: Pick<GapFit, "releaseArrivalState">,
  nextEndFrame: number,
): ObjectiveArrivalState | null {
  const rel = fit.releaseArrivalState;
  if (rel === undefined || !rel.airborne) return null;
  const dt = nextEndFrame - rel.frame;
  if (dt <= 0) return null;
  const launch: RiderArrivalState = {
    x: rel.x,
    y: rel.y,
    vx: rel.vx,
    vy: rel.vy,
    speed: Math.hypot(rel.vx, rel.vy),
    comAngleDeg: null,
    sledPoseDeg: rel.sledPoseDeg,
    sledPoseRateDegPerFrame: rel.sledPoseRateDegPerFrame,
  };
  const arrived = propagateBallisticArrivalState(launch, dt);
  return {
    speed: arrived.speed,
    comAngleDeg: arrived.comAngleDeg,
    meanSpeed: (launch.speed + arrived.speed) / 2,
  };
}

function speedFitFactor(speed: number, nextGap: Gap): number {
  const target = aimTargets(nextGap).speed;
  if (target === undefined) return 1;
  // `speed` is the predicted MEAN-of-flight where available (the statistic the target authors),
  // else the catch-instant fallback. Asymmetric: too-fast is half-penalized — any residual
  // overshoot bias inflates the apparent fast side, and excess speed can be bled; too-slow full.
  // NOTE: this is the forward-looking READINESS speed fit, NOT a reproduction of the scorer's
  // speed axis. It is intentionally asymmetric and on a tighter scale (OBJECTIVE_SPEED_SCALE_PXF)
  // than the scorer's symmetric AXIS_QUALITY_TOLERANCE — it ranks a candidate's fitness to FLY
  // INTO the next gap, not its scored speed error. The two surfaces are meant to differ.
  const d = speed - authoredSpeedToPx(target);
  const penalty = d > 0 ? d * 0.5 : -d;
  return Math.exp(-penalty / OBJECTIVE_SPEED_SCALE_PXF);
}

function impactFeasibilityFactor(
  state: Pick<ObjectiveArrivalState, "speed" | "comAngleDeg">,
  nextGap: Gap,
): number {
  // FEASIBILITY, not scored error: "can this arrival state deliver the next beat's
  // impact ask?", clamped to [0,1]. So OVER-delivering impact is free here (the scorer
  // penalizes overshoot separately and symmetrically), and asks below
  // OBJECTIVE_IMPACT_MIN_ASK are treated as no-constraint (returns 1). This is an
  // intentional divergence from the scorer's additive equal-weight impact axis — it
  // gates readiness, it does not reproduce the impact score.
  const impactAsk = aimTargets(nextGap).impact;
  if (impactAsk === undefined || impactAsk < OBJECTIVE_IMPACT_MIN_ASK || state.comAngleDeg === null) return 1;
  return Math.min(
    1,
    Math.max(
      0,
      (state.speed * ((Math.max(0, state.comAngleDeg) * Math.PI) / 180)) /
        impactToRedirArcPx(impactAsk),
    ),
  );
}
