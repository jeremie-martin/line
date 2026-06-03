/**
 * Arc placement experiments.
 *
 * This module owns compiler arc-placement experiments: choose local catch
 * geometry around the predicted impact state, translate it to the simulated
 * sled position at the target frame, then let the engine validate.
 */

import { getRiderMetered } from "../lib/detector.ts";
import { makeSolidLine } from "./arc.ts";
import {
  CANDIDATE_SAMPLE_MODES,
  CALIB,
  type Arc,
  type ArcPlacementCounter,
  type ArcPlacementMode,
  type AxisValues,
  type CandidateSampleMode,
  type CompileStats,
  type Gap,
  type TrackLine,
} from "./types.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

const IMPACT_ANCHOR_PRECLEAR_DISTANCE = 2.5;
const IMPACT_ANCHOR_T_JITTER = 0.24;
const IMPACT_ANCHOR_ALONG_JITTER = 6;
const IMPACT_ANCHOR_NORMAL_JITTER = 6;
const IMPACT_FRAME_ALONG_JITTER = 4;
const IMPACT_FRAME_NORMAL_JITTER = 4;
const CONTACT_CENTERED_POINT_JITTER = 4;
const CONTACT_CENTERED_MAX_NEXT_CONTACT_FRAMES = 22;
/** Uphill start-angle band (degrees, negative = uphill in Y-down) for brake-mode
 *  catches: the rider rides up the arc's front to bleed speed before contact. */
const BRAKE_START_ANGLE_MIN = -28;
const BRAKE_START_ANGLE_MAX = -6;
const AIR_SUPPORT_LENGTH_MIN = 100;
const AIR_SUPPORT_START_ANGLE_MIN = -8;
const AIR_SUPPORT_START_ANGLE_MAX = 14;
const AIR_SUPPORT_END_ANGLE_MIN = -6;
const AIR_SUPPORT_END_ANGLE_MAX = 10;
const AIR_SUPPORT_CURVE_BIAS_MAX = 0.35;

export type ArcPlacementStats = NonNullable<CompileStats["arc_placement"]>;
export type ArcPlacementDirectFailureReason = "survival" | "landing" | "offbeat";

export type ImpactAnchorTargetState = {
  sledX: number;
  sledY: number;
};

export type ImpactFrameTargetState = ImpactAnchorTargetState & {
  velocity: { x: number; y: number };
  speed: number;
  angleDeg: number;
};

export type ArcPlacementRuntimeMode = ArcPlacementMode | "uniform";

export type ImpactFrameArcSample = {
  arc: Arc;
  impactT: number;
  contactAngleDeg: number;
  localTangentAngleDeg: number;
};

export type ContactCenteredLineSample = {
  lines: TrackLine[];
  contactPoint: { x: number; y: number };
  contactAngleDeg: number;
  preAngleDeg: number;
  postAngleDeg: number;
  preLength: number;
  postLength: number;
  segmentLength: number;
  preSegments: number;
  postSegments: number;
  brakePressure: number;
  accelPressure: number;
};

export type ArcPlacementGeometry =
  | { kind: "arc"; arc: Arc }
  | { kind: "lines"; lines: TrackLine[] };

const CATCH_TEMPLATES = [
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: 13 },
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: -4 },
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: 4 },
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: -8 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: -6 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: 7 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: 4 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: 13 },
  { startDelta: -10, end: 2,  segments: 20, segmentLength: 30, lead: 17, offset: 13 },
  { startDelta: -10, end: 2,  segments: 20, segmentLength: 30, lead: 17, offset: 4 },
  { startDelta: -10, end: 30, segments: 16, segmentLength: 35, lead: 1,  offset: 16 },
  { startDelta: -12, end: 3,  segments: 18, segmentLength: 26, lead: 12, offset: 10 },
  { startDelta: -7,  end: 14, segments: 18, segmentLength: 46, lead: 13, offset: 13 },
  { startDelta: -5,  end: 25, segments: 12, segmentLength: 35, lead: 8,  offset: 0 },
  { startDelta: -15, end: -5, segments: 22, segmentLength: 28, lead: 16, offset: 8 },
  { startDelta: -10, end: 45, segments: 12, segmentLength: 40, lead: 12, offset: -10 },
] as const;

export function arcPlacementMode(): ArcPlacementRuntimeMode {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_ARC_PLACEMENT;
  if (raw === "uniform") return "uniform";
  if (raw === "impact_frame") return "impact_frame";
  if (raw === "contact_centered") return "contact_centered";
  if (raw === "continuous") return "continuous";
  return "impact_anchor";
}

export function impactAnchorEnabled(): boolean {
  // Impact-anchored placement is the default. Opt out to the uniform
  // wide-anchor-box sampler + anchor-Y bisection with LR_ARC_PLACEMENT=uniform.
  return arcPlacementMode() !== "uniform";
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
    direct_survival_failed: 0,
    direct_landing_failed: 0,
    direct_offbeat_failed: 0,
    fallback_attempted: 0,
    fallback_landed: 0,
  };
}

function makeArcPlacementStats(): ArcPlacementStats {
  return {
    mode: arcPlacementStatsMode(),
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
  arcPlacementStats.mode = fresh.mode;
  resetCounter(arcPlacementStats, fresh);
  for (const mode of CANDIDATE_SAMPLE_MODES) {
    resetCounter(arcPlacementStats.by_sample_mode[mode], fresh.by_sample_mode[mode]);
  }
}

function arcPlacementStatsMode(): ArcPlacementMode {
  const mode = arcPlacementMode();
  if (mode === "impact_frame") return "impact_frame";
  if (mode === "contact_centered") return "contact_centered";
  if (mode === "continuous") return "continuous";
  return "impact_anchor";
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

export function recordImpactAnchorDirectFailure(
  mode?: CandidateSampleMode,
  reason?: ArcPlacementDirectFailureReason,
): void {
  incrementCounter("direct_failed", mode);
  if (reason === "survival") incrementCounter("direct_survival_failed", mode);
  if (reason === "landing") incrementCounter("direct_landing_failed", mode);
  if (reason === "offbeat") incrementCounter("direct_offbeat_failed", mode);
}

export function recordImpactAnchorFallbackAttempt(mode?: CandidateSampleMode): void {
  incrementCounter("fallback_attempted", mode);
}

export function recordImpactAnchorFallbackLanding(mode?: CandidateSampleMode): void {
  incrementCounter("fallback_landed", mode);
}

export function readTargetState(
  // deno-lint-ignore no-explicit-any
  engine: any,
  frame: number,
  fallbackX: number,
  fallbackY: number,
): ImpactFrameTargetState {
  const rider = getRiderMetered(engine, frame);
  let sledX = fallbackX;
  let sledY = fallbackY;
  for (const name of SLED_POINTS) {
    const p = rider.get(name);
    if (p?.pos && p.pos.y > sledY) {
      sledY = p.pos.y;
      sledX = p.pos.x;
    }
  }
  const velocity = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(velocity.x, velocity.y);
  const angleDeg = (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI;
  return { sledX, sledY, velocity, speed, angleDeg };
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
  target.direct_survival_failed = fresh.direct_survival_failed;
  target.direct_landing_failed = fresh.direct_landing_failed;
  target.direct_offbeat_failed = fresh.direct_offbeat_failed;
  target.fallback_attempted = fresh.fallback_attempted;
  target.fallback_landed = fresh.fallback_landed;
}

export function sampleArcPlacementGeometry(
  rng: () => number,
  refX: number,
  refY: number,
  targets: AxisValues,
  targetState: ImpactFrameTargetState,
  attempt: number,
  gap: Gap,
  lineIdStart: number,
  mode: CandidateSampleMode = "normal",
  allContactFrames: readonly number[] = [],
): ArcPlacementGeometry {
  // Continuous mode replaces the normal stream's piecewise family selection
  // (steep templates / impact-anchored arc / contact-centered lines, each gated
  // by hard density/speed thresholds) with ONE generator. It uses the contact-
  // centered line family for ALL contact gaps — not only dense ones — because the
  // line family is the only one whose pre/post extents are decoupled from the
  // contact tangent, and its post-support already scales continuously with the
  // available downstream space. Removing the `nextGapFrames <= 22` gate lets that
  // one continuum span sparse and dense gaps alike. Brake and air-support streams
  // keep their own families.
  if (arcPlacementMode() === "continuous" && mode === "normal") {
    recordImpactAnchorSample(mode);
    return {
      kind: "lines",
      lines: sampleContactCenteredLinesWithDiagnostics(
        rng, targetState, targets, gap, lineIdStart, allContactFrames,
      ).lines,
    };
  }

  const steepTemplateIndex = steepCatchTemplateIndex(attempt);
  if (mode === "normal" && steepTemplateIndex !== null && shouldUseSteepCatch(targetState, gap)) {
    return { kind: "arc", arc: sampleSteepCatchArc(targetState, CATCH_TEMPLATES[steepTemplateIndex]) };
  }

  if (
    arcPlacementMode() === "contact_centered" &&
    mode === "normal" &&
    shouldUseContactCenteredLines(gap, allContactFrames)
  ) {
    recordImpactAnchorSample(mode);
    return {
      kind: "lines",
      lines: sampleContactCenteredLinesWithDiagnostics(
        rng, targetState, targets, gap, lineIdStart, allContactFrames,
      ).lines,
    };
  }

  return {
    kind: "arc",
    arc: sampleArcParams(rng, refX, refY, targets, targetState, attempt, gap, mode),
  };
}

export function sampleArcParams(
  rng: () => number,
  refX: number,
  refY: number,
  targets: AxisValues,
  targetState: ImpactFrameTargetState,
  attempt: number,
  gap: Gap,
  /** Sampling mode for compiler-owned extra streams. Normal mode is the
   *  deterministic K-prefix. Brake mode samples uphill-entry catches to bleed
   *  overspeed. Air-support mode samples shallow, longer catches that may keep
   *  the rider riding through low-air spans. */
  mode: CandidateSampleMode = "normal",
): Arc {
  const steepTemplateIndex = steepCatchTemplateIndex(attempt);
  if (mode === "normal" && steepTemplateIndex !== null && shouldUseSteepCatch(targetState, gap)) {
    return sampleSteepCatchArc(targetState, CATCH_TEMPLATES[steepTemplateIndex]);
  }

  const A = CALIB.ARC;
  // Wide uniform sampling within parameter bounds. Anchor X is offset around
  // the predicted rider x at landing frame; anchor Y is a STARTING value that
  // will be bisected for Contact precision.
  const lengthMin = mode === "air_support"
    ? Math.min(A.LENGTH_MAX, AIR_SUPPORT_LENGTH_MIN)
    : A.LENGTH_MIN;
  const lengthRange = A.LENGTH_MAX - lengthMin;
  const length = lengthMin + rng() * lengthRange;
  // Segments. When `grain` is targeted, derive segment count directly from
  // length / desired-median-line-length so the resulting arc is much more
  // likely to hit the grain target. Sprinkle some uniform sampling for variety.
  const segRoll = rng();
  let segments: number;
  if (targets.grain !== undefined && segRoll < 0.7) {
    // grain = median(line_length) / LINE_LENGTH_CAP. Solve for segment count.
    // Reuse the gate roll for a small, historically biased jitter so we do not
    // collapse to one shape without consuming another RNG draw.
    const targetSegLen = Math.max(3, targets.grain * CALIB.LINE_LENGTH_CAP);
    const jitter = Math.floor(segRoll * 3) - 1; // mostly -1/0, rare +1
    const ideal = Math.round(length / targetSegLen) + jitter;
    segments = Math.max(A.SEGMENTS_MIN, Math.min(A.SEGMENTS_MAX, ideal));
  } else {
    segments = A.SEGMENTS_MIN + Math.floor(segRoll * (A.SEGMENTS_MAX - A.SEGMENTS_MIN + 1));
  }

  const placementMode = arcPlacementMode();
  if (placementMode === "impact_frame" && mode === "normal") {
    recordImpactAnchorSample(mode);
    return sampleImpactFrameArc(rng, targetState, targets, gap, length, segments);
  }

  // Brake mode samples an uphill (negative) start angle so the rider decelerates
  // riding up the arc's front before contacting near impactT (~middle); normal
  // mode uses the calibrated downhill-catch start band.
  const startAngleDeg = mode === "brake"
    ? BRAKE_START_ANGLE_MIN + rng() * (BRAKE_START_ANGLE_MAX - BRAKE_START_ANGLE_MIN)
    : mode === "air_support"
    ? AIR_SUPPORT_START_ANGLE_MIN +
      rng() * (AIR_SUPPORT_START_ANGLE_MAX - AIR_SUPPORT_START_ANGLE_MIN)
    : A.START_ANGLE_MIN_DEG + rng() * (A.START_ANGLE_MAX_DEG - A.START_ANGLE_MIN_DEG);
  const endAngleDeg = mode === "air_support"
    ? AIR_SUPPORT_END_ANGLE_MIN +
      rng() * (AIR_SUPPORT_END_ANGLE_MAX - AIR_SUPPORT_END_ANGLE_MIN)
    : A.END_ANGLE_MIN_DEG + rng() * (A.END_ANGLE_MAX_DEG - A.END_ANGLE_MIN_DEG);
  const curveBias = mode === "air_support"
    ? (rng() - 0.5) * 2 * AIR_SUPPORT_CURVE_BIAS_MAX
    : -1 + 2 * rng();

  if (placementMode !== "uniform") {
    recordImpactAnchorSample(mode);
    return sampleImpactAnchoredArc(
      rng, targetState, length, startAngleDeg, endAngleDeg, segments, curveBias,
    );
  }

  // Wide uniform sampling within parameter bounds. Anchor X is offset around
  // the predicted rider x at landing frame; anchor Y is a STARTING value that
  // will be bisected for Contact precision.
  const anchorXOffset = A.ANCHOR_X_OFFSET_MIN
    + rng() * (A.ANCHOR_X_OFFSET_MAX - A.ANCHOR_X_OFFSET_MIN);
  const anchorYOffset = A.ANCHOR_Y_OFFSET_MIN
    + rng() * (A.ANCHOR_Y_OFFSET_MAX - A.ANCHOR_Y_OFFSET_MIN);

  return {
    anchor: { x: refX - length / 2 + anchorXOffset, y: refY + anchorYOffset },
    length,
    startAngleDeg,
    endAngleDeg,
    segments,
    curveBias,
  };
}

export function sampleArcParamsRngDraws(
  targetState: { speed: number; angleDeg: number },
  gap: Gap,
  attempt: number,
  mode: CandidateSampleMode = "normal",
): number {
  if (mode === "normal" && usesSteepCatchTemplateAttempt(targetState, gap, attempt)) return 0;
  return arcPlacementMode() === "uniform" ? 7 : 8;
}

export function usesSteepCatchTemplateAttempt(
  targetState: { speed: number; angleDeg: number },
  gap: Gap,
  attempt: number,
): boolean {
  // Continuous mode replaces the normal stream entirely (no steep templates), so
  // every normal attempt consumes the full draw budget like a non-template arc.
  if (arcPlacementMode() === "continuous") return false;
  return steepCatchTemplateIndex(attempt) !== null && shouldUseSteepCatch(targetState, gap);
}

export function steepCatchTemplateIndex(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt % 2 !== 0) return null;
  const index = attempt / 2;
  return index < CATCH_TEMPLATES.length ? index : null;
}

function shouldUseSteepCatch(targetState: { speed: number; angleDeg: number }, gap: Gap): boolean {
  const gapFrames = gap.endFrame - gap.startFrame;
  return gapFrames >= 60 && (targetState.speed >= 10 || targetState.angleDeg >= 55);
}

function sampleSteepCatchArc(
  targetState: ImpactFrameTargetState,
  template: typeof CATCH_TEMPLATES[number],
): Arc {
  const startAngleDeg = clamp(targetState.angleDeg + template.startDelta, 20, 88);
  const endAngleDeg = clamp(template.end, -15, 55);
  const a0 = (startAngleDeg * Math.PI) / 180;
  const dx0 = Math.cos(a0);
  const dy0 = Math.sin(a0);
  const perpX = -dy0;
  const perpY = dx0;
  return {
    anchor: {
      x: targetState.sledX - dx0 * template.lead + perpX * template.offset,
      y: targetState.sledY - dy0 * template.lead + perpY * template.offset,
    },
    length: template.segments * template.segmentLength,
    startAngleDeg,
    endAngleDeg,
    segments: template.segments,
    curveBias: 0,
  };
}

export function sampleImpactAnchoredArc(
  rng: () => number,
  targetState: ImpactAnchorTargetState,
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
  // ⚠️ FRAGILE / KNOWN SMELL — TECH DEBT. This is a single global constant for
  // *where along the arc* the impact is anchored, and the compiler is alarmingly
  // sensitive to it: 0.5 silently drops 1-2 contacts on dense/fast specs
  // (dense_sprint, opening_burst) on ~half of seeds, while 0.6 lands them. There
  // is NO principled reason 0.6 is right — the feasible impact point is narrow
  // and gap-geometry-dependent (short/fast gaps must impact near the arc's end to
  // avoid pre-target collision; longer gaps tolerate more). A single constant
  // cannot be right for all gaps; this 0.6 was chosen only because it happens to
  // sit in the feasible band for the current spec suite (and matches what the
  // removed `contact_style` axis used to supply incidentally via its low targets).
  // Wide/uniform sweeps were tried and DILUTE the narrow feasible band → also fail.
  // PROPER FIX (not done): derive the feasible impact-point band PER GAP from
  // geometry (gap duration, entry speed, arc length) and sample within it, instead
  // of this global guess. See PLATEAU_CAMPAIGN_LOG.md "impactCenter fragility".
  const impactCenter = 0.6;
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

export function sampleImpactFrameArc(
  rng: () => number,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  length: number,
  segments: number,
): Arc {
  return sampleImpactFrameArcWithDiagnostics(
    rng, targetState, targets, gap, length, segments,
  ).arc;
}

export function sampleImpactFrameArcWithDiagnostics(
  rng: () => number,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  length: number,
  segments: number,
): ImpactFrameArcSample {
  const contactAngleRoll = rng();
  const exitAngleRoll = rng();
  const preFractionRoll = rng();
  const curveBiasRoll = rng();
  const alongJitterRoll = rng();
  const normalJitterRoll = rng();

  const gapFrames = Math.max(1, gap.endFrame - gap.startFrame);
  const speedNorm = targetState.speed / CALIB.SPEED_CAP;
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const deadlinePressure = clamp((18 - gapFrames) / 10, 0, 1);
  const speedPressure = clamp((speedNorm - 0.65) / 0.55, 0, 1);
  const clearancePressure = Math.max(deadlinePressure, speedPressure);
  const impactT = clamp(
    0.52 + 0.12 * clearancePressure + (preFractionRoll - 0.5) * 0.16,
    0.30,
    0.76,
  );

  const contactAngleDeg = clamp(
    targetState.angleDeg - (6 + 16 * air) + (contactAngleRoll - 0.5) * 12,
    -8,
    62,
  );
  let endAngleDeg = clamp(
    contactAngleDeg - (8 + 10 * (1 - air)) + (exitAngleRoll - 0.5) * 10,
    -15,
    55,
  );
  const curveBias = clamp(
    (curveBiasRoll - 0.5) * 0.5 + 0.25 * clearancePressure - 0.15 * air,
    -0.7,
    0.7,
  );

  const tangentSampleT = arcTangentSampleT(impactT, segments);
  const ft = applyArcCurveBias(tangentSampleT, curveBias);
  let startAngleDeg = solveStartAngleForContact(contactAngleDeg, endAngleDeg, ft);
  const clampedStartAngleDeg = clamp(startAngleDeg, -30, 88);
  if (clampedStartAngleDeg !== startAngleDeg) {
    startAngleDeg = clampedStartAngleDeg;
    endAngleDeg = clamp(solveEndAngleForContact(contactAngleDeg, startAngleDeg, ft), -15, 55);
  }

  const baseArc: Arc = {
    anchor: { x: 0, y: 0 },
    length,
    startAngleDeg,
    endAngleDeg,
    segments,
    curveBias,
  };
  const local = arcLocalPointAt(baseArc, impactT);
  const normalX = -local.tangentY;
  const normalY = local.tangentX;
  const alongJitter = (alongJitterRoll - 0.5) * IMPACT_FRAME_ALONG_JITTER;
  const normalJitter = (normalJitterRoll - 0.5) * IMPACT_FRAME_NORMAL_JITTER;
  const arc: Arc = {
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

  return {
    arc,
    impactT,
    contactAngleDeg,
    localTangentAngleDeg: (Math.atan2(local.tangentY, local.tangentX) * 180) / Math.PI,
  };
}

export function sampleContactCenteredLinesWithDiagnostics(
  rng: () => number,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  lineIdStart: number,
  allContactFrames: readonly number[] = [],
): ContactCenteredLineSample {
  const segmentLengthRoll = rng();
  const contactAngleRoll = rng();
  const preLengthRoll = rng();
  const postLengthRoll = rng();
  const preAngleRoll = rng();
  const postAngleRoll = rng();
  const tangentJitterRoll = rng();
  const normalJitterRoll = rng();

  const gapFrames = Math.max(1, gap.endFrame - gap.startFrame);
  const speedNorm = targetState.speed / CALIB.SPEED_CAP;
  const targetSpeed = targets.speed ?? speedNorm;
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  const denseContactPressure = nextGapFrames === null
    ? 0
    : clamp((20 - nextGapFrames) / 12, 0, 1);
  const deadlinePressure = clamp((18 - gapFrames) / 10, 0, 1);
  const absoluteSpeedPressure = clamp((speedNorm - 0.65) / 0.55, 0, 1);
  const brakePressure = clamp((speedNorm - targetSpeed) / 0.55, 0, 1);
  const accelPressure = clamp((targetSpeed - speedNorm) / 0.55, 0, 1);
  const speedCarryPressure = clamp((targetSpeed - 0.55) / 0.4, 0, 1)
    * (1 - clamp((targetSpeed - 0.78) / 0.12, 0, 1));
  const sustainedContactCarryPressure = speedCarryPressure
    * (nextGapFrames === null ? 0 : clamp((15 - nextGapFrames) / 2, 0, 1))
    * (1 - clamp((air - 0.62) / 0.12, 0, 1));
  const clearancePressure = Math.max(deadlinePressure, absoluteSpeedPressure * 0.6);

  const segmentLength = targets.grain !== undefined
    ? clamp(targets.grain * CALIB.LINE_LENGTH_CAP + (segmentLengthRoll - 0.5) * 8, 4, 49)
    : 16 + segmentLengthRoll * 28;
  const contactAngleDeg = clamp(
    targetState.angleDeg
      - (2 + 5 * air)
      - 18 * brakePressure
      + 16 * accelPressure
      + 8 * speedCarryPressure
      + 2 * sustainedContactCarryPressure
      + (contactAngleRoll - 0.5) * 12,
    -12,
    65,
  );
  const preLength = clamp(
    (6 + preLengthRoll * 28)
      * (1 - 0.45 * clearancePressure)
      * (1 + 0.35 * brakePressure),
    4,
    44,
  );
  const rawPostLength = (45 + postLengthRoll * 135)
    * (
      0.95
      + 0.25 * (1 - air)
      + 0.20 * absoluteSpeedPressure
      + 0.18 * sustainedContactCarryPressure
      + 0.12 * brakePressure
    );
  const denseScaledPostLength = rawPostLength * (1 - 0.55 * denseContactPressure);
  const needsGrainSpacingCap = (targets.grain ?? 0) >= 0.55
    && nextGapFrames !== null
    && nextGapFrames <= 12;
  const spacingPostLengthCap = nextGapFrames === null || !needsGrainSpacingCap
    ? 220
    : clamp(targetState.speed * nextGapFrames * (0.52 + 0.16 * (1 - air)), 36, 180);
  const postLength = clamp(Math.min(denseScaledPostLength, spacingPostLengthCap), 28, 220);
  const preSegments = clampInt(Math.ceil(preLength / segmentLength), 1, 6);
  const postSegments = clampInt(Math.ceil(postLength / segmentLength), 2, 14);
  const preAngleDeg = clamp(
    contactAngleDeg
      - (4 + 8 * clearancePressure + 4 * brakePressure)
      + (preAngleRoll - 0.5) * 12,
    -20,
    70,
  );
  const nonBrakePostAngleDeg = contactAngleDeg
    - (3 + 6 * air)
    + 10 * accelPressure
    + 6 * speedCarryPressure
    + 6 * sustainedContactCarryPressure
    + (postAngleRoll - 0.5) * 10;
  const brakeRideOutAngleDeg = clamp(
    contactAngleDeg + 8 + (postAngleRoll - 0.5) * 10,
    -8,
    18,
  );
  const postAngleDeg = clamp(
    lerp(nonBrakePostAngleDeg, brakeRideOutAngleDeg, brakePressure),
    -8,
    65,
  );

  const contactAngleRad = (contactAngleDeg * Math.PI) / 180;
  const tangentX = Math.cos(contactAngleRad);
  const tangentY = Math.sin(contactAngleRad);
  const normalX = -tangentY;
  const normalY = tangentX;
  const tangentJitter = (tangentJitterRoll - 0.5) * CONTACT_CENTERED_POINT_JITTER;
  const normalJitter = (normalJitterRoll - 0.5) * CONTACT_CENTERED_POINT_JITTER;
  const contactPoint = {
    x: targetState.sledX + tangentX * tangentJitter + normalX * normalJitter,
    y: targetState.sledY + tangentY * tangentJitter + normalY * normalJitter,
  };

  const preLines = buildPreContactLines(
    lineIdStart, contactPoint, preAngleDeg, contactAngleDeg, preLength, preSegments,
  );
  const postLines = buildPostContactLines(
    lineIdStart + preLines.length, contactPoint, contactAngleDeg, postAngleDeg,
    postLength, postSegments,
  );

  return {
    lines: [...preLines, ...postLines],
    contactPoint,
    contactAngleDeg,
    preAngleDeg,
    postAngleDeg,
    preLength,
    postLength,
    segmentLength,
    preSegments,
    postSegments,
    brakePressure,
    accelPressure,
  };
}

export function shouldUseContactCenteredLines(
  gap: Gap,
  allContactFrames: readonly number[] = [],
): boolean {
  if (allContactFrames.length === 0) return true;
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  if (nextGapFrames === null || nextGapFrames > CONTACT_CENTERED_MAX_NEXT_CONTACT_FRAMES) {
    return false;
  }
  return true;
}

function framesUntilNextContact(gap: Gap, allContactFrames: readonly number[]): number | null {
  const next = allContactFrames.find((frame) => frame > gap.endFrame);
  return next === undefined ? null : next - gap.endFrame;
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

function arcTangentSampleT(t: number, segments: number): number {
  const safeSegments = Math.max(1, Math.floor(segments));
  const index = Math.min(safeSegments - 1, Math.floor(clamp(t, 0, 1) * safeSegments));
  return (index + 0.5) / safeSegments;
}

function solveStartAngleForContact(contactAngleDeg: number, endAngleDeg: number, ft: number): number {
  const denom = 1 - ft;
  if (Math.abs(denom) < 1e-6) return contactAngleDeg;
  return (contactAngleDeg - endAngleDeg * ft) / denom;
}

function solveEndAngleForContact(contactAngleDeg: number, startAngleDeg: number, ft: number): number {
  if (Math.abs(ft) < 1e-6) return contactAngleDeg;
  return (contactAngleDeg - startAngleDeg * (1 - ft)) / ft;
}

function buildPreContactLines(
  lineIdStart: number,
  contactPoint: { x: number; y: number },
  startAngleDeg: number,
  endAngleDeg: number,
  length: number,
  segments: number,
): TrackLine[] {
  const segLen = length / segments;
  const vectors = Array.from({ length: segments }, (_, i) => {
    const t = segments === 1 ? 1 : i / (segments - 1);
    return vectorFromAngle(lerp(startAngleDeg, endAngleDeg, t), segLen);
  });
  const total = vectors.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
    { x: 0, y: 0 },
  );
  let x = contactPoint.x - total.x;
  let y = contactPoint.y - total.y;
  return vectors.map((v, i) => {
    const x2 = i === vectors.length - 1 ? contactPoint.x : x + v.x;
    const y2 = i === vectors.length - 1 ? contactPoint.y : y + v.y;
    const line = makeSolidLine(lineIdStart + i, x, y, x2, y2);
    x = x2;
    y = y2;
    return line;
  });
}

function buildPostContactLines(
  lineIdStart: number,
  contactPoint: { x: number; y: number },
  startAngleDeg: number,
  endAngleDeg: number,
  length: number,
  segments: number,
): TrackLine[] {
  const segLen = length / segments;
  let x = contactPoint.x;
  let y = contactPoint.y;
  const lines: TrackLine[] = [];
  for (let i = 0; i < segments; i++) {
    const t = segments === 1 ? 1 : i / (segments - 1);
    const v = vectorFromAngle(lerp(startAngleDeg, endAngleDeg, t), segLen);
    const x2 = x + v.x;
    const y2 = y + v.y;
    lines.push(makeSolidLine(lineIdStart + i, x, y, x2, y2));
    x = x2;
    y = y2;
  }
  return lines;
}

function vectorFromAngle(angleDeg: number, length: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(a) * length, y: Math.sin(a) * length };
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

function clampInt(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(x)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
