/**
 * Arc placement experiments.
 *
 * This module owns compiler arc-placement experiments: choose local catch
 * geometry around the predicted impact state, translate it to the simulated
 * sled position at the target frame, then let the engine validate.
 */

import { appendSledPointPositionsRangeMetered, getRiderMetered } from "../lib/detector.ts";
import { makeSolidLine } from "./arc.ts";
import {
  CANDIDATE_SAMPLE_MODES,
  CALIB,
  SPEED_AXIS,
  type Arc,
  type ArcPlacementCounter,
  type ArcPlacementMode,
  type AxisValues,
  type CandidateSampleMode,
  type CompileStats,
  type Gap,
  type TrackLine,
  authoredSpeedToPx,
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
const CONTACT_CENTERED_GUIDED_DECAY_ATTEMPTS = 4;
const CONTACT_CENTERED_GUIDED_ROLL_SPREAD = 0.18;
const CONTACT_CENTERED_GUIDED_POINT_SPREAD = 0.08;
const FIRST_CONTACT_IMPACT_MAX_NEXT_CONTACT_FRAMES = 20;
const DENSE_SPACING_CAP_GRAIN_MIN = 0.50;
const DENSE_SPACING_CAP_MAX_NEXT_CONTACT_FRAMES = 14;
const LEGACY_DENSE_SPACING_CAP_GRAIN_MIN = 0.55;
const LEGACY_DENSE_SPACING_CAP_MAX_NEXT_CONTACT_FRAMES = 12;
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
const HIGH_AIR_LENGTH_BLEND_PRESSURE_START = 0.68;
const HIGH_AIR_LENGTH_BLEND_PRESSURE_SPAN = 0.24;
const HIGH_AIR_LENGTH_BLEND_EXTRA = 0.28;

type ProcessEnv = Record<string, string | undefined>;
const PROCESS_ENV = (globalThis as { process?: { env?: ProcessEnv } }).process?.env;

function envValue(name: string): string | undefined {
  return PROCESS_ENV?.[name];
}

export function readPositiveEnvNumber(name: string, fallback: number): number {
  const raw = envValue(name);
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const LEVEL_SCALE = readPositiveEnvNumber("LR_LEVEL_SCALE", 1);

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
export type PreTargetSledTrace = number[];
type SegmentCollisionRiskLines = number[];
const SEGMENT_COLLISION_RISK_STRIDE = 7;

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

type ContactCenteredRolls = {
  segmentLengthRoll: number;
  contactAngleRoll: number;
  preLengthRoll: number;
  postLengthRoll: number;
  preAngleRoll: number;
  postAngleRoll: number;
  tangentJitterRoll: number;
  normalJitterRoll: number;
};

export type ArcPlacementGeometry =
  | { kind: "arc"; arc: Arc }
  | { kind: "lines"; lines: TrackLine[] };

let arcPlacementModeRaw: string | undefined;
let arcPlacementModeValue: ArcPlacementRuntimeMode = "continuous";
let arcPlacementModeValid = false;
let fallbackBisectRaw: string | undefined;
let fallbackBisectValue = false;
let fallbackBisectValid = false;
let levelSpanRaw: string | undefined;
let levelSpanValue = true;
let levelSpanValid = false;
let launchRaw: string | undefined;
let energyLaunchValue = true;
let energyLaunchValid = false;
let airLengthRaw: string | undefined;
let airLengthValue = true;
let airLengthValid = false;
let twoDSpanRaw: string | undefined;
let twoDSpanValue = true;
let twoDSpanValid = false;
type DenseSpacingCapConfig = {
  legacy: boolean;
  maxNextContactFrames: number;
};
let denseSpacingCapRaw: string | undefined;
let denseSpacingCapValue: DenseSpacingCapConfig = {
  legacy: false,
  maxNextContactFrames: DENSE_SPACING_CAP_MAX_NEXT_CONTACT_FRAMES,
};
let denseSpacingCapValid = false;

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
  const raw = PROCESS_ENV?.LR_ARC_PLACEMENT;
  if (arcPlacementModeValid && raw === arcPlacementModeRaw) return arcPlacementModeValue;
  arcPlacementModeRaw = raw;
  arcPlacementModeValid = true;
  if (
    raw === "uniform" ||
    raw === "impact_frame" ||
    raw === "contact_centered" ||
    raw === "impact_anchor" ||
    raw === "continuous"
  ) {
    arcPlacementModeValue = raw;
    return arcPlacementModeValue;
  }
  // DEFAULT = continuous. The old default `impact_anchor` is hard-plateaued (ceiling
  // ~342, HEADLINE 282 on the canonical 8-seed × dense 5k-175k grid); `continuous`
  // reaches ceiling ~584 / HEADLINE 461 and is 160/160 valid by 115k. Under the
  // ceiling-weighted HEADLINE metric (which superseded CURVE_SCORE precisely because
  // CURVE_SCORE over-rewarded impact_anchor's fast-but-low plateau over continuous's
  // higher ceiling) the promotion is a decisive `decide` ACCEPT: Δheadline +178.2,
  // 95% CI [140.1, 231.7], P(Δ≤0)=0%. `impact_anchor` stays selectable via the env.
  arcPlacementModeValue = "continuous";
  return arcPlacementModeValue;
}

export function impactAnchorEnabled(): boolean {
  // Impact-anchored placement is the default. Opt out to the uniform
  // wide-anchor-box sampler + anchor-Y bisection with LR_ARC_PLACEMENT=uniform.
  return arcPlacementMode() !== "uniform";
}

export function impactAnchorFallbackBisectEnabled(): boolean {
  const raw = PROCESS_ENV?.LR_IMPACT_ANCHOR_FALLBACK_BISECT;
  if (fallbackBisectValid && raw === fallbackBisectRaw) return fallbackBisectValue;
  fallbackBisectRaw = raw;
  fallbackBisectValid = true;
  fallbackBisectValue = raw === "1";
  return fallbackBisectValue;
}

function firstContactImpactAnchorEnabled(
  gap: Gap,
  attempt: number,
  allContactFrames: readonly number[],
): boolean {
  if (gap.index !== 0) return false;
  const mode = envValue("LR_FIRST_CONTACT_ARC")?.trim();
  if (mode === "0" || mode === "off" || mode === "legacy" || mode === "lines") return false;
  if (mode === "impact_anchor") return true;
  const headCount = mode?.match(/^head(\d+)$/)?.[1];
  if (headCount !== undefined) return attempt < clampInt(Number(headCount), 0, 64);
  const nearFrames = mode?.match(/^near(\d+)$/)?.[1];
  const maxNextContactFrames = nearFrames === undefined
    ? FIRST_CONTACT_IMPACT_MAX_NEXT_CONTACT_FRAMES
    : clampInt(Number(nearFrames), 0, 120);
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  return nextGapFrames !== null && nextGapFrames <= maxNextContactFrames;
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
  return readTargetStateFromRider(rider, fallbackX, fallbackY);
}

// deno-lint-ignore no-explicit-any
export function readTargetStateFromRider(
  rider: any,
  fallbackX: number,
  fallbackY: number,
): ImpactFrameTargetState {
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
    // The first contact gets the impact-anchored arc family only when cadence is
    // tight enough that the next contact needs early ride-out structure.
    if (firstContactImpactAnchorEnabled(gap, attempt, allContactFrames)) {
      return {
        kind: "arc",
        arc: sampleArcParams(rng, refX, refY, targets, targetState, attempt, gap, mode),
      };
    }
    recordImpactAnchorSample(mode);
    return {
      kind: "lines",
      lines: sampleContactCenteredLinesWithDiagnostics(
        rng, targetState, targets, gap, lineIdStart, allContactFrames, attempt,
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
  // of this global guess. See docs/archive/PLATEAU_CAMPAIGN_LOG.md "impactCenter fragility".
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
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const deadlinePressure = clamp((18 - gapFrames) / 10, 0, 1);
  const speedPressure = clamp(
    (targetState.speed - SPEED_AXIS.PRESSURE_START_PX_PER_FRAME) /
      SPEED_AXIS.PRESSURE_SPAN_PX_PER_FRAME,
    0,
    1,
  );
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
  /** Per-gap attempt index, used to SPAN the ride-out from descending (fast,
   *  reliably on-beat) to level (slows the rider to target, but harder to land):
   *  the handoff then keeps the slowest catch that still lands on-beat per gap. */
  attempt = 0,
): ContactCenteredLineSample {
  const segmentLengthRoll = rng();
  const contactAngleRoll = rng();
  const preLengthRoll = rng();
  const postLengthRoll = rng();
  const preAngleRoll = rng();
  const postAngleRoll = rng();
  const tangentJitterRoll = rng();
  const normalJitterRoll = rng();
  const guidedRolls = guideContactCenteredRolls(
    {
      segmentLengthRoll,
      contactAngleRoll,
      preLengthRoll,
      postLengthRoll,
      preAngleRoll,
      postAngleRoll,
      tangentJitterRoll,
      normalJitterRoll,
    },
    targetState,
    targets,
    gap,
    allContactFrames,
    attempt,
  );

  const gapFrames = Math.max(1, gap.endFrame - gap.startFrame);
  const targetSpeedPx = targets.speed === undefined
    ? targetState.speed
    : authoredSpeedToPx(targets.speed);
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  const denseContactPressure = nextGapFrames === null
    ? 0
    : clamp((20 - nextGapFrames) / 12, 0, 1);
  const deadlinePressure = clamp((18 - gapFrames) / 10, 0, 1);
  const absoluteSpeedPressure = clamp(
    (targetState.speed - SPEED_AXIS.PRESSURE_START_PX_PER_FRAME) /
      SPEED_AXIS.PRESSURE_SPAN_PX_PER_FRAME,
    0,
    1,
  );
  const brakePressure = clamp(
    (targetState.speed - targetSpeedPx) / SPEED_AXIS.PRESSURE_SPAN_PX_PER_FRAME,
    0,
    1,
  );
  const accelPressure = clamp(
    (targetSpeedPx - targetState.speed) / SPEED_AXIS.PRESSURE_SPAN_PX_PER_FRAME,
    0,
    1,
  );
  const speedCarryPressure = clamp(
    (targetSpeedPx - SPEED_AXIS.CARRY_START_PX_PER_FRAME) / SPEED_AXIS.CARRY_SPAN_PX_PER_FRAME,
    0,
    1,
  ) * (1 - clamp(
    (targetSpeedPx - SPEED_AXIS.CARRY_FADE_START_PX_PER_FRAME) /
      SPEED_AXIS.CARRY_FADE_SPAN_PX_PER_FRAME,
    0,
    1,
  ));
  const sustainedContactCarryPressure = speedCarryPressure
    * (nextGapFrames === null ? 0 : clamp((15 - nextGapFrames) / 2, 0, 1))
    * (1 - clamp((air - 0.62) / 0.12, 0, 1));
  const clearancePressure = Math.max(deadlinePressure, absoluteSpeedPressure * 0.6);

  const segmentLength = targets.grain !== undefined
    ? clamp(targets.grain * CALIB.LINE_LENGTH_CAP + (guidedRolls.segmentLengthRoll - 0.5) * 8, 4, 49)
    : 16 + guidedRolls.segmentLengthRoll * 28;
  const contactAngleDeg = clamp(
    targetState.angleDeg
      - (2 + 5 * air)
      - 18 * brakePressure
      + 16 * accelPressure
      + 8 * speedCarryPressure
      + 2 * sustainedContactCarryPressure
      + (guidedRolls.contactAngleRoll - 0.5) * 12,
    -12,
    65,
  );
  const preLength = clamp(
    (6 + guidedRolls.preLengthRoll * 28)
      * (1 - 0.45 * clearancePressure)
      * (1 + 0.35 * brakePressure),
    4,
    44,
  );
  const rawPostLength = (45 + guidedRolls.postLengthRoll * 135)
    * (
      0.95
      + 0.25 * (1 - air)
      + 0.20 * absoluteSpeedPressure
      + 0.18 * sustainedContactCarryPressure
      + 0.12 * brakePressure
    );
  const denseScaledPostLength = rawPostLength * (1 - 0.55 * denseContactPressure);
  const needsGrainSpacingCap = needsDenseSpacingPostLengthCap(targets, nextGapFrames);
  const spacingPostLengthCap = nextGapFrames === null || !needsGrainSpacingCap
    ? 220
    : clamp(targetState.speed * nextGapFrames * (0.52 + 0.16 * (1 - air)), 36, 180);
  const sampledPostLength = clamp(Math.min(denseScaledPostLength, spacingPostLengthCap), 28, 220);
  const preAngleDeg = clamp(
    contactAngleDeg
      - (4 + 8 * clearancePressure + 4 * brakePressure)
      + (guidedRolls.preAngleRoll - 0.5) * 12,
    -20,
    70,
  );
  const nonBrakePostAngleDeg = contactAngleDeg
    - (3 + 6 * air)
    + 10 * accelPressure
    + 6 * speedCarryPressure
    + 6 * sustainedContactCarryPressure
    + (guidedRolls.postAngleRoll - 0.5) * 10;
  const brakeRideOutAngleDeg = clamp(
    contactAngleDeg + 8 + (guidedRolls.postAngleRoll - 0.5) * 10,
    -8,
    18,
  );
  const angledPostAngleDeg = clamp(
    lerp(nonBrakePostAngleDeg, brakeRideOutAngleDeg, brakePressure),
    -8,
    65,
  );
  // ── Launch shaping: HEIGHT trajectory shapes speed ──────────────────────────
  // The rider's measured pace is governed by where the track goes vertically, not
  // by local geometry alone. A catch placed at the falling sled descends, so the
  // rider keeps gaining speed (the systematic overshoot). Launching it to land
  // HIGHER makes it climb into the next contact and shed speed (KE→PE) while
  // gaining air on the way up; launching flatter lets it fall and gain speed with
  // less air. The launch angle is therefore the lever that lets the track UNDULATE
  // to track the speed/air curve instead of monotonically descending.
  let postAngleDeg = angledPostAngleDeg;
  if (levelSpanEnabled() && nextGapFrames !== null) {
    const blend = clamp(spanBlends(attempt).launch, 0, 1);
    if (energyLaunchEnabled()) {
      // Energy-targeted launch. By energy conservation, the height drop (down
      // positive) that converts the rider's current horizontal pace v_in to the
      // gap's pace target v_t is dh = (v_t² − v_in²)/(2g); the launch vy that lands
      // the rider dh below its current height after N frames is vy = dh/N − ½gN
      // (up negative). Brake (v_t < v_in ⇒ climb) and accel (v_t > v_in ⇒ dive)
      // both fall out of this — no direction gate. vy is clamped so the rider is
      // ALWAYS still descending at the next contact (apex strictly before it),
      // else the landing event would not fire; the dive is capped likewise. The
      // launch is spanned from the locally-natural ride-out to the fully energy-
      // shaped one across the attempt batch, and the cost-sorted handoff keeps the
      // best VALID catch, so energy shaping is used only where it lands on-beat.
      const g = 0.175;
      const N = nextGapFrames;
      const vIn = Math.max(1, targetState.velocity.x);
      const vT = Math.max(1, targetSpeedPx);
      const dhDown = (vT * vT - vIn * vIn) / (2 * g);
      const vyLevel = -0.5 * g * N;
      const vyTarget = dhDown / N + vyLevel;
      const vyClamped = clamp(vyTarget, -0.92 * g * N, 0.45 * g * N);
      const energyLaunchDeg = (Math.atan2(vyClamped, vIn) * 180) / Math.PI;
      postAngleDeg = lerp(angledPostAngleDeg, energyLaunchDeg, blend);
    } else {
      // Legacy level/over-return launch (LR_LAUNCH=level), kept for A/B. Reaches a
      // level launch only when the rider's horizontal pace exceeds the target.
      const levelCeiling = targetState.velocity.x > targetSpeedPx ? 1 : 0.15;
      const levelLaunchDeg =
        (Math.atan2(-0.5 * 0.175 * nextGapFrames * LEVEL_SCALE, Math.max(1, targetState.speed)) * 180) / Math.PI;
      postAngleDeg = lerp(angledPostAngleDeg, levelLaunchDeg, blend * levelCeiling);
    }
  }

  // ── Air-targeted grounded ride-out length ───────────────────────────────────
  // The measured airborne fraction over the gap is ~ 1 − groundedFrames/N: the
  // longer the rider stays on the ride-out before the hop, the LESS air, and vice
  // versa. So size the grounded ride toward (1−air_target) of the span to the next
  // contact — but never past a safe fraction of that distance, else the ride-out
  // reaches into the next beat and contaminates it (off-beat). Spanned across the
  // attempt batch from the locally-sampled length to the air-targeted one; the
  // cost-sorted handoff keeps the best valid catch. General for every gap; this is
  // the air counterpart to the energy launch's speed control.
  let postLength = clamp(sampledPostLength, 28, 220);
  if (airLengthEnabled() && nextGapFrames !== null && targets.air !== undefined) {
    const speed = Math.max(1, targetState.speed);
    const groundedTargetLen = speed * clamp(1 - air, 0, 1) * nextGapFrames;
    const safeCap = speed * nextGapFrames * 0.55;
    const targetLen = clamp(Math.min(groundedTargetLen, safeCap), 28, 360);
    const blend = clamp(spanBlends(attempt).length, 0, 1);
    const highAirPressure = clamp(
      (air - HIGH_AIR_LENGTH_BLEND_PRESSURE_START) / HIGH_AIR_LENGTH_BLEND_PRESSURE_SPAN,
      0,
      1,
    );
    const blendStrength = 0.6 + HIGH_AIR_LENGTH_BLEND_EXTRA * highAirPressure;
    postLength = clamp(lerp(sampledPostLength, targetLen, blend * blendStrength), 28, 360);
  }
  // Round (not ceil) the segment count so each emitted line length lands near the
  // grain-derived `segmentLength` rather than systematically shorter: ceil always
  // splits into MORE, hence SHORTER, segments, biasing the measured grain (median
  // line length / cap) below the target. Rounding centres the median on the target.
  const preSegments = clampInt(Math.round(preLength / segmentLength), 1, 6);
  const postSegments = clampInt(Math.round(postLength / segmentLength), 2, 16);

  const contactAngleRad = (contactAngleDeg * Math.PI) / 180;
  const tangentX = Math.cos(contactAngleRad);
  const tangentY = Math.sin(contactAngleRad);
  const normalX = -tangentY;
  const normalY = tangentX;
  const tangentJitter = (guidedRolls.tangentJitterRoll - 0.5) * CONTACT_CENTERED_POINT_JITTER;
  const normalJitter = (guidedRolls.normalJitterRoll - 0.5) * CONTACT_CENTERED_POINT_JITTER;
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

function guideContactCenteredRolls(
  rolls: ContactCenteredRolls,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  allContactFrames: readonly number[],
  attempt: number,
): ContactCenteredRolls {
  const targetSpeedPx = targets.speed === undefined
    ? targetState.speed
    : authoredSpeedToPx(targets.speed);
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  const gapFrames = Math.max(1, gap.endFrame - gap.startFrame);
  const denseContactPressure = nextGapFrames === null
    ? 0
    : clamp((20 - nextGapFrames) / 12, 0, 1);
  const deadlinePressure = clamp((18 - gapFrames) / 10, 0, 1);
  const absoluteSpeedPressure = clamp(
    (targetState.speed - SPEED_AXIS.PRESSURE_START_PX_PER_FRAME) /
      SPEED_AXIS.PRESSURE_SPAN_PX_PER_FRAME,
    0,
    1,
  );
  const brakePressure = clamp(
    (targetState.speed - targetSpeedPx) / SPEED_AXIS.PRESSURE_SPAN_PX_PER_FRAME,
    0,
    1,
  );
  const accelPressure = clamp(
    (targetSpeedPx - targetState.speed) / SPEED_AXIS.PRESSURE_SPAN_PX_PER_FRAME,
    0,
    1,
  );
  const speedCarryPressure = clamp(
    (targetSpeedPx - SPEED_AXIS.CARRY_START_PX_PER_FRAME) / SPEED_AXIS.CARRY_SPAN_PX_PER_FRAME,
    0,
    1,
  ) * (1 - clamp(
    (targetSpeedPx - SPEED_AXIS.CARRY_FADE_START_PX_PER_FRAME) /
      SPEED_AXIS.CARRY_FADE_SPAN_PX_PER_FRAME,
    0,
    1,
  ));
  const scarcity = Math.max(deadlinePressure, denseContactPressure);

  const guided: ContactCenteredRolls = {
    segmentLengthRoll: targets.grain === undefined
      ? clamp(0.42 + 0.12 * denseContactPressure - 0.08 * air, 0.20, 0.80)
      : 0.50,
    contactAngleRoll: clamp(
      0.50 - 0.08 * brakePressure + 0.06 * accelPressure + 0.04 * denseContactPressure,
      0.24,
      0.76,
    ),
    preLengthRoll: clamp(
      0.36 + 0.18 * brakePressure - 0.18 * scarcity + 0.08 * absoluteSpeedPressure,
      0.10,
      0.82,
    ),
    postLengthRoll: clamp(
      0.24 + 0.48 * (1 - air) + 0.14 * speedCarryPressure +
        0.08 * brakePressure - 0.22 * denseContactPressure,
      0.08,
      0.90,
    ),
    preAngleRoll: clamp(0.50 - 0.10 * deadlinePressure - 0.06 * brakePressure, 0.22, 0.78),
    postAngleRoll: clamp(
      0.48 + 0.10 * accelPressure + 0.08 * speedCarryPressure -
        0.06 * air + 0.04 * denseContactPressure,
      0.22,
      0.82,
    ),
    tangentJitterRoll: 0.50,
    normalJitterRoll: 0.50,
  };

  const guide = contactCenteredGuideWeight(attempt);
  return {
    segmentLengthRoll: guidedRoll(rolls.segmentLengthRoll, guided.segmentLengthRoll, attempt, 0, guide),
    contactAngleRoll: guidedRoll(rolls.contactAngleRoll, guided.contactAngleRoll, attempt, 1, guide),
    preLengthRoll: guidedRoll(rolls.preLengthRoll, guided.preLengthRoll, attempt, 2, guide),
    postLengthRoll: guidedRoll(rolls.postLengthRoll, guided.postLengthRoll, attempt, 3, guide),
    preAngleRoll: guidedRoll(rolls.preAngleRoll, guided.preAngleRoll, attempt, 4, guide),
    postAngleRoll: guidedRoll(rolls.postAngleRoll, guided.postAngleRoll, attempt, 5, guide),
    tangentJitterRoll: guidedRoll(
      rolls.tangentJitterRoll,
      guided.tangentJitterRoll,
      attempt,
      6,
      guide,
      CONTACT_CENTERED_GUIDED_POINT_SPREAD,
    ),
    normalJitterRoll: guidedRoll(
      rolls.normalJitterRoll,
      guided.normalJitterRoll,
      attempt,
      7,
      guide,
      CONTACT_CENTERED_GUIDED_POINT_SPREAD,
    ),
  };
}

function contactCenteredGuideWeight(attempt: number): number {
  const scaled = Math.max(0, attempt) / CONTACT_CENTERED_GUIDED_DECAY_ATTEMPTS;
  return 1 / (1 + scaled * scaled);
}

function guidedRoll(
  raw: number,
  center: number,
  attempt: number,
  salt: number,
  weight: number,
  spread = CONTACT_CENTERED_GUIDED_ROLL_SPREAD,
): number {
  const guided = clamp(center + (lowDiscrepancyRoll(attempt, salt) - 0.5) * spread, 0, 1);
  return clamp(lerp(raw, guided, weight), 0, 1);
}

function lowDiscrepancyRoll(attempt: number, salt: number): number {
  const stride = 0.6180339887498949;
  const offset = (salt + 1) * 0.137503523749935;
  return fract((Math.max(0, attempt) + 1) * stride + offset);
}

/** Descend↔level ride-out span: ON by default for continuous mode (it lifts the
 *  last-budget mean by reducing the systematic speed overshoot); opt out with
 *  LR_LEVELSPAN=0 for A/B. */
function levelSpanEnabled(): boolean {
  const raw = PROCESS_ENV?.LR_LEVELSPAN;
  if (levelSpanValid && raw === levelSpanRaw) return levelSpanValue;
  levelSpanRaw = raw;
  levelSpanValid = true;
  levelSpanValue = raw !== "0";
  return levelSpanValue;
}

/** Energy-targeted launch (height shapes speed): ON by default in continuous
 *  mode; opt out with LR_LAUNCH=level for A/B against the prior level/over-return
 *  launch. */
function energyLaunchEnabled(): boolean {
  const raw = PROCESS_ENV?.LR_LAUNCH;
  if (energyLaunchValid && raw === launchRaw) return energyLaunchValue;
  launchRaw = raw;
  energyLaunchValid = true;
  energyLaunchValue = raw !== "level";
  return energyLaunchValue;
}

/** Air-targeted grounded ride-out length: ON by default in continuous mode; opt
 *  out with LR_AIRLEN=0 for A/B against the launch-only state. */
function airLengthEnabled(): boolean {
  const raw = PROCESS_ENV?.LR_AIRLEN;
  if (airLengthValid && raw === airLengthRaw) return airLengthValue;
  airLengthRaw = raw;
  airLengthValid = true;
  airLengthValue = raw !== "0";
  return airLengthValue;
}

function denseSpacingCapConfig(): DenseSpacingCapConfig {
  const raw = PROCESS_ENV?.LR_DENSE_SPACING_CAP;
  if (denseSpacingCapValid && raw === denseSpacingCapRaw) return denseSpacingCapValue;
  denseSpacingCapRaw = raw;
  denseSpacingCapValid = true;
  const mode = raw?.trim();
  if (mode === "0" || mode === "off" || mode === "legacy") {
    denseSpacingCapValue = {
      legacy: true,
      maxNextContactFrames: LEGACY_DENSE_SPACING_CAP_MAX_NEXT_CONTACT_FRAMES,
    };
    return denseSpacingCapValue;
  }
  const wideFrames = mode?.match(/^wide(\d+)$/)?.[1];
  denseSpacingCapValue = {
    legacy: false,
    maxNextContactFrames: wideFrames === undefined
      ? DENSE_SPACING_CAP_MAX_NEXT_CONTACT_FRAMES
      : clampInt(Number(wideFrames), 0, 120),
  };
  return denseSpacingCapValue;
}

function needsDenseSpacingPostLengthCap(targets: AxisValues, nextGapFrames: number | null): boolean {
  if (nextGapFrames === null) return false;
  const config = denseSpacingCapConfig();
  if (config.legacy) {
    return (targets.grain ?? 0) >= LEGACY_DENSE_SPACING_CAP_GRAIN_MIN
      && nextGapFrames <= LEGACY_DENSE_SPACING_CAP_MAX_NEXT_CONTACT_FRAMES;
  }
  return (targets.grain ?? 0) >= DENSE_SPACING_CAP_GRAIN_MIN
    && nextGapFrames <= config.maxNextContactFrames;
}

function twoDSpanEnabled(): boolean {
  const raw = PROCESS_ENV?.LR_2DSPAN;
  if (twoDSpanValid && raw === twoDSpanRaw) return twoDSpanValue;
  twoDSpanRaw = raw;
  twoDSpanValid = true;
  twoDSpanValue = raw !== "0";
  return twoDSpanValue;
}

/**
 * Per-attempt span blends for the launch-shaping and ride-out-length controls.
 *
 * Default (1-D): both controls share `blend = attempt%8/7`, so the candidate
 * pool walks a single coupled diagonal (fully-natural → fully-shaped on BOTH at
 * once) — 8 distinct points across the 14-candidate budget, the rest repeats.
 *
 * 2-D (DEFAULT): launch and length vary INDEPENDENTLY, so the pool spans a
 * (launch × length) grid instead of the diagonal. On dense fragile chains the
 * search dead-ends when no pooled catch both lands valid and leaves a
 * continuable state; covering the 2-D space gives strictly more diverse valid
 * continuations per gap from the same budget (the cost-sorted handoff still
 * keeps the best valid one — pure proposal diversity, no search-policy change).
 * Opt out with LR_2DSPAN=0 to recover the legacy 1-D coupled diagonal.
 *
 * Measured (continuous): fragile focus mean +13.5, known-hard cross-check +107
 * (fixes drums_breath's all-budget s100 dead-end, solo_run 13→16/20 valid);
 * headline 9-spec neutral-to-positive on both disjoint seed sets (0–9 +0.7,
 * 10–19 +7.7) with validity preserved/improved.
 */
function spanBlends(attempt: number): { launch: number; length: number } {
  const a = ((attempt % 4096) + 4096) % 4096;
  if (twoDSpanEnabled()) {
    // Keep the full 8-level coupled DIAGONAL (attempts 0-7) so already-valid
    // specs retain their launch-shaping granularity, then spend the otherwise-
    // repeated attempts (8+) on the ANTI-diagonal (launch low ↔ length high):
    // off-diagonal (launch × length) points the 1-D diagonal never reaches.
    // These are additive proposals; the cost-sorted handoff only takes one if it
    // is the best valid catch, so easy specs are unaffected while fragile chains
    // gain diverse valid continuations.
    const k = a % 16;
    if (k < 8) {
      const b = k / 7;
      return { launch: b, length: b };
    }
    const b = (k - 8) / 7;
    return { launch: b, length: clamp(1 - b, 0, 1) };
  }
  const b = (a % 8) / 7;
  return { launch: b, length: b };
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
  return hasPreTargetSledProximityFromTrace(
    readPreTargetSledTrace(baseEngine, gap),
    lines,
  );
}

// deno-lint-ignore no-explicit-any
export function readPreTargetSledTrace(
  baseEngine: any,
  gap: Gap,
): PreTargetSledTrace {
  const firstFrame = Math.max(0, gap.startFrame);
  const lastFrame = gap.endFrame - 2;
  return appendSledPointPositionsRangeMetered(baseEngine, firstFrame, lastFrame, []);
}

export function hasPreTargetSledProximityFromTrace(
  trace: PreTargetSledTrace,
  lines: TrackLine[],
): boolean {
  if (lines.length === 0) return false;
  const riskLines = makeSegmentCollisionRiskLines(lines);
  for (let i = 0; i < trace.length; i += 2) {
    const px = trace[i];
    const py = trace[i + 1];
    for (let j = 0; j < riskLines.length; j += SEGMENT_COLLISION_RISK_STRIDE) {
      const x1 = riskLines[j];
      const y1 = riskLines[j + 1];
      const dx = riskLines[j + 2];
      const dy = riskLines[j + 3];
      const len = riskLines[j + 4];
      const lenSq = riskLines[j + 5];
      const ox = px - x1;
      const oy = py - y1;
      const along = (ox * dx + oy * dy) / lenSq;
      if (along < 0 || along > 1) continue;
      const signedDistance = (dx * oy - dy * ox) / len;
      const collidableSideDistance = riskLines[j + 6] !== 0 ? signedDistance : -signedDistance;
      if (
        collidableSideDistance >= 0 &&
        Math.abs(signedDistance) <= IMPACT_ANCHOR_PRECLEAR_DISTANCE
      ) {
        return true;
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
  const dxs = new Array<number>(segments);
  const dys = new Array<number>(segments);
  let totalX = 0;
  let totalY = 0;
  for (let i = 0; i < segments; i++) {
    const t = segments === 1 ? 1 : i / (segments - 1);
    const a = (lerp(startAngleDeg, endAngleDeg, t) * Math.PI) / 180;
    const dx = Math.cos(a) * segLen;
    const dy = Math.sin(a) * segLen;
    dxs[i] = dx;
    dys[i] = dy;
    totalX += dx;
    totalY += dy;
  }

  let x = contactPoint.x - totalX;
  let y = contactPoint.y - totalY;
  const lines = new Array<TrackLine>(segments);
  for (let i = 0; i < segments; i++) {
    const x2 = i === segments - 1 ? contactPoint.x : x + dxs[i];
    const y2 = i === segments - 1 ? contactPoint.y : y + dys[i];
    lines[i] = makeSolidLine(lineIdStart + i, x, y, x2, y2);
    x = x2;
    y = y2;
  }
  return lines;
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
  const lines = new Array<TrackLine>(segments);
  for (let i = 0; i < segments; i++) {
    const t = segments === 1 ? 1 : i / (segments - 1);
    const a = (lerp(startAngleDeg, endAngleDeg, t) * Math.PI) / 180;
    const x2 = x + Math.cos(a) * segLen;
    const y2 = y + Math.sin(a) * segLen;
    lines[i] = makeSolidLine(lineIdStart + i, x, y, x2, y2);
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

function makeSegmentCollisionRiskLines(lines: TrackLine[]): SegmentCollisionRiskLines {
  const riskLines: SegmentCollisionRiskLines = [];
  for (const line of lines) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;
    riskLines.push(
      line.x1,
      line.y1,
      dx,
      dy,
      len,
      len * len,
      line.flipped ? 1 : 0,
    );
  }
  return riskLines;
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

function fract(x: number): number {
  return x - Math.floor(x);
}
