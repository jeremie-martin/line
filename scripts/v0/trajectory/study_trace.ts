/**
 * Exact replay evidence for trajectory studies.
 *
 * There are intentionally two contracts here:
 * - full-engine prefix identity is a fail-closed safety invariant;
 * - cross-arm kinematic comparison quantifies floating-point drift without
 *   mistaking a checksum mismatch for a physical-effect verdict.
 */
import type { detectWindow } from "../core/candidate.ts";
import {
  airborneAt,
  contactLineIdsAt,
  positionAt,
  speedAt,
  velocityAt,
} from "../core/substrate.ts";
import { sha256 } from "./frozen_fixture.ts";

export type ExactTraceSample = {
  frame: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  speed: number;
  airborne: boolean;
  contactLineIds: readonly number[];
};

export type ExactTraceFingerprint = {
  fingerprint: string | null;
  frameCount: number;
  unavailableAtFrame: number | null;
  semantics: "detector_kinematic_v2" | "full_non_scarf_engine_state_v1";
};

/**
 * This is a numerical diagnostic only. It counts actual adjacent Float64
 * values, not a scale-relative epsilon. A pass is not a physics-equivalence or
 * score-equivalence verdict; a failure is reported with magnitude rather than
 * silently widened after observing a result.
 */
export const KINEMATIC_NUMERICAL_TOLERANCE = {
  maxFloat64UlpsPerScalar: 256,
  semantics: "ordered_float64_ulp_v1" as const,
};

type ComponentRecord = {
  positionX: number;
  positionY: number;
  velocityX: number;
  velocityY: number;
  speed: number;
};

export type KinematicTraceComparison = {
  status: "observed" | "unavailable" | "invalid_numeric";
  framesCompared: number;
  unavailableAtFrame: number | null;
  invalidNumericAt: { frame: number; component: keyof ComponentRecord } | null;
  tolerance: typeof KINEMATIC_NUMERICAL_TOLERANCE;
  firstRawDifferenceFrame: number | null;
  firstToleranceExceedanceFrame: number | null;
  airborneMismatchFrames: number[];
  maxPositionDeltaPx: number;
  maxVelocityDeltaPxPerFrame: number;
  maxSpeedDeltaPxPerFrame: number;
  maxAbsoluteComponentDelta: ComponentRecord;
  maxComponentUlpDistance: Record<keyof ComponentRecord, string>;
  maxComponentUlps: string;
  maxUlpWitness: { frame: number; component: keyof ComponentRecord; left: number; right: number; ulps: string } | null;
  scalarFrameToleranceExceedanceCount: number;
  passesDeclaredNumericalScreen: boolean;
};

export type EngineCollisionHit = {
  frame: number;
  lineId: number;
  pointIds: string[];
};

const FLOAT64_BUFFER = new ArrayBuffer(8);
const FLOAT64_VIEW = new Float64Array(FLOAT64_BUFFER);
const UINT64_VIEW = new BigUint64Array(FLOAT64_BUFFER);
const FLOAT64_SIGN = 0x8000000000000000n;
const FLOAT64_MAGNITUDE = 0x7fffffffffffffffn;

/** Hash exact Float64 bits and discrete detector state without JSON coercion. */
export function fingerprintExactTraceSamples(samples: readonly ExactTraceSample[]): string {
  return sha256(samples.map((sample) => detectorSampleToken(sample, true)).join("\n"));
}

/** Same raw rider state, deliberately excluding collision line IDs. */
export function fingerprintExactKinematicTraceSamples(samples: readonly ExactTraceSample[]): string {
  return sha256(samples.map((sample) => detectorSampleToken(sample, false)).join("\n"));
}

/** Fingerprint a detector interval. This is useful telemetry, not the full prefix guard. */
export function exactTraceFingerprint(
  detection: ReturnType<typeof detectWindow>,
  startFrame: number,
  endFrame: number,
): ExactTraceFingerprint {
  const read = readExactTraceSamples(detection, startFrame, endFrame);
  return fingerprintRead(read, "detector_kinematic_v2", true);
}

/** Same detector interval but without line IDs for cross-arm diagnostics. */
export function exactKinematicTraceFingerprint(
  detection: ReturnType<typeof detectWindow>,
  startFrame: number,
  endFrame: number,
): ExactTraceFingerprint {
  const read = readExactTraceSamples(detection, startFrame, endFrame);
  return fingerprintRead(read, "detector_kinematic_v2", false);
}

/** Explicit identity for a valid empty full-engine prefix, such as frame zero. */
export function emptyEngineStateTraceFingerprint(): ExactTraceFingerprint {
  return {
    fingerprint: sha256(""),
    frameCount: 0,
    unavailableAtFrame: null,
    semantics: "full_non_scarf_engine_state_v1",
  };
}

/**
 * Strong prefix guard: every non-scarf point/binding state and every collision
 * update is encoded at Float64-bit precision. Scarf is intentionally excluded:
 * it is a non-collidable, one-way visual follower and cannot influence rider
 * dynamics. The calibration protocol is WASM, whose engine exposes this state
 * surface; an engine without it fails closed.
 */
export function exactEngineStateTraceFingerprint(
  engine: any,
  startFrame: number,
  endFrame: number,
): ExactTraceFingerprint {
  if (endFrame < startFrame) return emptyEngineStateTraceFingerprint();
  if (typeof engine?.getStateMapAtFrame !== "function" || typeof engine?.getUpdatesAtFrame !== "function") {
    return {
      fingerprint: null,
      frameCount: 0,
      unavailableAtFrame: startFrame,
      semantics: "full_non_scarf_engine_state_v1",
    };
  }
  const tokens: string[] = [];
  for (let frame = startFrame; frame <= endFrame; frame++) {
    try {
      tokens.push(engineFrameToken(engine, frame));
    } catch {
      return {
        fingerprint: null,
        frameCount: tokens.length,
        unavailableAtFrame: frame,
        semantics: "full_non_scarf_engine_state_v1",
      };
    }
  }
  return {
    fingerprint: sha256(tokens.join("\n")),
    frameCount: tokens.length,
    unavailableAtFrame: null,
    semantics: "full_non_scarf_engine_state_v1",
  };
}

/** Read every collision update involving any proposed support line, including body points. */
export function engineCollisionHitsForLineIds(
  engine: any,
  frame: number,
  lineIds: ReadonlySet<number>,
): EngineCollisionHit[] {
  if (typeof engine?.getUpdatesAtFrame !== "function") {
    throw new Error("engine lacks getUpdatesAtFrame required for full collision telemetry");
  }
  const hits: EngineCollisionHit[] = [];
  const updates = engine.getUpdatesAtFrame(frame);
  if (!Array.isArray(updates)) return hits;
  for (const update of updates) {
    if (!isCollisionUpdate(update) || typeof update.id !== "number" || !lineIds.has(update.id)) continue;
    const pointIds = Array.isArray(update.updated)
      ? update.updated.flatMap((entry: any) => typeof entry?.id === "string" ? [entry.id] : [])
      : [];
    hits.push({ frame, lineId: update.id, pointIds });
  }
  return hits;
}

/**
 * The detector records the terminal frame before announcing failure. A
 * non-end-of-spec terminus at the required frame therefore does not establish
 * survival through that frame; it must occur strictly after it.
 */
export function survivesThroughFrame(
  detection: ReturnType<typeof detectWindow>,
  requiredEndFrame: number,
): boolean {
  return detection.terminus.frame > requiredEndFrame ||
    (detection.terminus.frame === requiredEndFrame && detection.terminus.reason === "endOfSpec");
}

/** Compare an inclusive detector interval under the declared Float64 diagnostic. */
export function compareKinematicTraces(
  left: ReturnType<typeof detectWindow>,
  right: ReturnType<typeof detectWindow>,
  startFrame: number,
  endFrame: number,
): KinematicTraceComparison {
  const leftRead = readExactTraceSamples(left, startFrame, endFrame);
  const rightRead = readExactTraceSamples(right, startFrame, endFrame);
  const count = Math.min(leftRead.samples.length, rightRead.samples.length);
  const compared = compareKinematicTraceSamples(leftRead.samples.slice(0, count), rightRead.samples.slice(0, count));
  if (leftRead.unavailableAtFrame !== null || rightRead.unavailableAtFrame !== null) {
    return {
      ...compared,
      status: "unavailable",
      unavailableAtFrame: earliestFrame(leftRead.unavailableAtFrame, rightRead.unavailableAtFrame),
      passesDeclaredNumericalScreen: false,
    };
  }
  return compared;
}

/** Compare already-read samples, which makes numerical edge cases unit-testable. */
export function compareKinematicTraceSamples(
  left: readonly ExactTraceSample[],
  right: readonly ExactTraceSample[],
): KinematicTraceComparison {
  const count = Math.min(left.length, right.length);
  const maxAbsoluteComponentDelta = emptyComponentRecord();
  const maxComponentUlpDistance = emptyBigIntComponentRecord();
  let firstRawDifferenceFrame: number | null = null;
  let firstToleranceExceedanceFrame: number | null = null;
  const airborneMismatchFrames: number[] = [];
  let maxPositionDeltaPx = 0;
  let maxVelocityDeltaPxPerFrame = 0;
  let maxSpeedDeltaPxPerFrame = 0;
  let scalarFrameToleranceExceedanceCount = 0;
  let maxUlpWitness: { frame: number; component: keyof ComponentRecord; left: number; right: number; ulps: bigint } | null = null;

  for (let index = 0; index < count; index++) {
    const a = left[index]!;
    const b = right[index]!;
    if (a.frame !== b.frame) return unavailableComparison(index, a.frame, firstRawDifferenceFrame, firstToleranceExceedanceFrame, airborneMismatchFrames, maxPositionDeltaPx, maxVelocityDeltaPxPerFrame, maxSpeedDeltaPxPerFrame, maxAbsoluteComponentDelta, maxComponentUlpDistance, maxUlpWitness, scalarFrameToleranceExceedanceCount);
    const pairs: Array<[keyof ComponentRecord, number, number]> = [
      ["positionX", a.position.x, b.position.x],
      ["positionY", a.position.y, b.position.y],
      ["velocityX", a.velocity.x, b.velocity.x],
      ["velocityY", a.velocity.y, b.velocity.y],
      ["speed", a.speed, b.speed],
    ];
    for (const [component, av, bv] of pairs) {
      if (!Number.isFinite(av) || !Number.isFinite(bv)) {
        return invalidNumericComparison(index, a.frame, component, firstRawDifferenceFrame, firstToleranceExceedanceFrame, airborneMismatchFrames, maxPositionDeltaPx, maxVelocityDeltaPxPerFrame, maxSpeedDeltaPxPerFrame, maxAbsoluteComponentDelta, maxComponentUlpDistance, maxUlpWitness, scalarFrameToleranceExceedanceCount);
      }
      const delta = Math.abs(av - bv);
      const ulps = float64UlpDistance(av, bv)!;
      maxAbsoluteComponentDelta[component] = Math.max(maxAbsoluteComponentDelta[component], delta);
      maxComponentUlpDistance[component] = maxBigInt(maxComponentUlpDistance[component], ulps);
      if (maxUlpWitness === null || ulps > maxUlpWitness.ulps) {
        maxUlpWitness = { frame: a.frame, component, left: av, right: bv, ulps };
      }
      if (ulps > BigInt(KINEMATIC_NUMERICAL_TOLERANCE.maxFloat64UlpsPerScalar)) {
        scalarFrameToleranceExceedanceCount++;
        if (firstToleranceExceedanceFrame === null) firstToleranceExceedanceFrame = a.frame;
      }
    }
    maxPositionDeltaPx = Math.max(maxPositionDeltaPx, Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y));
    maxVelocityDeltaPxPerFrame = Math.max(maxVelocityDeltaPxPerFrame, Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y));
    maxSpeedDeltaPxPerFrame = Math.max(maxSpeedDeltaPxPerFrame, Math.abs(a.speed - b.speed));
    const rawDifferent = pairs.some(([, av, bv]) => !Object.is(av, bv)) || a.airborne !== b.airborne;
    if (rawDifferent && firstRawDifferenceFrame === null) firstRawDifferenceFrame = a.frame;
    if (a.airborne !== b.airborne) airborneMismatchFrames.push(a.frame);
  }

  if (left.length !== right.length) {
    return unavailableComparison(
      count,
      left[count]?.frame ?? right[count]?.frame ?? null,
      firstRawDifferenceFrame,
      firstToleranceExceedanceFrame,
      airborneMismatchFrames,
      maxPositionDeltaPx,
      maxVelocityDeltaPxPerFrame,
      maxSpeedDeltaPxPerFrame,
      maxAbsoluteComponentDelta,
      maxComponentUlpDistance,
      maxUlpWitness,
      scalarFrameToleranceExceedanceCount,
    );
  }
  return {
    status: "observed",
    framesCompared: count,
    unavailableAtFrame: null,
    invalidNumericAt: null,
    tolerance: KINEMATIC_NUMERICAL_TOLERANCE,
    firstRawDifferenceFrame,
    firstToleranceExceedanceFrame,
    airborneMismatchFrames,
    maxPositionDeltaPx,
    maxVelocityDeltaPxPerFrame,
    maxSpeedDeltaPxPerFrame,
    maxAbsoluteComponentDelta,
    maxComponentUlpDistance: serializeBigIntRecord(maxComponentUlpDistance),
    maxComponentUlps: maxBigInt(...Object.values(maxComponentUlpDistance)).toString(),
    maxUlpWitness: maxUlpWitness === null ? null : { ...maxUlpWitness, ulps: maxUlpWitness.ulps.toString() },
    scalarFrameToleranceExceedanceCount,
    passesDeclaredNumericalScreen: firstToleranceExceedanceFrame === null && airborneMismatchFrames.length === 0,
  };
}

/** True Float64 representable-step distance, with +0 and -0 treated as equal. */
export function float64UlpDistance(left: number, right: number): bigint | null {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  if (Object.is(left, right) || left === right) return 0n;
  const a = orderedFloat64Bits(left);
  const b = orderedFloat64Bits(right);
  const distance = a >= b ? a - b : b - a;
  return distance;
}

function fingerprintRead(
  read: { samples: ExactTraceSample[]; unavailableAtFrame: number | null },
  semantics: ExactTraceFingerprint["semantics"],
  includeLineIds: boolean,
): ExactTraceFingerprint {
  if (read.unavailableAtFrame !== null) {
    return {
      fingerprint: null,
      frameCount: read.samples.length,
      unavailableAtFrame: read.unavailableAtFrame,
      semantics,
    };
  }
  return {
    fingerprint: includeLineIds
      ? fingerprintExactTraceSamples(read.samples)
      : fingerprintExactKinematicTraceSamples(read.samples),
    frameCount: read.samples.length,
    unavailableAtFrame: null,
    semantics,
  };
}

function readExactTraceSamples(
  detection: ReturnType<typeof detectWindow>,
  startFrame: number,
  endFrame: number,
): { samples: ExactTraceSample[]; unavailableAtFrame: number | null } {
  const samples: ExactTraceSample[] = [];
  for (let frame = startFrame; frame <= endFrame; frame++) {
    const position = positionAt(detection, frame);
    const velocity = velocityAt(detection, frame);
    const speed = speedAt(detection, frame);
    const airborne = airborneAt(detection, frame);
    if (position === undefined || velocity === undefined || speed === undefined || airborne === undefined) {
      return { samples, unavailableAtFrame: frame };
    }
    samples.push({
      frame,
      position: { x: position.x, y: position.y },
      velocity: { x: velocity.x, y: velocity.y },
      speed,
      airborne,
      contactLineIds: [...contactLineIdsAt(detection, frame)],
    });
  }
  return { samples, unavailableAtFrame: null };
}

function detectorSampleToken(sample: ExactTraceSample, includeLineIds: boolean): string {
  return [
    sample.frame,
    float64Bits(sample.position.x),
    float64Bits(sample.position.y),
    float64Bits(sample.velocity.x),
    float64Bits(sample.velocity.y),
    float64Bits(sample.speed),
    sample.airborne ? 1 : 0,
    includeLineIds ? sample.contactLineIds.join(",") : "",
  ].join("|");
}

function engineFrameToken(engine: any, frame: number): string {
  const stateMap = engine.getStateMapAtFrame(frame);
  if (!(stateMap instanceof Map)) throw new Error("engine state map is unavailable");
  const entities: string[] = [];
  for (const id of [...stateMap.keys()].filter((key) => !isScarfId(key)).sort(compareId)) {
    const entity = stateMap.get(id);
    const state = entity?.__state__ ?? entity;
    const pos = state?.pos ?? entity?.pos;
    const prevPos = state?.prevPos ?? entity?.prevPos;
    const vel = state?.vel ?? entity?.vel;
    if (isPointState(pos, prevPos, vel)) {
      entities.push([String(id), "point", float64Bits(pos.x), float64Bits(pos.y), float64Bits(prevPos.x), float64Bits(prevPos.y), float64Bits(vel.x), float64Bits(vel.y)].join("|"));
      continue;
    }
    const framesSinceUnbind = state?.framesSinceUnbind ?? entity?.framesSinceUnbind;
    if (typeof framesSinceUnbind === "number") {
      entities.push([String(id), "binding", float64Bits(framesSinceUnbind)].join("|"));
      continue;
    }
    throw new Error(`unsupported engine state for ${String(id)}`);
  }
  const collisions = engineCollisionTokens(engine.getUpdatesAtFrame(frame));
  return [frame, ...entities, ...collisions].join(";");
}

function engineCollisionTokens(updates: unknown): string[] {
  if (!Array.isArray(updates)) throw new Error("engine updates are unavailable");
  const out: string[] = [];
  for (const update of updates) {
    if (!isCollisionUpdate(update)) continue;
    const lineId = typeof update.id === "number" ? update.id : "?";
    const points = Array.isArray(update.updated)
      ? update.updated.map((entry: any) => String(entry?.id ?? "?")).join(",")
      : "";
    out.push(`collision|${lineId}|${points}`);
  }
  return out;
}

function isCollisionUpdate(value: any): boolean {
  return value?.type === "CollisionUpdate" || value?.constructor?.name === "CollisionUpdate";
}

function isPointState(pos: any, prevPos: any, vel: any): boolean {
  return typeof pos?.x === "number" && typeof pos?.y === "number" &&
    typeof prevPos?.x === "number" && typeof prevPos?.y === "number" &&
    typeof vel?.x === "number" && typeof vel?.y === "number";
}

function isScarfId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("SCARF");
}

function compareId(left: unknown, right: unknown): number {
  return String(left).localeCompare(String(right));
}

function float64Bits(value: number): string {
  FLOAT64_VIEW[0] = value;
  return UINT64_VIEW[0]!.toString(16).padStart(16, "0");
}

function orderedFloat64Bits(value: number): bigint {
  FLOAT64_VIEW[0] = value;
  const bits = UINT64_VIEW[0]!;
  return (bits & FLOAT64_SIGN) === 0n
    ? FLOAT64_SIGN + bits
    : FLOAT64_SIGN - (bits & FLOAT64_MAGNITUDE);
}

function emptyComponentRecord(): ComponentRecord {
  return { positionX: 0, positionY: 0, velocityX: 0, velocityY: 0, speed: 0 };
}

function emptyBigIntComponentRecord(): Record<keyof ComponentRecord, bigint> {
  return { positionX: 0n, positionY: 0n, velocityX: 0n, velocityY: 0n, speed: 0n };
}

function serializeBigIntRecord(record: Record<keyof ComponentRecord, bigint>): Record<keyof ComponentRecord, string> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value.toString()])) as Record<keyof ComponentRecord, string>;
}

function maxBigInt(...values: bigint[]): bigint {
  return values.reduce((max, value) => value > max ? value : max, 0n);
}

function earliestFrame(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

function unavailableComparison(
  framesCompared: number,
  unavailableAtFrame: number | null,
  firstRawDifferenceFrame: number | null,
  firstToleranceExceedanceFrame: number | null,
  airborneMismatchFrames: number[],
  maxPositionDeltaPx: number,
  maxVelocityDeltaPxPerFrame: number,
  maxSpeedDeltaPxPerFrame: number,
  maxAbsoluteComponentDelta: ComponentRecord,
  maxComponentUlpDistance: Record<keyof ComponentRecord, bigint>,
  maxUlpWitness: { frame: number; component: keyof ComponentRecord; left: number; right: number; ulps: bigint } | null,
  scalarFrameToleranceExceedanceCount: number,
): KinematicTraceComparison {
  return comparisonBase("unavailable", framesCompared, unavailableAtFrame, null, firstRawDifferenceFrame, firstToleranceExceedanceFrame, airborneMismatchFrames, maxPositionDeltaPx, maxVelocityDeltaPxPerFrame, maxSpeedDeltaPxPerFrame, maxAbsoluteComponentDelta, maxComponentUlpDistance, maxUlpWitness, scalarFrameToleranceExceedanceCount);
}

function invalidNumericComparison(
  framesCompared: number,
  frame: number,
  component: keyof ComponentRecord,
  firstRawDifferenceFrame: number | null,
  firstToleranceExceedanceFrame: number | null,
  airborneMismatchFrames: number[],
  maxPositionDeltaPx: number,
  maxVelocityDeltaPxPerFrame: number,
  maxSpeedDeltaPxPerFrame: number,
  maxAbsoluteComponentDelta: ComponentRecord,
  maxComponentUlpDistance: Record<keyof ComponentRecord, bigint>,
  maxUlpWitness: { frame: number; component: keyof ComponentRecord; left: number; right: number; ulps: bigint } | null,
  scalarFrameToleranceExceedanceCount: number,
): KinematicTraceComparison {
  return comparisonBase("invalid_numeric", framesCompared, null, { frame, component }, firstRawDifferenceFrame, firstToleranceExceedanceFrame, airborneMismatchFrames, maxPositionDeltaPx, maxVelocityDeltaPxPerFrame, maxSpeedDeltaPxPerFrame, maxAbsoluteComponentDelta, maxComponentUlpDistance, maxUlpWitness, scalarFrameToleranceExceedanceCount);
}

function comparisonBase(
  status: "unavailable" | "invalid_numeric",
  framesCompared: number,
  unavailableAtFrame: number | null,
  invalidNumericAt: { frame: number; component: keyof ComponentRecord } | null,
  firstRawDifferenceFrame: number | null,
  firstToleranceExceedanceFrame: number | null,
  airborneMismatchFrames: number[],
  maxPositionDeltaPx: number,
  maxVelocityDeltaPxPerFrame: number,
  maxSpeedDeltaPxPerFrame: number,
  maxAbsoluteComponentDelta: ComponentRecord,
  maxComponentUlpDistance: Record<keyof ComponentRecord, bigint>,
  maxUlpWitness: { frame: number; component: keyof ComponentRecord; left: number; right: number; ulps: bigint } | null,
  scalarFrameToleranceExceedanceCount: number,
): KinematicTraceComparison {
  return {
    status,
    framesCompared,
    unavailableAtFrame,
    invalidNumericAt,
    tolerance: KINEMATIC_NUMERICAL_TOLERANCE,
    firstRawDifferenceFrame,
    firstToleranceExceedanceFrame,
    airborneMismatchFrames,
    maxPositionDeltaPx,
    maxVelocityDeltaPxPerFrame,
    maxSpeedDeltaPxPerFrame,
    maxAbsoluteComponentDelta,
    maxComponentUlpDistance: serializeBigIntRecord(maxComponentUlpDistance),
    maxComponentUlps: maxBigInt(...Object.values(maxComponentUlpDistance)).toString(),
    maxUlpWitness: maxUlpWitness === null ? null : { ...maxUlpWitness, ulps: maxUlpWitness.ulps.toString() },
    scalarFrameToleranceExceedanceCount,
    passesDeclaredNumericalScreen: false,
  };
}
