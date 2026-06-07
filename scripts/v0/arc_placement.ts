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
} from "./types.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

const GEOMETRY_RNG_DRAWS = 7;
const CONTACT_POINT_JITTER = 3.5;
const TARGET_GRAIN_LINE_LENGTH_PX = 49;
const PLACEMENT_SPEED_SPAN_PX = authoredSpeedToPx(1) - authoredSpeedToPx(0);
const PLACEMENT_SPEED_MIN_PX = authoredSpeedToPx(0);
const PRE_TARGET_PRECLEAR_DISTANCE = 2.5;
const SEGMENT_COLLISION_RISK_STRIDE = 7;

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
  _mode: CandidateSampleMode = "normal",
): number {
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
  const speedDragModePressure = mode === "speed_drag" && targets.speed !== undefined
    ? smoothstep(overspeed)
    : 0;
  const lowAirSettlePressure = mode === "low_air_settle"
    ? smoothstep(lowAir)
    : 0;
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
