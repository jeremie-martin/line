/**
 * Observation-only state extraction for trajectory-synthesis studies.
 *
 * This module deliberately does not import arc placement or optimizer policy.
 * It exposes the physical state a contact primitive may use, while the exact
 * candidate evaluator remains the sole authority on whether a realization is
 * admissible.
 */
import {
  getRiderMetered,
  SLED_POINT_ORDER,
  sledPoseDegFromRider,
} from "../../lib/detector.ts";
import { COLLISION_UPDATE_TYPE } from "../../lib/update_types.ts";

export type Vec2 = { x: number; y: number };
export type SledPointName = (typeof SLED_POINT_ORDER)[number];

export type PlanningSledPoint = {
  position: Vec2;
  velocity: Vec2 | null;
  relativePosition: Vec2;
  relativeVelocity: Vec2 | null;
};

export type PlanningPhase = {
  contactNow: boolean;
  groundedAgeFrames: number;
  airborneAgeFrames: number;
};

export type PlanningState = {
  frame: number;
  position: Vec2;
  velocity: Vec2;
  speed: number;
  velocityAngleDeg: number;
  /** Lowest sled point at the sampled frame. This anchors contact geometry. */
  reference: Vec2;
  /** Identity of `reference`; explicit so position and tangent cannot drift apart. */
  referencePointName: SledPointName | "rider";
  /** Velocity of `reference` when the engine exposes it. */
  referenceVelocity: Vec2 | null;
  sledPoseDeg: number | null;
  sledPoseRateDegPerFrame: number | null;
  points: Partial<Record<SledPointName, PlanningSledPoint>>;
  phase: PlanningPhase;
};

export type PlanningStateOptions = {
  /** Bounded lookback used only to describe the present phase. */
  historyFrames?: number;
};

/**
 * Read a full, state-relative contact-planning state. The engine is an
 * immutable prefix engine in study callers; reads are metered through the
 * normal detector helper when they need to advance simulation.
 */
// deno-lint-ignore no-explicit-any
export function extractPlanningState(
  engine: any,
  frame: number,
  options: PlanningStateOptions = {},
): PlanningState | null {
  const sampledFrame = Math.max(0, Math.round(frame));
  const rider = getRiderMetered(engine, sampledFrame);
  const position = readVec(rider?.position);
  const velocity = readVec(rider?.velocity);
  if (position === null || velocity === null) return null;

  const points: Partial<Record<SledPointName, PlanningSledPoint>> = {};
  let reference: Vec2 = { ...position };
  let referencePointName: SledPointName | "rider" = "rider";
  let referenceVelocity: Vec2 | null = { ...velocity };
  let lowestY = Number.NEGATIVE_INFINITY;
  for (const name of SLED_POINT_ORDER) {
    const point = rider?.get?.(name);
    const pointPosition = readVec(point?.pos);
    if (pointPosition === null) continue;
    const pointVelocity = readVec(point?.vel ?? point?.velocity);
    points[name] = {
      position: pointPosition,
      velocity: pointVelocity,
      relativePosition: {
        x: pointPosition.x - position.x,
        y: pointPosition.y - position.y,
      },
      relativeVelocity: pointVelocity === null
        ? null
        : { x: pointVelocity.x - velocity.x, y: pointVelocity.y - velocity.y },
    };
    if (pointPosition.y > lowestY) {
      lowestY = pointPosition.y;
      reference = { ...pointPosition };
      referencePointName = name;
      referenceVelocity = pointVelocity === null ? null : { ...pointVelocity };
    }
  }

  const pose = sledPoseDegFromRider(rider);
  const priorPose = sampledFrame > 0
    ? sledPoseDegFromRider(getRiderMetered(engine, sampledFrame - 1))
    : null;
  const historyFrames = Math.max(0, Math.floor(options.historyFrames ?? 12));
  const contactNow = hasSledContact(engine, sampledFrame);
  const phaseAge = consecutivePhaseAge(engine, sampledFrame, contactNow, historyFrames);
  const speed = Math.hypot(velocity.x, velocity.y);

  return {
    frame: sampledFrame,
    position,
    velocity,
    speed,
    velocityAngleDeg: speed > 0 ? radiansToDeg(Math.atan2(velocity.y, velocity.x)) : 0,
    reference,
    referencePointName,
    referenceVelocity,
    sledPoseDeg: pose,
    sledPoseRateDegPerFrame: pose === null || priorPose === null
      ? null
      : normalizeAngleDeg(pose - priorPose),
    points,
    phase: {
      contactNow,
      groundedAgeFrames: contactNow ? phaseAge : 0,
      airborneAgeFrames: contactNow ? 0 : phaseAge,
    },
  };
}

// deno-lint-ignore no-explicit-any
function hasSledContact(engine: any, frame: number): boolean {
  const updates = engine?.getUpdatesAtFrame?.(frame);
  if (!Array.isArray(updates)) return false;
  for (const update of updates) {
    if (update?.type !== COLLISION_UPDATE_TYPE || !Array.isArray(update.updated)) continue;
    if (update.updated.some((point: { id?: unknown }) =>
      typeof point?.id === "string" && (SLED_POINT_ORDER as readonly string[]).includes(point.id)
    )) return true;
  }
  return false;
}

// deno-lint-ignore no-explicit-any
function consecutivePhaseAge(engine: any, frame: number, contact: boolean, historyFrames: number): number {
  let age = 0;
  const first = Math.max(0, frame - historyFrames);
  for (let cursor = frame; cursor >= first; cursor--) {
    if (hasSledContact(engine, cursor) !== contact) break;
    age++;
  }
  return age;
}

function readVec(value: unknown): Vec2 | null {
  if (value === null || typeof value !== "object") return null;
  const candidate = value as { x?: unknown; y?: unknown };
  if (typeof candidate.x !== "number" || typeof candidate.y !== "number") return null;
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y)
    ? { x: candidate.x, y: candidate.y }
    : null;
}

function radiansToDeg(radians: number): number {
  return radians * 180 / Math.PI;
}

function normalizeAngleDeg(angle: number): number {
  let normalized = (angle + 180) % 360;
  if (normalized < 0) normalized += 360;
  return normalized - 180;
}
