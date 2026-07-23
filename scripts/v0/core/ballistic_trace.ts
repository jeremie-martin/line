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
  constraintBallisticStateFromRider,
} from "./ballistic_micro_sim.ts";
import {
  LAUNCH_READ_FRAMES,
} from "./launch_read.ts";

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
export type BallisticTraceTruth = {
  precontact: BallisticTraceSample;
  contact: BallisticTraceSample;
};
export type BallisticTraceObservation = {
  population: "candidate_pool" | "aim_probe";
  gapIndex: number;
  launchFrame: number;
  targetFrame: number;
  samples: BallisticTraceSample[];
  collisionWitnesses: {
    frame: number;
    points: BallisticTracePointId[];
  }[];
  truth: BallisticTraceTruth;
};

export type BallisticTraceCandidate = {
  population: BallisticTraceObservation["population"];
  gapIndex: number;
  launchFrame: number;
  targetFrame: number;
  /**
   * Materializes raw launch samples and unmetered full-simulation truth.
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
 * Capture the exact raw state available to a production launch read and the
 * engine truth at the authored next-contact frame. `readRider` is deliberately
 * supplied by the benchmark-enabled call site: its target reads must not charge
 * or perturb the compiler's physics budget.
 */
export function captureBallisticTraceObservation(options: {
  population: BallisticTraceObservation["population"];
  gapIndex: number;
  launchFrame: number;
  targetFrame: number;
  sampleAllowed: (frame: number) => boolean;
  readRider: (frame: number) => unknown;
  readUpdates: (frame: number) => unknown;
}): BallisticTraceObservation | null {
  const samples: BallisticTraceSample[] = [];
  for (let offset = 0; offset < LAUNCH_READ_FRAMES; offset++) {
    const frame = options.launchFrame + offset;
    if (frame >= options.targetFrame || !options.sampleAllowed(frame)) break;
    const state = traceStateFromRider(options.readRider(frame));
    if (state === null) break;
    samples.push({ frame, ...state });
  }
  if (samples.length === 0 || options.targetFrame <= options.launchFrame) return null;

  // Read the later frame first so the precontact read is cached afterward.
  const contactState = traceStateFromRider(options.readRider(options.targetFrame));
  const precontactFrame = options.targetFrame - 1;
  const precontactState = traceStateFromRider(options.readRider(precontactFrame));
  if (contactState === null || precontactState === null) return null;

  const pointIds = new Set<string>(BALLISTIC_TRACE_POINT_IDS);
  const collisionWitnesses: BallisticTraceObservation["collisionWitnesses"] = [];
  for (let frame = options.launchFrame; frame <= options.targetFrame; frame++) {
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
    launchFrame: options.launchFrame,
    targetFrame: options.targetFrame,
    samples,
    collisionWitnesses,
    truth: {
      precontact: { frame: precontactFrame, ...precontactState },
      contact: { frame: options.targetFrame, ...contactState },
    },
  };
}

function traceStateFromRider(rider: any): BallisticTraceState | null {
  const position = rider?.position;
  const velocity = rider?.velocity;
  if (!finiteVector(position) || !finiteVector(velocity)) return null;

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

  const body = { x: position.x, y: position.y, vx: velocity.x, vy: velocity.y };
  return {
    body,
    points,
    riderMounted: constraintState.riderMounted,
    sledIntact: constraintState.sledIntact,
  };
}

function finiteVector(value: any): value is { x: number; y: number } {
  return value !== undefined && value !== null &&
    Number.isFinite(value.x) && Number.isFinite(value.y);
}
