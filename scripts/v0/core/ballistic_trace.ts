/**
 * Benchmark-only capture boundary for the ballistic predictor.
 *
 * Normal compilation has no sink, so `recordBallisticTraceCandidate` is a
 * single null check. The frozen-corpus collector installs a sink and decides
 * which real predictor invocations to materialize. Expensive truth reads stay
 * lazy and therefore happen only for retained observations.
 */

import { COLLISION_UPDATE_TYPE } from "../../lib/update_types.ts";
import {
  BALLISTIC_POINT_IDS,
  constraintBallisticOrientationFromState,
  constraintBallisticStateFromRider,
} from "./ballistic_micro_sim.ts";
import {
  ballisticArticulationFeatures,
} from "./ballistic_projection.ts";
export const BALLISTIC_TRACE_POINT_IDS = BALLISTIC_POINT_IDS;

export type BallisticTracePointId = typeof BALLISTIC_TRACE_POINT_IDS[number];
export type BallisticTraceKinematicState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};
export type BallisticTraceState = {
  body: BallisticTraceKinematicState;
  points: Record<
    BallisticTracePointId,
    BallisticTraceKinematicState & { prevX: number; prevY: number }
  >;
  riderMounted: boolean | null;
  sledIntact: boolean | null;
};
export type BallisticTraceSample = BallisticTraceState & { frame: number };
export type BallisticTraceTruthSample = {
  frame: number;
  body: BallisticTraceKinematicState;
  sledPoseDeg: number;
  sledPoseRateDegPerFrame: number;
  articulation: NonNullable<
    ReturnType<typeof ballisticArticulationFeatures>
  >;
  riderMounted: boolean;
  sledIntact: boolean;
};
export type BallisticTraceTruth = {
  precontact: BallisticTraceTruthSample;
  contact: BallisticTraceTruthSample;
};
export type BallisticTraceObservation = {
  population: "candidate_pool" | "aim_probe";
  gapIndex: number;
  anchorFrame: number;
  targetFrame: number;
  anchor: BallisticTraceSample;
  collisionWitnesses: {
    frame: number;
    points: BallisticTracePointId[];
  }[];
  truth: BallisticTraceTruth;
};

export type BallisticTraceCandidate = {
  population: BallisticTraceObservation["population"];
  gapIndex: number;
  anchorFrame: number;
  targetFrame: number;
  /**
   * Materializes the exact production anchor and unmetered full-simulation truth.
   * This is benchmark-only and is called solely by an installed collector.
   */
  capture: () => BallisticTraceObservation | null;
};

export type BallisticTraceSink = (candidate: BallisticTraceCandidate) => void;

let sink: BallisticTraceSink | null = null;

export function setBallisticTraceSink(next: BallisticTraceSink | null): void {
  if (sink !== null && next !== null) {
    throw new Error("a ballistic trace sink is already installed");
  }
  sink = next;
}

export function ballisticTraceEnabled(): boolean {
  return sink !== null;
}

export function recordBallisticTraceCandidate(candidate: BallisticTraceCandidate): void {
  sink?.(candidate);
}

/**
 * Whether the collision-free suffix is physically valid through `truthFrame`.
 *
 * A collision on the exact anchor frame is legal: the captured anchor already
 * contains its resolved effect and prediction begins at anchor + 1. A
 * collision on the requested truth frame is not legal, because that truth is
 * no longer the collision-free state the predictor is meant to estimate.
 */
export function ballisticTraceCollisionFreeThrough(
  observation: Pick<
    BallisticTraceObservation,
    "anchorFrame" | "collisionWitnesses"
  >,
  truthFrame: number,
): boolean {
  return observation.collisionWitnesses.every(
    (witness) =>
      witness.frame <= observation.anchorFrame ||
      witness.frame > truthFrame,
  );
}

/**
 * Capture the exact raw state available to a production launch read and the
 * engine truth at the authored next-contact frame. `readRider` is deliberately
 * supplied by the benchmark-enabled call site: its target reads must not charge
 * or perturb the compiler's physics budget.
 */
export function captureBallisticTraceObservation(options: {
  population: BallisticTraceObservation["population"];
  gapIndex: number;
  anchorFrame: number;
  targetFrame: number;
  readRider: (frame: number) => unknown;
  readUpdates: (frame: number) => unknown;
}): BallisticTraceObservation | null {
  if (options.targetFrame <= options.anchorFrame) return null;
  const anchorState = traceStateFromRider(
    options.readRider(options.anchorFrame),
  );
  if (anchorState === null) return null;

  // Read the later frame first so the precontact read is cached afterward.
  const contactState = traceTruthStateFromRider(
    options.readRider(options.targetFrame),
  );
  const precontactFrame = options.targetFrame - 1;
  const precontactState = traceTruthStateFromRider(
    options.readRider(precontactFrame),
  );
  if (contactState === null || precontactState === null) return null;

  const pointIds = new Set<string>(BALLISTIC_TRACE_POINT_IDS);
  const collisionWitnesses: BallisticTraceObservation["collisionWitnesses"] = [];
  for (let frame = options.anchorFrame; frame <= options.targetFrame; frame++) {
    const updates = options.readUpdates(frame);
    if (!Array.isArray(updates)) continue;
    const points = new Set<BallisticTracePointId>();
    for (const update of updates) {
      if (update?.type !== COLLISION_UPDATE_TYPE || !Array.isArray(update.updated)) continue;
      for (const point of update.updated) {
        if (typeof point?.id === "string" && pointIds.has(point.id)) {
          points.add(point.id as BallisticTracePointId);
        }
      }
    }
    if (points.size > 0) {
      collisionWitnesses.push({ frame, points: [...points].sort() });
    }
  }

  return {
    population: options.population,
    gapIndex: options.gapIndex,
    anchorFrame: options.anchorFrame,
    targetFrame: options.targetFrame,
    anchor: { frame: options.anchorFrame, ...anchorState },
    collisionWitnesses,
    truth: {
      precontact: { frame: precontactFrame, ...precontactState },
      contact: { frame: options.targetFrame, ...contactState },
    },
  };
}

function traceKinematicStateFromRider(
  rider: any,
): BallisticTraceKinematicState | null {
  const position = rider?.position;
  const velocity = rider?.velocity;
  if (!finiteVector(position) || !finiteVector(velocity)) return null;
  return {
    x: position.x,
    y: position.y,
    vx: velocity.x,
    vy: velocity.y,
  };
}

function traceStateFromRider(rider: any): BallisticTraceState | null {
  const body = traceKinematicStateFromRider(rider);
  if (body === null) return null;

  const constraintState = constraintBallisticStateFromRider(rider);
  if (constraintState === null) return null;
  const points = {} as BallisticTraceState["points"];
  for (const id of BALLISTIC_TRACE_POINT_IDS) {
    const point = constraintState.points[id];
    points[id] = {
      x: point.x,
      y: point.y,
      prevX: point.prevX,
      prevY: point.prevY,
      vx: point.vx,
      vy: point.vy,
    };
  }

  return {
    body,
    points,
    riderMounted: constraintState.riderMounted,
    sledIntact: constraintState.sledIntact,
  };
}

function traceTruthStateFromRider(
  rider: any,
): Omit<BallisticTraceTruthSample, "frame"> | null {
  const body = traceKinematicStateFromRider(rider);
  if (body === null) return null;
  const constraintState = constraintBallisticStateFromRider(rider);
  if (constraintState === null) return null;
  const speed = Math.hypot(body.vx, body.vy);
  const orientation = constraintBallisticOrientationFromState(
    constraintState,
  );
  const articulation = ballisticArticulationFeatures({
    constraintState,
    comAngleDeg: speed > 0
      ? Math.atan2(body.vy, body.vx) * 180 / Math.PI
      : null,
  });
  if (articulation === null) return null;
  return {
    body,
    sledPoseDeg: orientation.sledPoseDeg,
    sledPoseRateDegPerFrame: orientation.sledPoseRateDegPerFrame,
    articulation,
    riderMounted: constraintState.riderMounted,
    sledIntact: constraintState.sledIntact,
  };
}

function finiteVector(value: any): value is { x: number; y: number } {
  return value !== undefined && value !== null &&
    Number.isFinite(value.x) && Number.isFinite(value.y);
}
