/**
 * Arc placement experiments.
 *
 * This module owns impact-anchored placement: sample arc shape, choose
 * an intended impact point on the arc, translate that point to the simulated
 * sled position at the target frame, then let the engine validate.
 */

import { getRiderMetered } from "../lib/detector.ts";
import {
  CANDIDATE_SAMPLE_MODES,
  type Arc,
  type ArcPlacementCounter,
  type CandidateSampleMode,
  type CompileStats,
  type Gap,
  type AxisValues,
  type TrackLine,
} from "./types.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

const IMPACT_ANCHOR_PRECLEAR_DISTANCE = 2.5;
const IMPACT_ANCHOR_T_JITTER = 0.24;
const IMPACT_ANCHOR_ALONG_JITTER = 6;
const IMPACT_ANCHOR_NORMAL_JITTER = 6;

export type ArcPlacementStats = NonNullable<CompileStats["arc_placement"]>;

export type ImpactAnchorTargetState = {
  sledX: number;
  sledY: number;
};

export function impactAnchorEnabled(): boolean {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_ARC_PLACEMENT;
  // Impact-anchored placement is the default. Opt out to the uniform
  // wide-anchor-box sampler + anchor-Y bisection with LR_ARC_PLACEMENT=uniform.
  return raw !== "uniform";
}

export function impactAnchorFallbackBisectEnabled(): boolean {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_IMPACT_ANCHOR_FALLBACK_BISECT;
  return raw === "1";
}

function makeArcPlacementCounter(): ArcPlacementCounter {
  return {
    sampled: 0,
    preclear_rejected: 0,
    direct_attempted: 0,
    direct_landed: 0,
    direct_failed: 0,
    fallback_attempted: 0,
    fallback_landed: 0,
  };
}

function makeArcPlacementStats(): ArcPlacementStats {
  return {
    mode: "impact_anchor",
    ...makeArcPlacementCounter(),
    by_sample_mode: {
      normal: makeArcPlacementCounter(),
      brake: makeArcPlacementCounter(),
      air_support: makeArcPlacementCounter(),
    },
  };
}

const arcPlacementStats: ArcPlacementStats = makeArcPlacementStats();

export function resetArcPlacementStats(): void {
  const fresh = makeArcPlacementStats();
  resetCounter(arcPlacementStats, fresh);
  for (const mode of CANDIDATE_SAMPLE_MODES) {
    resetCounter(arcPlacementStats.by_sample_mode[mode], fresh.by_sample_mode[mode]);
  }
}

export function snapshotArcPlacementStats(): ArcPlacementStats | undefined {
  if (!impactAnchorEnabled()) return undefined;
  return {
    ...arcPlacementStats,
    by_sample_mode: {
      normal: { ...arcPlacementStats.by_sample_mode.normal },
      brake: { ...arcPlacementStats.by_sample_mode.brake },
      air_support: { ...arcPlacementStats.by_sample_mode.air_support },
    },
  };
}

export function recordImpactAnchorSample(mode?: CandidateSampleMode): void {
  incrementCounter("sampled", mode);
}

export function recordImpactAnchorPreclearReject(mode?: CandidateSampleMode): void {
  incrementCounter("preclear_rejected", mode);
}

export function recordImpactAnchorDirectAttempt(mode?: CandidateSampleMode): void {
  incrementCounter("direct_attempted", mode);
}

export function recordImpactAnchorDirectLanding(mode?: CandidateSampleMode): void {
  incrementCounter("direct_landed", mode);
}

export function recordImpactAnchorDirectFailure(mode?: CandidateSampleMode): void {
  incrementCounter("direct_failed", mode);
}

export function recordImpactAnchorFallbackAttempt(mode?: CandidateSampleMode): void {
  incrementCounter("fallback_attempted", mode);
}

export function recordImpactAnchorFallbackLanding(mode?: CandidateSampleMode): void {
  incrementCounter("fallback_landed", mode);
}

function incrementCounter(key: keyof ArcPlacementCounter, mode?: CandidateSampleMode): void {
  arcPlacementStats[key]++;
  if (mode !== undefined) arcPlacementStats.by_sample_mode[mode][key]++;
}

function resetCounter(target: ArcPlacementCounter, fresh: ArcPlacementCounter): void {
  target.sampled = fresh.sampled;
  target.preclear_rejected = fresh.preclear_rejected;
  target.direct_attempted = fresh.direct_attempted;
  target.direct_landed = fresh.direct_landed;
  target.direct_failed = fresh.direct_failed;
  target.fallback_attempted = fresh.fallback_attempted;
  target.fallback_landed = fresh.fallback_landed;
}

export function sampleImpactAnchoredArc(
  rng: () => number,
  targetState: ImpactAnchorTargetState,
  targets: AxisValues,
  length: number,
  startAngleDeg: number,
  endAngleDeg: number,
  segments: number,
  curveBias: number,
): Arc {
  const baseArc: Arc = {
    anchor: { x: 0, y: 0 },
    length,
    startAngleDeg,
    endAngleDeg,
    segments,
    curveBias,
  };
  // Impact point sits mid-arc. (Previously biased by the contact_style target,
  // which has been removed as an axis; `targets` is retained for the air/grain
  // shape decisions made in the caller.)
  const impactCenter = 0.5;
  const impactT = clamp(
    impactCenter + (rng() - 0.5) * IMPACT_ANCHOR_T_JITTER,
    0.15,
    0.85,
  );
  const local = arcLocalPointAt(baseArc, impactT);
  const normalX = -local.tangentY;
  const normalY = local.tangentX;
  const alongJitter = (rng() - 0.5) * IMPACT_ANCHOR_ALONG_JITTER;
  const normalJitter = (rng() - 0.5) * IMPACT_ANCHOR_NORMAL_JITTER;

  return {
    ...baseArc,
    anchor: {
      x: targetState.sledX
        - local.x
        + local.tangentX * alongJitter
        + normalX * normalJitter,
      y: targetState.sledY
        - local.y
        + local.tangentY * alongJitter
        + normalY * normalJitter,
    },
  };
}

export function hasPreTargetSledProximity(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  lines: TrackLine[],
): boolean {
  if (lines.length === 0) return false;
  const firstFrame = Math.max(0, gap.startFrame);
  const lastFrame = gap.endFrame - 2;
  for (let frame = firstFrame; frame <= lastFrame; frame++) {
    const rider = getRiderMetered(baseEngine, frame);
    for (const name of SLED_POINTS) {
      const point = rider.get(name);
      const pos = point?.pos;
      if (!pos) continue;
      for (const line of lines) {
        if (pointSegmentCollisionRisk(pos.x, pos.y, line)) {
          return true;
        }
      }
    }
  }
  return false;
}

function arcLocalPointAt(
  arc: Pick<Arc, "length" | "startAngleDeg" | "endAngleDeg" | "segments" | "curveBias">,
  t: number,
): { x: number; y: number; tangentX: number; tangentY: number } {
  const segLen = arc.length / arc.segments;
  const targetDistance = clamp(t, 0, 1) * arc.length;
  let x = 0;
  let y = 0;
  let traveled = 0;

  for (let i = 0; i < arc.segments; i++) {
    const tMid = (i + 0.5) / arc.segments;
    const ft = applyArcCurveBias(tMid, arc.curveBias);
    const angleDeg = arc.startAngleDeg + (arc.endAngleDeg - arc.startAngleDeg) * ft;
    const a = (angleDeg * Math.PI) / 180;
    const tangentX = Math.cos(a);
    const tangentY = Math.sin(a);
    const nextTraveled = traveled + segLen;
    if (targetDistance <= nextTraveled || i === arc.segments - 1) {
      const within = clamp(targetDistance - traveled, 0, segLen);
      return {
        x: x + tangentX * within,
        y: y + tangentY * within,
        tangentX,
        tangentY,
      };
    }
    x += tangentX * segLen;
    y += tangentY * segLen;
    traveled = nextTraveled;
  }

  return { x, y, tangentX: 1, tangentY: 0 };
}

function pointSegmentCollisionRisk(px: number, py: number, line: TrackLine): boolean {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy);
  if (len <= 0) return false;
  const along = ((px - line.x1) * dx + (py - line.y1) * dy) / (len * len);
  if (along < 0 || along > 1) return false;
  const signedDistance = (dx * (py - line.y1) - dy * (px - line.x1)) / len;
  const collidableSideDistance = line.flipped ? signedDistance : -signedDistance;
  return collidableSideDistance >= 0
    && Math.abs(signedDistance) <= IMPACT_ANCHOR_PRECLEAR_DISTANCE;
}

function applyArcCurveBias(t: number, bias: number): number {
  if (bias === 0) return t;
  if (bias > 0) return Math.pow(t, 1 + bias);
  return 1 - Math.pow(1 - t, 1 - bias);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
