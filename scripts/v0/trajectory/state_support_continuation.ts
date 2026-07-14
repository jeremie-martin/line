/**
 * Fixed two-chunk geometry control for the state-support response assay.
 *
 * This is not a rollout controller. It realizes one declared local action
 * followed by one fixed tangent carrier so a study can distinguish support-tip
 * release from a physical line-joint/segmentation effect.
 */
import { PERSISTENCE_FRAMES } from "../../lib/detector.ts";
import type { TrackLine } from "../types.ts";
import { realizeSupportPath, type RealizedSupportPath } from "./envelope/realizer.ts";
import type { ExactResponseBoundary } from "./state_coupled_support.ts";
import {
  planStateSupportResponse,
  type StateSupportResponseAction,
  type StateSupportResponsePlan,
} from "./state_support_response.ts";

export const STATE_SUPPORT_FIRST_CHUNK_FRAMES = 12;
export const STATE_SUPPORT_CARRIER_FRAMES = PERSISTENCE_FRAMES;

/**
 * The continuation control is a 2x2 topology/line-label matrix.  Line ID is
 * part of the engine's collision iteration order, so a merged-vs-split result
 * alone cannot be labelled a segmentation effect.  `A` is the first chunk's
 * final line ID and `B` is the adjacent carrier ID.
 */
export type StateSupportContinuationArm =
  | "firstOnlyA"
  | "mergedA"
  | "mergedB"
  | "splitAB"
  | "splitBA";

export type StateSupportContinuationGeometry = {
  action: StateSupportResponseAction;
  firstPlan: StateSupportResponsePlan;
  firstChunk: RealizedSupportPath;
  virtualTipPoint: { x: number; y: number };
  carrier: TrackLine;
  lineLabels: { A: number; B: number };
  arms: Record<StateSupportContinuationArm, readonly TrackLine[]>;
};

/**
 * Construct the fixed topology/label matrix from exactly the same response
 * state. The carrier is collinear with the final first-chunk segment. The two
 * merged and two split arms use identical coordinates within their topology;
 * only the `A`/`B` labels swap. This exposes engine-order sensitivity instead
 * of silently attributing it to segmentation.
 */
export function realizeStateSupportContinuation(
  response: ExactResponseBoundary,
  action: StateSupportResponseAction,
  lineIdStart: number,
): StateSupportContinuationGeometry {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("continuation lineIdStart must be a safe integer");
  const firstPlan = planStateSupportResponse(response, STATE_SUPPORT_FIRST_CHUNK_FRAMES, action);
  const firstChunk = realizeSupportPath(
    { point: firstPlan.anchor.reference, entryAngleDeg: firstPlan.anchor.headingDeg },
    firstPlan,
    lineIdStart,
    { preserveEntryTangent: true },
  );
  const last = firstChunk.lines.at(-1);
  if (last === undefined) throw new Error("continuation requires a non-empty first chunk");
  const carrierLengthPx = positive("continuation carrier length", response.anchor.speedPxPerFrame * STATE_SUPPORT_CARRIER_FRAMES);
  const tangent = unitTangent(last);
  const carrier: TrackLine = {
    id: lineIdStart + firstChunk.lines.length,
    type: last.type,
    x1: last.x2,
    y1: last.y2,
    x2: last.x2 + tangent.x * carrierLengthPx,
    y2: last.y2 + tangent.y * carrierLengthPx,
    flipped: last.flipped,
    leftExtended: last.leftExtended,
    rightExtended: last.rightExtended,
  };
  const mergedLastA: TrackLine = { ...last, x2: carrier.x2, y2: carrier.y2 };
  const mergedLastB: TrackLine = { ...mergedLastA, id: carrier.id };
  const splitFinalB: TrackLine = { ...last, id: carrier.id };
  const splitCarrierA: TrackLine = { ...carrier, id: last.id };
  const firstOnlyA = firstChunk.lines;
  const mergedA = [...firstChunk.lines.slice(0, -1), mergedLastA];
  const mergedB = [...firstChunk.lines.slice(0, -1), mergedLastB];
  const splitAB = [...firstChunk.lines, carrier];
  const splitBA = [...firstChunk.lines.slice(0, -1), splitFinalB, splitCarrierA];
  assertGeometry(firstChunk.lines, carrier, { firstOnlyA, mergedA, mergedB, splitAB, splitBA });
  return {
    action: { ...action },
    firstPlan,
    firstChunk,
    virtualTipPoint: { x: last.x2, y: last.y2 },
    carrier,
    lineLabels: { A: last.id, B: carrier.id },
    arms: {
      firstOnlyA,
      mergedA,
      mergedB,
      splitAB,
      splitBA,
    },
  };
}

function assertGeometry(
  firstChunk: readonly TrackLine[],
  carrier: TrackLine,
  arms: Record<StateSupportContinuationArm, readonly TrackLine[]>,
): void {
  const last = firstChunk.at(-1);
  const mergedALast = arms.mergedA.at(-1);
  const mergedBLast = arms.mergedB.at(-1);
  const splitABLast = arms.splitAB.at(-1);
  const splitBALast = arms.splitBA.at(-1);
  if (last === undefined || mergedALast === undefined || mergedBLast === undefined || splitABLast === undefined || splitBALast === undefined) {
    throw new Error("continuation geometry unexpectedly empty");
  }
  if (!samePoint({ x: last.x2, y: last.y2 }, { x: carrier.x1, y: carrier.y1 })) {
    throw new Error("continuation carrier must begin at the first chunk exit");
  }
  const lastDx = last.x2 - last.x1;
  const lastDy = last.y2 - last.y1;
  const carrierDx = carrier.x2 - carrier.x1;
  const carrierDy = carrier.y2 - carrier.y1;
  const cross = lastDx * carrierDy - lastDy * carrierDx;
  const scale = Math.hypot(lastDx, lastDy) * Math.hypot(carrierDx, carrierDy);
  if (lastDx * carrierDx + lastDy * carrierDy <= 0 || Math.abs(cross) > 64 * Number.EPSILON * scale) {
    throw new Error("continuation carrier must share the first chunk exit tangent");
  }
  if (last.flipped !== carrier.flipped || last.type !== carrier.type) {
    throw new Error("continuation carrier must preserve final-segment collision semantics");
  }
  if (arms.firstOnlyA.length !== firstChunk.length || arms.mergedA.length !== firstChunk.length ||
      arms.mergedB.length !== firstChunk.length || arms.splitAB.length !== firstChunk.length + 1 ||
      arms.splitBA.length !== firstChunk.length + 1) {
    throw new Error("continuation arm segmentation invariant failed");
  }
  const endpoint = { x: mergedALast.x2, y: mergedALast.y2 };
  for (const arm of [mergedBLast, splitABLast, splitBALast]) {
    if (!samePoint(endpoint, { x: arm.x2, y: arm.y2 })) {
      throw new Error("continuation matrix arms must have the same endpoint");
    }
  }
  assertEqualGeometry(arms.mergedA.at(-1)!, arms.mergedB.at(-1)!, "merged label control");
  assertEqualGeometry(arms.splitAB.at(-2)!, arms.splitBA.at(-2)!, "split final-segment label control");
  assertEqualGeometry(arms.splitAB.at(-1)!, arms.splitBA.at(-1)!, "split carrier label control");
  for (const [name, lines] of Object.entries(arms)) {
    const ids = lines.map((line) => line.id);
    if (new Set(ids).size !== ids.length) throw new Error(`${name} must have unique line IDs`);
  }
}

function assertEqualGeometry(left: TrackLine, right: TrackLine, name: string): void {
  const same = left.type === right.type && left.x1 === right.x1 && left.y1 === right.y1 &&
    left.x2 === right.x2 && left.y2 === right.y2 && left.flipped === right.flipped &&
    left.leftExtended === right.leftExtended && left.rightExtended === right.rightExtended;
  if (!same) throw new Error(`${name} must preserve coordinates and collision flags`);
}

function unitTangent(line: TrackLine): { x: number; y: number } {
  const x = line.x2 - line.x1;
  const y = line.y2 - line.y1;
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 0) throw new Error("continuation final segment has invalid tangent");
  return { x: x / length, y: y / length };
}

function samePoint(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return left.x === right.x && left.y === right.y;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive and finite`);
  return value;
}
