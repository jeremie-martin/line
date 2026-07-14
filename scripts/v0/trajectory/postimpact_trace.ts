/**
 * Leaf full-engine replay evidence for post-impact studies.
 *
 * This module intentionally depends on neither detector helpers nor captured
 * study fixtures.  A post-impact assay receives the engine state surface it
 * needs explicitly, so its identity guard cannot accidentally inherit a
 * compiler, optimizer, panel, or benchmark dependency.
 */
import { createHash } from "node:crypto";

export const POSTIMPACT_ENGINE_TRACE_SEMANTICS = "full_non_scarf_engine_state_v1" as const;

/**
 * A full-engine prefix fingerprint. `null` is an explicit fail-closed result:
 * the requested engine state surface was unavailable or unsupported.
 */
export type PostimpactEngineTraceFingerprint = {
  fingerprint: string | null;
  frameCount: number;
  unavailableAtFrame: number | null;
  semantics: typeof POSTIMPACT_ENGINE_TRACE_SEMANTICS;
};

/** The minimum engine surface required for full-state post-impact evidence. */
export type PostimpactTraceEngine = {
  getStateMapAtFrame(frame: number): unknown;
  getUpdatesAtFrame(frame: number): unknown;
};

/** A collision update involving one of the caller-owned support line IDs. */
export type PostimpactEngineCollisionWitness = {
  frame: number;
  lineId: number;
  pointIds: string[];
};

/**
 * The detector's public terminal shape is deliberately structural here.  The
 * leaf does not need detector implementation types to make the survival
 * boundary precise.
 */
export type PostimpactTraceTerminus = {
  reason: string;
  frame: number;
};

export type PostimpactTraceSurvival = {
  terminus: PostimpactTraceTerminus;
};

/** Explicit identity for a valid empty prefix, such as the frame-zero guard. */
export function emptyPostimpactEngineStateTraceFingerprint(): PostimpactEngineTraceFingerprint {
  return {
    fingerprint: sha256(""),
    frameCount: 0,
    unavailableAtFrame: null,
    semantics: POSTIMPACT_ENGINE_TRACE_SEMANTICS,
  };
}

/**
 * Fingerprint every non-scarf point/binding state and collision update over an
 * inclusive frame interval at exact Float64-bit precision.  Scarf is excluded
 * because it is a one-way visual follower and cannot influence rider dynamics.
 *
 * An unavailable engine surface, an unreadable frame, or an unsupported state
 * fails closed rather than creating a partial positive identity claim.
 */
export function exactPostimpactEngineStateTraceFingerprint(
  engine: unknown,
  startFrame: number,
  endFrame: number,
): PostimpactEngineTraceFingerprint {
  assertFrame("startFrame", startFrame);
  assertFrame("endFrame", endFrame);
  if (endFrame < startFrame) return emptyPostimpactEngineStateTraceFingerprint();
  if (!isPostimpactTraceEngine(engine)) {
    return unavailableFingerprint(startFrame, 0);
  }

  const tokens: string[] = [];
  for (let frame = startFrame; frame <= endFrame; frame++) {
    try {
      tokens.push(engineFrameToken(engine, frame));
    } catch {
      return unavailableFingerprint(frame, tokens.length);
    }
  }
  return {
    fingerprint: sha256(tokens.join("\n")),
    frameCount: tokens.length,
    unavailableAtFrame: null,
    semantics: POSTIMPACT_ENGINE_TRACE_SEMANTICS,
  };
}

/**
 * Full-engine identity is an all-or-nothing predicate.  A diagnostic record
 * with any unavailable frame must never be treated as an equal prefix.
 */
export function samePostimpactEngineTrace(
  left: PostimpactEngineTraceFingerprint,
  right: PostimpactEngineTraceFingerprint,
): boolean {
  return left.fingerprint !== null && right.fingerprint !== null &&
    left.unavailableAtFrame === null && right.unavailableAtFrame === null &&
    left.semantics === POSTIMPACT_ENGINE_TRACE_SEMANTICS &&
    right.semantics === POSTIMPACT_ENGINE_TRACE_SEMANTICS &&
    left.frameCount === right.frameCount && left.fingerprint === right.fingerprint;
}

/**
 * Read every collision update for caller-owned support lines, including body
 * point identities.  Unlike the fingerprint this telemetry read is intended
 * for observation, so an engine without the required method is a loud error.
 */
export function postimpactEngineCollisionWitnessesForLineIds(
  engine: unknown,
  frame: number,
  lineIds: ReadonlySet<number>,
): PostimpactEngineCollisionWitness[] {
  assertFrame("frame", frame);
  if (!hasUpdateReader(engine)) {
    throw new Error("engine lacks getUpdatesAtFrame required for post-impact collision telemetry");
  }
  const updates = engine.getUpdatesAtFrame(frame);
  if (!Array.isArray(updates)) return [];

  const hits: PostimpactEngineCollisionWitness[] = [];
  for (const update of updates) {
    if (!isCollisionUpdate(update)) continue;
    const lineId = collisionLineId(update);
    if (lineId === null || !lineIds.has(lineId)) continue;
    hits.push({
      frame,
      lineId,
      pointIds: collisionPointIds(update),
    });
  }
  return hits;
}

/**
 * The detector records its terminal frame before declaring failure.  A fatal
 * terminus at the requested final frame therefore does not prove survival
 * through that frame; only a later fatal terminus does.
 */
export function survivesPostimpactThroughFrame(
  observation: PostimpactTraceSurvival,
  requiredEndFrame: number,
): boolean {
  assertFrame("requiredEndFrame", requiredEndFrame);
  const terminus = observation?.terminus;
  if (!terminus || typeof terminus.reason !== "string" || !Number.isSafeInteger(terminus.frame) || terminus.frame < 0) {
    throw new Error("post-impact survival observation must contain a non-negative safe-integer terminal frame and string reason");
  }
  return terminus.frame > requiredEndFrame ||
    (terminus.frame === requiredEndFrame && terminus.reason === "endOfSpec");
}

function unavailableFingerprint(unavailableAtFrame: number, frameCount: number): PostimpactEngineTraceFingerprint {
  return {
    fingerprint: null,
    frameCount,
    unavailableAtFrame,
    semantics: POSTIMPACT_ENGINE_TRACE_SEMANTICS,
  };
}

function isPostimpactTraceEngine(value: unknown): value is PostimpactTraceEngine {
  return typeof (value as { getStateMapAtFrame?: unknown } | null)?.getStateMapAtFrame === "function" &&
    typeof (value as { getUpdatesAtFrame?: unknown } | null)?.getUpdatesAtFrame === "function";
}

function hasUpdateReader(value: unknown): value is Pick<PostimpactTraceEngine, "getUpdatesAtFrame"> {
  return typeof (value as { getUpdatesAtFrame?: unknown } | null)?.getUpdatesAtFrame === "function";
}

function engineFrameToken(engine: PostimpactTraceEngine, frame: number): string {
  const stateMap = engine.getStateMapAtFrame(frame);
  if (!(stateMap instanceof Map)) throw new Error("engine state map is unavailable");

  const entities: string[] = [];
  for (const id of [...stateMap.keys()].filter((key) => !isScarfId(key)).sort(compareEngineId)) {
    const entityToken = stateEntityToken(id, stateMap.get(id));
    entities.push(entityToken);
  }
  const collisions = engineCollisionTokens(engine.getUpdatesAtFrame(frame));
  return [frame, ...entities, ...collisions].join(";");
}

function stateEntityToken(id: unknown, entity: unknown): string {
  const entityRecord = asRecord(entity);
  const state = asRecord(entityRecord?.__state__) ?? entityRecord;
  const position = asRecord(state?.pos) ?? asRecord(entityRecord?.pos);
  const previousPosition = asRecord(state?.prevPos) ?? asRecord(entityRecord?.prevPos);
  const velocity = asRecord(state?.vel) ?? asRecord(entityRecord?.vel);
  const pointState = readPointState(position, previousPosition, velocity);
  if (pointState !== null) {
    return [
      String(id),
      "point",
      float64Bits(pointState.position.x),
      float64Bits(pointState.position.y),
      float64Bits(pointState.previousPosition.x),
      float64Bits(pointState.previousPosition.y),
      float64Bits(pointState.velocity.x),
      float64Bits(pointState.velocity.y),
    ].join("|");
  }

  const framesSinceUnbind = state?.framesSinceUnbind ?? entityRecord?.framesSinceUnbind;
  if (typeof framesSinceUnbind === "number") {
    return [String(id), "binding", float64Bits(framesSinceUnbind)].join("|");
  }
  throw new Error(`unsupported engine state for ${String(id)}`);
}

function engineCollisionTokens(updates: unknown): string[] {
  if (!Array.isArray(updates)) throw new Error("engine updates are unavailable");
  const tokens: string[] = [];
  for (const update of updates) {
    if (!isCollisionUpdate(update)) continue;
    const record = asRecord(update)!;
    const lineId = typeof record.id === "number" ? record.id : "?";
    const updated = Array.isArray(record.updated) ? record.updated : [];
    const pointIds = updated.map((entry) => String(asRecord(entry)?.id ?? "?"));
    tokens.push(["collision", lineId, pointIds.join(",")].join("|"));
  }
  return tokens;
}

function collisionLineId(update: unknown): number | null {
  const id = asRecord(update)?.id;
  return typeof id === "number" ? id : null;
}

function collisionPointIds(update: unknown): string[] {
  const updated = asRecord(update)?.updated;
  return Array.isArray(updated)
    ? updated.flatMap((entry) => {
      const id = asRecord(entry)?.id;
      return typeof id === "string" ? [id] : [];
    })
    : [];
}

function isCollisionUpdate(value: unknown): boolean {
  const record = asRecord(value);
  return record?.type === "CollisionUpdate" ||
    constructorName(record) === "CollisionUpdate";
}

function constructorName(record: Record<string, unknown> | undefined): string | undefined {
  const candidate = record?.constructor;
  return typeof candidate === "function" ? candidate.name : undefined;
}

function readPointState(
  position: Record<string, unknown> | undefined,
  previousPosition: Record<string, unknown> | undefined,
  velocity: Record<string, unknown> | undefined,
): {
  position: { x: number; y: number };
  previousPosition: { x: number; y: number };
  velocity: { x: number; y: number };
} | null {
  if (typeof position?.x !== "number" || typeof position?.y !== "number" ||
    typeof previousPosition?.x !== "number" || typeof previousPosition?.y !== "number" ||
    typeof velocity?.x !== "number" || typeof velocity?.y !== "number") {
    return null;
  }
  return {
    position: { x: position.x, y: position.y },
    previousPosition: { x: previousPosition.x, y: previousPosition.y },
    velocity: { x: velocity.x, y: velocity.y },
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function isScarfId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("SCARF");
}

function compareEngineId(left: unknown, right: unknown): number {
  return String(left).localeCompare(String(right));
}

const FLOAT64_BUFFER = new ArrayBuffer(8);
const FLOAT64_VIEW = new Float64Array(FLOAT64_BUFFER);
const UINT64_VIEW = new BigUint64Array(FLOAT64_BUFFER);

function float64Bits(value: number): string {
  FLOAT64_VIEW[0] = value;
  return UINT64_VIEW[0]!.toString(16).padStart(16, "0");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertFrame(name: string, frame: number): void {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
}
