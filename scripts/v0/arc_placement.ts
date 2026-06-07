/**
 * Target-state arc placement.
 *
 * This file intentionally keeps only the reliable part of the former placement
 * stack: reading the rider state at the target beat. Geometry generation starts
 * from that state, emits one small line-native catch fragment, and lets
 * `core/candidate.ts` validate landing, survival, off-beat behavior, and axis
 * quality in the engine.
 */

import { appendSledPointPositionsRangeMetered, getRiderMetered } from "../lib/detector.ts";
import { makeSolidLine } from "./arc.ts";
import {
  CALIB,
  CANDIDATE_SAMPLE_MODES,
  FPS,
  type Arc,
  type ArcPlacementCounter,
  type ArcPlacementMode,
  type AxisValues,
  type CandidateSampleMode,
  type CompileStats,
  type Gap,
  type TrackLine,
  authoredSpeedToPx,
  elevationToLaunchVy,
} from "./types.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

const GEOMETRY_RNG_DRAWS = 7;
const CONTACT_POINT_JITTER = 3.5;
const TARGET_GRAIN_LINE_LENGTH_PX = 49;
const PLACEMENT_SPEED_SPAN_PX = authoredSpeedToPx(1) - authoredSpeedToPx(0);
const PLACEMENT_SPEED_MIN_PX = authoredSpeedToPx(0);
const PRE_TARGET_PRECLEAR_DISTANCE = 2.5;
const SEGMENT_COLLISION_RISK_STRIDE = 7;

// ── work-new contact-centered line family (energy-launch + air-length + 2D span) ──
// Ported from the work-new compiler (HEADLINE 579), whose `continuous` mode routed
// every NORMAL contact through this family. It is the principled trajectory-shaping
// generator the target_state rewrite simplified away: the post-contact launch angle
// is derived from energy conservation so the track UNDULATES to hit the speed target,
// the grounded ride-out length is sized to hit the air target, and both are SPANNED
// across the per-gap attempt batch (the cost-sorted handoff keeps the best valid
// catch) — that span is the generation diversity the search lacked.
// DEFAULT family; LR_NORMAL_FAMILY=target_state opts out to the old generator for A/B.
//
// SPEED_AXIS pressure/carry breakpoints are inlined here as locals because the
// SPEED_AXIS object lives inside the fingerprint-hashed types.ts slice and must not
// change. speedAuthoredBreakpointToPx is an alias of authoredSpeedToPx on work-new.
const CC_PRESSURE_START_PX = 7.8;
const CC_PRESSURE_SPAN_PX = 6.6;
const CC_CARRY_START_PX = authoredSpeedToPx(0.55);
const CC_CARRY_SPAN_PX = authoredSpeedToPx(0.95) - authoredSpeedToPx(0.55);
const CC_CARRY_FADE_START_PX = authoredSpeedToPx(0.78);
const CC_CARRY_FADE_SPAN_PX = authoredSpeedToPx(0.90) - authoredSpeedToPx(0.78);
const CONTACT_CENTERED_POINT_JITTER = 4;
const CONTACT_CENTERED_GUIDED_DECAY_ATTEMPTS = 4;
const CONTACT_CENTERED_GUIDED_ROLL_SPREAD = 0.18;
const CONTACT_CENTERED_GUIDED_POINT_SPREAD = 0.08;
const HIGH_AIR_LENGTH_BLEND_PRESSURE_START = 0.68;
const HIGH_AIR_LENGTH_BLEND_PRESSURE_SPAN = 0.24;
const HIGH_AIR_LENGTH_BLEND_EXTRA = 0.28;
const DENSE_SPACING_CAP_GRAIN_MIN = 0.50;
const DENSE_SPACING_CAP_MAX_NEXT_CONTACT_FRAMES = 14;
const CONTACT_CENTERED_RNG_DRAWS = 8;
const LAUNCH_GRAVITY_PX_PER_FRAME2 = 0.175;
/** Budget-aware post-contact ride-out CURVATURE. The ride-out angle was lerped
 *  linearly start→end; biasing the interpolation makes the path concave/convex — a
 *  new shape dimension across the attempt batch that the cost-sorted handoff selects
 *  from. Measured: full curvature lifts scarce-budget COMPLETION a lot (25k +19, 50k
 *  +54 — more shapes to find a valid chain) but DILUTES the converged high-budget
 *  quality. So fade the span out as the compile budget grows: full ≤50k, off ≥100k.
 *  Deterministic per attempt (low-discrepancy salt, no rng draw). */
const CONTACT_CENTERED_POST_CURVE_BIAS_SPAN = 0.6;
const CONTACT_CENTERED_POST_CURVE_FADE_START_FRAMES = 50_000;
const CONTACT_CENTERED_POST_CURVE_FADE_SPAN_FRAMES = 50_000;

/** Elevation steering. The post-contact ride-out angle decides where the rider
 *  goes next; up is −angle (screen y points down). When `elevation` is targeted
 *  we set that launch from the speed-relative elevation band (see types.ts
 *  `elevationToLaunchVy`): the authored value resolves to a launch vy against the
 *  vertical-velocity budget the current speed supports. The MIN/MAX widen the
 *  post-angle range past its speed/air defaults so a real climb is reachable. */
const ELEVATION_POST_ANGLE_MIN = -62;
const ELEVATION_POST_ANGLE_MAX = 70;

/** Per-compile frame budget, set once at compileHandoff entry (each compile is a
 *  single independent budget, run in its own worker / sequentially), read by the
 *  budget-aware geometry. A per-compile constant, so determinism stays per
 *  (spec, seed, budget) and the per-node candidate cache remains valid. */
let currentCompileBudgetFrames = 0;
export function setCompileBudgetFrames(frames: number): void {
  currentCompileBudgetFrames = Math.max(0, frames | 0);
}

type ProcessEnv = Record<string, string | undefined>;
const PROCESS_ENV = (globalThis as { process?: { env?: ProcessEnv } }).process?.env;
let normalFamilyRaw: string | undefined;
let normalFamilyValue = true;
let normalFamilyValid = false;

/** The NORMAL candidate stream uses the ported work-new contact-centered family
 *  (energy launch + air-length + 2D span) by DEFAULT — it scores canonical HEADLINE
 *  552 vs the target_state generator's 454 (decide ACCEPT, Δ+97.8). Opt back to the
 *  old generator for A/B with LR_NORMAL_FAMILY=target_state. */
export function contactCenteredNormalEnabled(): boolean {
  const raw = PROCESS_ENV?.LR_NORMAL_FAMILY;
  if (normalFamilyValid && raw === normalFamilyRaw) return normalFamilyValue;
  normalFamilyRaw = raw;
  normalFamilyValid = true;
  normalFamilyValue = raw !== "target_state" && raw !== "0" && raw !== "off";
  return normalFamilyValue;
}

type SegmentCollisionRiskLines = number[];

export type ArcPlacementStats = NonNullable<CompileStats["arc_placement"]>;
export type ArcPlacementDirectFailureReason = "survival" | "landing" | "offbeat";

export type ImpactTargetPointState = {
  sledX: number;
  sledY: number;
};

export type ImpactFrameTargetState = ImpactTargetPointState & {
  velocity: { x: number; y: number };
  speed: number;
  angleDeg: number;
};

export type PreTargetSledTrace = number[];

export type ArcPlacementRuntimeMode = ArcPlacementMode;

export type ArcPlacementGeometry =
  | { kind: "arc"; arc: Arc }
  | { kind: "lines"; lines: TrackLine[] };

type PlacementRolls = {
  segmentLength: number;
  contactAngle: number;
  preLength: number;
  postLength: number;
  preAngle: number;
  postAngle: number;
  point: number;
};

export function arcPlacementMode(): ArcPlacementRuntimeMode {
  return "target_state";
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
    mode: arcPlacementMode(),
    ...makeArcPlacementCounter(),
    by_sample_mode: Object.fromEntries(
      CANDIDATE_SAMPLE_MODES.map((mode) => [mode, makeArcPlacementCounter()]),
    ) as Record<CandidateSampleMode, ArcPlacementCounter>,
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

export function snapshotArcPlacementStats(): ArcPlacementStats {
  return {
    ...arcPlacementStats,
    by_sample_mode: Object.fromEntries(
      CANDIDATE_SAMPLE_MODES.map((mode) => [
        mode,
        { ...arcPlacementStats.by_sample_mode[mode] },
      ]),
    ) as Record<CandidateSampleMode, ArcPlacementCounter>,
  };
}

export function recordArcPlacementSample(mode?: CandidateSampleMode): void {
  incrementCounter("sampled", mode);
}

export function recordArcPlacementPreclearReject(mode?: CandidateSampleMode): void {
  incrementCounter("preclear_rejected", mode);
}

export function recordArcPlacementDirectAttempt(mode?: CandidateSampleMode): void {
  incrementCounter("direct_attempted", mode);
}

export function recordArcPlacementDirectLanding(mode?: CandidateSampleMode): void {
  incrementCounter("direct_landed", mode);
}

export function recordArcPlacementDirectFailure(
  mode?: CandidateSampleMode,
  reason?: ArcPlacementDirectFailureReason,
): void {
  incrementCounter("direct_failed", mode);
  if (reason === "survival") incrementCounter("direct_survival_failed", mode);
  if (reason === "landing") incrementCounter("direct_landing_failed", mode);
  if (reason === "offbeat") incrementCounter("direct_offbeat_failed", mode);
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
  const angleDeg = speed > 0
    ? (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI
    : 0;
  return { sledX, sledY, velocity, speed, angleDeg };
}

export function sampleArcPlacementGeometry(
  rng: () => number,
  _refX: number,
  _refY: number,
  targets: AxisValues,
  targetState: ImpactFrameTargetState,
  attempt: number,
  gap: Gap,
  lineIdStart: number,
  mode: CandidateSampleMode = "normal",
  allContactFrames: readonly number[] = [],
): ArcPlacementGeometry {
  recordArcPlacementSample(mode);
  if (mode === "normal" && contactCenteredNormalEnabled()) {
    return {
      kind: "lines",
      lines: sampleContactCenteredLines(
        rng, targetState, targets, gap, lineIdStart, allContactFrames, attempt,
      ),
    };
  }
  return {
    kind: "lines",
    lines: sampleTargetStateLines(
      drawPlacementRolls(rng), targetState, targets, gap, lineIdStart, allContactFrames, attempt,
      mode,
    ),
  };
}

/** Compatibility for reachability probes that still ask for an Arc. The active
 *  compiler path uses `sampleArcPlacementGeometry()` and emits line fragments. */
export function sampleArcParams(
  rng: () => number,
  _refX: number,
  _refY: number,
  targets: AxisValues,
  targetState: ImpactFrameTargetState,
  attempt: number,
  gap: Gap,
  mode: CandidateSampleMode = "normal",
): Arc {
  return sampleTargetStateArc(drawPlacementRolls(rng), targetState, targets, gap, attempt, mode);
}

export function sampleArcParamsRngDraws(
  _targetState: { speed: number; angleDeg: number },
  _gap: Gap,
  _attempt: number,
  mode: CandidateSampleMode = "normal",
): number {
  if (mode === "normal" && contactCenteredNormalEnabled()) return CONTACT_CENTERED_RNG_DRAWS;
  return GEOMETRY_RNG_DRAWS;
}

function drawPlacementRolls(rng: () => number): PlacementRolls {
  return {
    segmentLength: rng(),
    contactAngle: rng(),
    preLength: rng(),
    postLength: rng(),
    preAngle: rng(),
    postAngle: rng(),
    point: rng(),
  };
}

function sampleTargetStateLines(
  rawRolls: PlacementRolls,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  lineIdStart: number,
  allContactFrames: readonly number[],
  attempt: number,
  mode: CandidateSampleMode,
): TrackLine[] {
  const rolls = guidedRolls(rawRolls, attempt, targetState, targets, gap, allContactFrames);
  const controls = targetStateControls(targetState, targets, gap, allContactFrames, rolls, mode);
  const contactAngleRad = (controls.contactAngleDeg * Math.PI) / 180;
  const tangentX = Math.cos(contactAngleRad);
  const tangentY = Math.sin(contactAngleRad);
  const normalX = -tangentY;
  const normalY = tangentX;
  const pointTangent = (rolls.point - 0.5) * controls.contactJitter;
  const pointNormal = (lowDiscrepancyRoll(attempt, 6) - 0.5) * controls.contactJitter;
  const contactPoint = {
    x: targetState.sledX + tangentX * pointTangent + normalX * pointNormal,
    y: targetState.sledY + tangentY * pointTangent + normalY * pointNormal,
  };

  const preLines = buildPreContactLines(
    lineIdStart,
    contactPoint,
    controls.preAngleDeg,
    controls.contactAngleDeg,
    controls.preLength,
    controls.preSegments,
  );
  const postLines = buildPostContactLines(
    lineIdStart + preLines.length,
    contactPoint,
    controls.contactAngleDeg,
    controls.postAngleDeg,
    controls.postLength,
    controls.postSegments,
  );
  return [...preLines, ...postLines];
}

function sampleTargetStateArc(
  rawRolls: PlacementRolls,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  attempt: number,
  mode: CandidateSampleMode,
): Arc {
  const rolls = guidedRolls(rawRolls, attempt, targetState, targets, gap, []);
  const controls = targetStateControls(targetState, targets, gap, [], rolls, mode);
  const length = clamp(controls.preLength + controls.postLength, 45, 180);
  const segments = clampInt(Math.round(length / controls.segmentLength), 3, 12);
  const curveBias = clamp((rolls.postAngle - 0.5) * 0.8, -0.6, 0.6);
  const arc: Arc = {
    anchor: { x: 0, y: 0 },
    length,
    startAngleDeg: controls.preAngleDeg,
    endAngleDeg: controls.postAngleDeg,
    segments,
    curveBias,
  };
  const impactT = clamp(controls.preLength / length, 0.25, 0.75);
  const local = arcLocalPointAt(arc, impactT);
  return {
    ...arc,
    anchor: {
      x: targetState.sledX - local.x,
      y: targetState.sledY - local.y,
    },
  };
}

function targetStateControls(
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  allContactFrames: readonly number[],
  rolls: PlacementRolls,
  mode: CandidateSampleMode,
): {
  segmentLength: number;
  contactAngleDeg: number;
  preAngleDeg: number;
  postAngleDeg: number;
  preLength: number;
  postLength: number;
  preSegments: number;
  postSegments: number;
  contactJitter: number;
} {
  const gapFrames = Math.max(1, gap.endFrame - gap.startFrame);
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  const targetSpeedPx = targets.speed === undefined
    ? targetState.speed
    : authoredSpeedToPx(targets.speed);
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const lowAir = clamp((0.55 - air) / 0.55, 0, 1);
  const highAir = clamp((air - 0.45) / 0.55, 0, 1);
  const targetPace = clamp(
    (targetSpeedPx - PLACEMENT_SPEED_MIN_PX) / PLACEMENT_SPEED_SPAN_PX,
    0,
    1,
  );
  const speedError = clamp(
    (targetSpeedPx - targetState.speed) / PLACEMENT_SPEED_SPAN_PX,
    -1,
    1,
  );
  const overspeed = clamp(-speedError, 0, 1);
  const brakeModePressure = mode === "brake" && targets.speed !== undefined
    ? smoothstep(overspeed)
    : 0;
  // speed_drag / low_air_settle: retired candidate-sample modes (axis-quality streams ablated in
  // Phase 2). Never generated → these pressures are always 0. Kept as 0 constants so the downstream
  // geometry arithmetic stays byte-identical; the ×0 terms can be folded out in a later pass.
  const speedDragModePressure = 0;
  const lowAirSettlePressure = 0;
  const startupCatchPressure = mode === "startup_catch"
    ? smoothstep(1 / (1 + Math.pow(gap.startFrame / (FPS * 0.75), 2)))
    : 0;
  const startupLandingPressure = startupCatchPressure * clamp(
    0.35 + 0.35 * highAir + 0.30 * targetPace,
    0,
    1,
  );
  const deadline = clamp((18 - gapFrames) / 12, 0, 1);
  const dense = nextGapFrames === null ? 0 : clamp((18 - nextGapFrames) / 14, 0, 1);
  const denseFastAir = highAir * dense * targetPace;
  const brakeLandingUncertainty = (brakeModePressure + 0.6 * speedDragModePressure) * clamp(
    0.35 + 0.35 * targetPace + 0.30 * highAir,
    0,
    1,
  );
  const contactJitter = CONTACT_POINT_JITTER *
    lerp(1, 1.5, brakeLandingUncertainty) *
    lerp(1, 2.2, startupLandingPressure) *
    lerp(1, 0.72, lowAirSettlePressure);
  const preclearPressure = clamp(
    0.35 * deadline + denseFastAir + 0.32 * overspeed +
      0.18 * brakeModePressure + 0.12 * speedDragModePressure +
      0.42 * startupLandingPressure + 0.08 * lowAirSettlePressure,
    0,
    1,
  );
  const speedControlPressure = clamp(
    overspeed + 0.55 * denseFastAir + 0.38 * brakeModePressure +
      0.50 * speedDragModePressure + 0.12 * lowAirSettlePressure * overspeed,
    0,
    1,
  );

  const segmentLength = targets.grain === undefined
    ? 12 + rolls.segmentLength * 28
    : clamp(targets.grain * TARGET_GRAIN_LINE_LENGTH_PX + (rolls.segmentLength - 0.5) * 8, 5, 49);

  const baseAngle = clamp(targetState.angleDeg, -25, 75);
  const contactAngleDeg = clamp(
    baseAngle
      + 12 * speedError
      - 14 * lowAir
      + 10 * highAir
      + 4 * dense
      - 10 * preclearPressure
      - 5 * brakeModePressure
      - 8 * speedDragModePressure
      - 5 * startupLandingPressure
      - 5 * lowAirSettlePressure
      + (rolls.contactAngle - 0.5) * lerp(14, 24, startupLandingPressure),
    -22,
    74,
  );
  const preAngleDeg = clamp(
    contactAngleDeg
      - 5
      - 8 * deadline
      + 3 * lowAir
      - 6 * brakeModePressure
      - 10 * speedDragModePressure
      - 10 * startupLandingPressure
      - 2 * lowAirSettlePressure
      + (rolls.preAngle - 0.5) * lerp(10, 18, startupLandingPressure),
    -28,
    78,
  );
  const postAngleMin = lerp(lerp(-26, -34, lowAirSettlePressure), -42, speedDragModePressure);
  const postAngleDeg = clamp(
    contactAngleDeg
      + 14 * speedError
      - 18 * lowAir
      + 20 * highAir
      - 8 * dense
      - 18 * speedControlPressure
      - 12 * brakeModePressure
      - 28 * speedDragModePressure
      - 8 * startupLandingPressure
      - 9 * lowAirSettlePressure
      + (rolls.postAngle - 0.5) * 14,
    postAngleMin,
    78,
  );

  const preLength = clamp(
    (6 + rolls.preLength * 32) *
      (1 - 0.45 * deadline) *
      (1 + 0.25 * lowAir) *
      (1 - 0.88 * preclearPressure) *
      (1 - 0.24 * brakeModePressure) *
      (1 - 0.92 * startupLandingPressure) *
      (1 - 0.18 * lowAirSettlePressure),
    0,
    50,
  );
  const sampledPost =
    (28 + rolls.postLength * 140) *
    (1 + 0.20 * lowAir + 0.12 * highAir) *
    (1 - 0.34 * speedControlPressure) *
    (1 - 0.18 * brakeModePressure) *
    (1 + 0.35 * speedDragModePressure) *
    (1 - 0.28 * startupLandingPressure) *
    (1 + 0.24 * lowAirSettlePressure);
  const targetGroundFrames = nextGapFrames === null
    ? 6 + 18 * lowAir
    : clamp((1 - air) * nextGapFrames, 2, nextGapFrames * (0.72 - 0.22 * dense));
  const targetPost = Math.max(18, Math.max(1, targetState.speed) * targetGroundFrames);
  const safePostCap = nextGapFrames === null
    ? 220
    : clamp(
      Math.max(1, targetState.speed) *
        nextGapFrames *
        (0.34 + 0.26 * lowAir - 0.08 * dense) *
        (1 - 0.30 * speedControlPressure) *
        (1 - 0.18 * brakeModePressure) *
        (1 + 0.45 * speedDragModePressure) *
        (1 - 0.30 * startupLandingPressure) *
        (1 + 0.18 * lowAirSettlePressure),
      14,
      260,
    );
  const basePostFloor = Math.min(
    safePostCap,
    lerp(18, 8, clamp(denseFastAir + overspeed + 0.6 * brakeModePressure, 0, 1)),
  );
  const postFloor = Math.min(
    safePostCap,
    lerp(
      lerp(basePostFloor, Math.min(safePostCap, 28), speedDragModePressure),
      Math.min(safePostCap, 18 + 10 * lowAir),
      startupLandingPressure,
    ),
  );
  const supportPostFloor = Math.min(safePostCap, 22 + 18 * lowAir);
  const postLength = clamp(
    lerp(
      sampledPost,
      Math.min(targetPost, safePostCap),
      lerp(0.72, 0.88, lowAirSettlePressure),
    ),
    lerp(postFloor, supportPostFloor, lowAirSettlePressure),
    safePostCap,
  );

  return {
    segmentLength,
    contactAngleDeg,
    preAngleDeg,
    postAngleDeg,
    preLength,
    postLength,
    preSegments: preLength <= 1 ? 0 : clampInt(Math.round(preLength / segmentLength), 1, 6),
    postSegments: clampInt(Math.round(postLength / segmentLength), 2, 18),
    contactJitter,
  };
}

function guidedRolls(
  rolls: PlacementRolls,
  attempt: number,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  allContactFrames: readonly number[],
): PlacementRolls {
  const guide = placementGuideWeight(attempt, targetState, targets, gap, allContactFrames);
  return {
    segmentLength: guidedRoll(rolls.segmentLength, attempt, 0, guide),
    contactAngle: guidedRoll(rolls.contactAngle, attempt, 1, guide),
    preLength: guidedRoll(rolls.preLength, attempt, 2, guide),
    postLength: guidedRoll(rolls.postLength, attempt, 3, guide),
    preAngle: guidedRoll(rolls.preAngle, attempt, 4, guide),
    postAngle: guidedRoll(rolls.postAngle, attempt, 5, guide),
    point: guidedRoll(rolls.point, attempt, 6, guide),
  };
}

function placementGuideWeight(
  attempt: number,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  allContactFrames: readonly number[],
): number {
  const baseGuide = 1 / (1 + Math.pow(Math.max(0, attempt) / 6, 2));
  const targetSpeedPx = targets.speed === undefined
    ? targetState.speed
    : authoredSpeedToPx(targets.speed);
  const targetPace = clamp(
    (targetSpeedPx - PLACEMENT_SPEED_MIN_PX) / PLACEMENT_SPEED_SPAN_PX,
    0,
    1,
  );
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const highAir = clamp((air - 0.45) / 0.55, 0, 1);
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  const cadencePressure = nextGapFrames === null
    ? 0
    : 1 / (1 + Math.pow(nextGapFrames / (FPS * 0.55), 2));
  const startupPressure = 1 / (1 + Math.pow(gap.startFrame / (FPS * 1.25), 2));
  const explorationPressure = clamp(
    targetPace * (0.50 * startupPressure + 0.35 * cadencePressure + 0.15 * highAir),
    0,
    1,
  );
  return baseGuide * lerp(1, 0.35, explorationPressure);
}

function guidedRoll(raw: number, attempt: number, salt: number, weight: number): number {
  return clamp(lerp(raw, lowDiscrepancyRoll(attempt, salt), weight), 0, 1);
}

function lowDiscrepancyRoll(attempt: number, salt: number): number {
  const stride = 0.6180339887498949;
  const offset = (salt + 1) * 0.137503523749935;
  return fract((Math.max(0, attempt) + 1) * stride + offset);
}

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

/** Ported from work-new `sampleContactCenteredLinesWithDiagnostics`. Emits one
 *  pre+post line catch through the predicted sled position, but the post-contact
 *  launch angle and grounded ride-out length are physically shaped (energy launch
 *  + air-targeted length) and SPANNED across the per-gap attempt batch so the
 *  cost-sorted handoff can keep the best valid trajectory. Consumes exactly
 *  CONTACT_CENTERED_RNG_DRAWS (8) rng() draws — must match sampleArcParamsRngDraws. */
function sampleContactCenteredLines(
  rng: () => number,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  lineIdStart: number,
  allContactFrames: readonly number[],
  attempt: number,
): TrackLine[] {
  const rawRolls: ContactCenteredRolls = {
    segmentLengthRoll: rng(),
    contactAngleRoll: rng(),
    preLengthRoll: rng(),
    postLengthRoll: rng(),
    preAngleRoll: rng(),
    postAngleRoll: rng(),
    tangentJitterRoll: rng(),
    normalJitterRoll: rng(),
  };
  const guidedRolls = guideContactCenteredRolls(
    rawRolls, targetState, targets, gap, allContactFrames, attempt,
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
    (targetState.speed - CC_PRESSURE_START_PX) / CC_PRESSURE_SPAN_PX, 0, 1,
  );
  const brakePressure = clamp((targetState.speed - targetSpeedPx) / CC_PRESSURE_SPAN_PX, 0, 1);
  const accelPressure = clamp((targetSpeedPx - targetState.speed) / CC_PRESSURE_SPAN_PX, 0, 1);
  const speedCarryPressure = clamp((targetSpeedPx - CC_CARRY_START_PX) / CC_CARRY_SPAN_PX, 0, 1)
    * (1 - clamp((targetSpeedPx - CC_CARRY_FADE_START_PX) / CC_CARRY_FADE_SPAN_PX, 0, 1));
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
    -12, 65,
  );
  const preLength = clamp(
    (6 + guidedRolls.preLengthRoll * 28)
      * (1 - 0.45 * clearancePressure)
      * (1 + 0.35 * brakePressure),
    4, 44,
  );
  const rawPostLength = (45 + guidedRolls.postLengthRoll * 135)
    * (0.95 + 0.25 * (1 - air) + 0.20 * absoluteSpeedPressure
      + 0.18 * sustainedContactCarryPressure + 0.12 * brakePressure);
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
    -20, 70,
  );
  const nonBrakePostAngleDeg = contactAngleDeg
    - (3 + 6 * air)
    + 10 * accelPressure
    + 6 * speedCarryPressure
    + 6 * sustainedContactCarryPressure
    + (guidedRolls.postAngleRoll - 0.5) * 10;
  const brakeRideOutAngleDeg = clamp(
    contactAngleDeg + 8 + (guidedRolls.postAngleRoll - 0.5) * 10, -8, 18,
  );
  const angledPostAngleDeg = clamp(
    lerp(nonBrakePostAngleDeg, brakeRideOutAngleDeg, brakePressure), -8, 65,
  );

  // Energy-targeted launch: height shapes speed. dh = (vT²−vIn²)/2g is the drop
  // that converts the rider's pace to the gap target; vy = dh/N − ½gN lands it that
  // far below current height after N frames (clamped so it is still descending at
  // the next contact). Spanned from the local ride-out to the fully energy-shaped.
  let postAngleDeg = angledPostAngleDeg;
  if (nextGapFrames !== null) {
    const blend = clamp(ccSpanBlends(attempt).launch, 0, 1);
    const g = LAUNCH_GRAVITY_PX_PER_FRAME2;
    const N = nextGapFrames;
    const vIn = Math.max(1, targetState.velocity.x);
    const vT = Math.max(1, targetSpeedPx);
    const dhDown = (vT * vT - vIn * vIn) / (2 * g);
    const vyLevel = -0.5 * g * N;
    const vyTarget = dhDown / N + vyLevel;
    const vyClamped = clamp(vyTarget, -0.92 * g * N, 0.45 * g * N);
    const energyLaunchDeg = (Math.atan2(vyClamped, vIn) * 180) / Math.PI;
    postAngleDeg = lerp(angledPostAngleDeg, energyLaunchDeg, blend);
  }

  // Elevation-targeted launch (speed-relative). Gated on the axis being targeted
  // so specs that never set elevation stay byte-identical. The authored elevation
  // resolves against the vertical-velocity band the current speed supports, so
  // climb is "as steep as this speed allows" rather than a fixed angle. Up is −y.
  if (targets.elevation !== undefined && nextGapFrames !== null) {
    const vy = elevationToLaunchVy(targets.elevation, targetState.speed, nextGapFrames);
    const vx = Math.sqrt(Math.max(1, targetState.speed * targetState.speed - vy * vy));
    const elevationLaunchDeg = (Math.atan2(vy, vx) * 180) / Math.PI;
    // Span the climb aggressiveness across the attempt batch rather than forcing
    // it every candidate: blend 0 keeps the speed-preserving ride-out, blend 1 is
    // the full band launch. Survival gates drop the stallers and the cost ranks
    // the rest, so the rider gets the steepest *surviving* climb.
    const blend = clamp(ccSpanBlends(attempt).launch, 0, 1);
    postAngleDeg = clamp(
      lerp(postAngleDeg, elevationLaunchDeg, blend),
      ELEVATION_POST_ANGLE_MIN, ELEVATION_POST_ANGLE_MAX,
    );
  }

  // Air-targeted grounded ride-out length: longer grounded ride ⇒ less air. Size
  // toward (1−air) of the span to the next contact, capped so it never reaches the
  // next beat. Spanned across the attempt batch.
  let postLength = clamp(sampledPostLength, 28, 220);
  if (nextGapFrames !== null && targets.air !== undefined) {
    const speed = Math.max(1, targetState.speed);
    const groundedTargetLen = speed * clamp(1 - air, 0, 1) * nextGapFrames;
    const safeCap = speed * nextGapFrames * 0.55;
    const targetLen = clamp(Math.min(groundedTargetLen, safeCap), 28, 360);
    const blend = clamp(ccSpanBlends(attempt).length, 0, 1);
    const highAirPressure = clamp(
      (air - HIGH_AIR_LENGTH_BLEND_PRESSURE_START) / HIGH_AIR_LENGTH_BLEND_PRESSURE_SPAN, 0, 1,
    );
    const blendStrength = 0.6 + HIGH_AIR_LENGTH_BLEND_EXTRA * highAirPressure;
    postLength = clamp(lerp(sampledPostLength, targetLen, blend * blendStrength), 28, 360);
  }

  // Amplitude-targeted ballistic arc. Gated on the axis being targeted so specs
  // that never set amplitude stay byte-identical. Amplitude is the *height* of the
  // airborne arc (pop above the takeoff→landing chord); for a ballistic arc that
  // lands N frames later it is ≈ g·N²/8, maximized by launching the symmetric arc
  // (vy = −½gN) that fills the whole gap AND shortening the grounded ride-out so
  // the rider is aloft longer. This is bounded by gap length — big airs need long
  // gaps — but it consolidates the per-gap arc into one clean pop instead of a
  // flutter, and scales up naturally where contacts are sparse.
  if (targets.amplitude !== undefined && nextGapFrames !== null) {
    const amp = clamp(targets.amplitude, 0, 1);
    const vyArc = -0.5 * LAUNCH_GRAVITY_PX_PER_FRAME2 * nextGapFrames; // fills the gap
    const vxArc = Math.max(1, targetState.velocity.x);
    const arcLaunchDeg = (Math.atan2(vyArc, vxArc) * 180) / Math.PI;
    const blend = clamp(ccSpanBlends(attempt).launch, 0, 1) * amp;
    postAngleDeg = clamp(
      lerp(postAngleDeg, arcLaunchDeg, blend),
      ELEVATION_POST_ANGLE_MIN, ELEVATION_POST_ANGLE_MAX,
    );
    // Shorten the grounded ride-out so the airborne arc fills more of the gap.
    postLength = lerp(postLength, 28, blend);
  }

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

  // LR_CURVE_FADE_OFF=1 keeps curvature at FULL span across all budgets (experiment:
  // does this diversity now pay at high budget once the forward-eval ranker can sort it?).
  const curveFade = PROCESS_ENV?.LR_CURVE_FADE_OFF === "1" ? 1 : 1 - smoothstep(
    (currentCompileBudgetFrames - CONTACT_CENTERED_POST_CURVE_FADE_START_FRAMES) /
      CONTACT_CENTERED_POST_CURVE_FADE_SPAN_FRAMES,
  );
  const postCurveBias = curveFade <= 0 ? 0
    : (lowDiscrepancyRoll(attempt, 8) - 0.5) * 2 *
      CONTACT_CENTERED_POST_CURVE_BIAS_SPAN * curveFade;

  const preLines = buildPreContactLines(
    lineIdStart, contactPoint, preAngleDeg, contactAngleDeg, preLength, preSegments,
  );
  const postLines = buildPostContactLines(
    lineIdStart + preLines.length, contactPoint, contactAngleDeg, postAngleDeg,
    postLength, postSegments, postCurveBias,
  );
  return [...preLines, ...postLines];
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
    (targetState.speed - CC_PRESSURE_START_PX) / CC_PRESSURE_SPAN_PX, 0, 1,
  );
  const brakePressure = clamp((targetState.speed - targetSpeedPx) / CC_PRESSURE_SPAN_PX, 0, 1);
  const accelPressure = clamp((targetSpeedPx - targetState.speed) / CC_PRESSURE_SPAN_PX, 0, 1);
  const speedCarryPressure = clamp((targetSpeedPx - CC_CARRY_START_PX) / CC_CARRY_SPAN_PX, 0, 1)
    * (1 - clamp((targetSpeedPx - CC_CARRY_FADE_START_PX) / CC_CARRY_FADE_SPAN_PX, 0, 1));
  const scarcity = Math.max(deadlinePressure, denseContactPressure);

  const guided: ContactCenteredRolls = {
    segmentLengthRoll: targets.grain === undefined
      ? clamp(0.42 + 0.12 * denseContactPressure - 0.08 * air, 0.20, 0.80)
      : 0.50,
    contactAngleRoll: clamp(
      0.50 - 0.08 * brakePressure + 0.06 * accelPressure + 0.04 * denseContactPressure, 0.24, 0.76,
    ),
    preLengthRoll: clamp(
      0.36 + 0.18 * brakePressure - 0.18 * scarcity + 0.08 * absoluteSpeedPressure, 0.10, 0.82,
    ),
    postLengthRoll: clamp(
      0.24 + 0.48 * (1 - air) + 0.14 * speedCarryPressure
        + 0.08 * brakePressure - 0.22 * denseContactPressure, 0.08, 0.90,
    ),
    preAngleRoll: clamp(0.50 - 0.10 * deadlinePressure - 0.06 * brakePressure, 0.22, 0.78),
    postAngleRoll: clamp(
      0.48 + 0.10 * accelPressure + 0.08 * speedCarryPressure
        - 0.06 * air + 0.04 * denseContactPressure, 0.22, 0.82,
    ),
    tangentJitterRoll: 0.50,
    normalJitterRoll: 0.50,
  };

  const guide = contactCenteredGuideWeight(attempt);
  return {
    segmentLengthRoll: ccGuidedRoll(rolls.segmentLengthRoll, guided.segmentLengthRoll, attempt, 0, guide),
    contactAngleRoll: ccGuidedRoll(rolls.contactAngleRoll, guided.contactAngleRoll, attempt, 1, guide),
    preLengthRoll: ccGuidedRoll(rolls.preLengthRoll, guided.preLengthRoll, attempt, 2, guide),
    postLengthRoll: ccGuidedRoll(rolls.postLengthRoll, guided.postLengthRoll, attempt, 3, guide),
    preAngleRoll: ccGuidedRoll(rolls.preAngleRoll, guided.preAngleRoll, attempt, 4, guide),
    postAngleRoll: ccGuidedRoll(rolls.postAngleRoll, guided.postAngleRoll, attempt, 5, guide),
    tangentJitterRoll: ccGuidedRoll(
      rolls.tangentJitterRoll, guided.tangentJitterRoll, attempt, 6, guide,
      CONTACT_CENTERED_GUIDED_POINT_SPREAD,
    ),
    normalJitterRoll: ccGuidedRoll(
      rolls.normalJitterRoll, guided.normalJitterRoll, attempt, 7, guide,
      CONTACT_CENTERED_GUIDED_POINT_SPREAD,
    ),
  };
}

function contactCenteredGuideWeight(attempt: number): number {
  const scaled = Math.max(0, attempt) / CONTACT_CENTERED_GUIDED_DECAY_ATTEMPTS;
  return 1 / (1 + scaled * scaled);
}

function ccGuidedRoll(
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

/** Per-attempt span blends for launch shaping and ride-out length. 2-D (work-new
 *  default): launch and length vary INDEPENDENTLY over a 16-step grid (8 coupled
 *  diagonal + 8 anti-diagonal) so the pool covers off-diagonal (launch × length)
 *  points the 1-D diagonal never reaches — more diverse valid continuations per gap. */
function ccSpanBlends(attempt: number): { launch: number; length: number } {
  const a = ((attempt % 4096) + 4096) % 4096;
  const k = a % 16;
  if (k < 8) {
    const b = k / 7;
    return { launch: b, length: b };
  }
  const b = (k - 8) / 7;
  return { launch: b, length: clamp(1 - b, 0, 1) };
}

function needsDenseSpacingPostLengthCap(
  targets: AxisValues,
  nextGapFrames: number | null,
): boolean {
  if (nextGapFrames === null) return false;
  return (targets.grain ?? 0) >= DENSE_SPACING_CAP_GRAIN_MIN
    && nextGapFrames <= DENSE_SPACING_CAP_MAX_NEXT_CONTACT_FRAMES;
}

function buildPreContactLines(
  lineIdStart: number,
  contactPoint: { x: number; y: number },
  startAngleDeg: number,
  endAngleDeg: number,
  length: number,
  segments: number,
): TrackLine[] {
  if (segments <= 0 || length <= 0) return [];
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
  curveBias = 0,
): TrackLine[] {
  const segLen = length / segments;
  let x = contactPoint.x;
  let y = contactPoint.y;
  const lines = new Array<TrackLine>(segments);
  for (let i = 0; i < segments; i++) {
    const t = segments === 1 ? 1 : i / (segments - 1);
    const ft = curveBias === 0 ? t : applyArcCurveBias(t, curveBias);
    const a = (lerp(startAngleDeg, endAngleDeg, ft) * Math.PI) / 180;
    const x2 = x + Math.cos(a) * segLen;
    const y2 = y + Math.sin(a) * segLen;
    lines[i] = makeSolidLine(lineIdStart + i, x, y, x2, y2);
    x = x2;
    y = y2;
  }
  return lines;
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
        Math.abs(signedDistance) <= PRE_TARGET_PRECLEAR_DISTANCE
      ) {
        return true;
      }
    }
  }
  return false;
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

function arcLocalPointAt(
  arc: Pick<Arc, "length" | "startAngleDeg" | "endAngleDeg" | "segments" | "curveBias">,
  t: number,
): { x: number; y: number } {
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
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const nextTraveled = traveled + segLen;
    if (targetDistance <= nextTraveled || i === arc.segments - 1) {
      const within = clamp(targetDistance - traveled, 0, segLen);
      return { x: x + dx * within, y: y + dy * within };
    }
    x += dx * segLen;
    y += dy * segLen;
    traveled = nextTraveled;
  }
  return { x, y };
}

function framesUntilNextContact(gap: Gap, allContactFrames: readonly number[]): number | null {
  const next = allContactFrames.find((frame) => frame > gap.endFrame);
  return next === undefined ? null : next - gap.endFrame;
}

function applyArcCurveBias(t: number, bias: number): number {
  if (bias === 0) return t;
  if (bias > 0) return Math.pow(t, 1 + bias);
  return 1 - Math.pow(1 - t, 1 - bias);
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

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function clampInt(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(x)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function fract(x: number): number {
  return x - Math.floor(x);
}
