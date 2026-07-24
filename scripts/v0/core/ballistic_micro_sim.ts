/**
 * Cheap collision-free rider propagation for the ballistic predictor.
 *
 * This is the airborne part of the engine kernel: Verlet point integration,
 * six passes over the 22 rider constraints, then the three binding joints.
 * There is deliberately no line grid, collision history, event tracking, or
 * engine allocation. Given an exact point/previous-point launch state, it
 * reproduces the rider's free-flight state at a tiny fraction of a full fork.
 */

import { registerCompileReset } from "./compile_lifecycle.ts";

export const BALLISTIC_POINT_IDS = [
  "PEG",
  "TAIL",
  "NOSE",
  "STRING",
  "BUTT",
  "SHOULDER",
  "RHAND",
  "LHAND",
  "LFOOT",
  "RFOOT",
] as const;
export type BallisticPointId = typeof BALLISTIC_POINT_IDS[number];

export type BallisticPointState = {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
};

export type ConstraintBallisticState = {
  /** Anchor frame relative to the public launch/suffix frame. */
  frameOffset: number;
  points: Record<BallisticPointId, BallisticPointState>;
  riderMounted: boolean;
  sledIntact: boolean;
};

export type ConstraintBallisticSample = {
  frame: number;
  points: Record<
    BallisticPointId,
    {
      x: number;
      y: number;
      prevX?: number;
      prevY?: number;
      vx: number;
      vy: number;
    }
  >;
  riderMounted: boolean | null;
  sledIntact: boolean | null;
};

export type ConstraintBallisticOrientation = {
  /** Exact TAIL->NOSE pose after this micro-simulation step. */
  sledPoseDeg: number;
  /** Wrapped frame-to-frame pose delta in degrees/frame. */
  sledPoseRateDegPerFrame: number;
};

/** Derive the exact current/previous sled orientation already present in one
 * constraint packet. No second engine-frame read is required. */
export function constraintBallisticOrientationFromState(
  state: ConstraintBallisticState,
): ConstraintBallisticOrientation {
  const tail = state.points.TAIL;
  const nose = state.points.NOSE;
  const sledPoseDeg = Math.atan2(
    nose.y - tail.y,
    nose.x - tail.x,
  ) * 180 / Math.PI;
  const previousSledPoseDeg = Math.atan2(
    nose.prevY - tail.prevY,
    nose.prevX - tail.prevX,
  ) * 180 / Math.PI;
  return {
    sledPoseDeg,
    sledPoseRateDegPerFrame: wrappedDegrees(
      sledPoseDeg - previousSledPoseDeg,
    ),
  };
}

type MutableState = {
  px: number[];
  py: number[];
  prevx: number[];
  prevy: number[];
  vx: number[];
  vy: number[];
  riderMounted: boolean;
  sledIntact: boolean;
};

type Constraint = {
  kind: "stick" | "bind" | "repel";
  p1: number;
  p2: number;
  rest: number;
  endurance: number;
};

const BODY_INDICES = [4, 5, 6, 7, 8, 9] as const;
const BASE = [
  [0, 0],
  [0, 5],
  [15, 5],
  [17.5, 0],
  [5, 0],
  [5, -5.5],
  [11.5, -5],
  [11.5, -5],
  [10, 5],
  [10, 5],
] as const;
const CONSTRAINT_SPECS = [
  ["stick", 0, 1, 1],
  ["stick", 1, 2, 1],
  ["stick", 2, 3, 1],
  ["stick", 3, 0, 1],
  ["stick", 0, 2, 1],
  ["stick", 3, 1, 1],
  ["bind", 0, 4, 1],
  ["bind", 1, 4, 1],
  ["bind", 2, 4, 1],
  ["stick", 5, 4, 1],
  ["stick", 5, 7, 1],
  ["stick", 5, 6, 1],
  ["stick", 4, 8, 1],
  ["stick", 4, 9, 1],
  ["stick", 5, 6, 1],
  ["bind", 5, 0, 1],
  ["bind", 3, 7, 1],
  ["bind", 3, 6, 1],
  ["bind", 8, 2, 1],
  ["bind", 9, 2, 1],
  ["repel", 5, 8, 0.5],
  ["repel", 5, 9, 0.5],
] as const;
const CONSTRAINTS: readonly Constraint[] = CONSTRAINT_SPECS.map(
  ([kind, p1, p2, lengthFactor]) => {
    const dx = BASE[p2][0] - BASE[p1][0];
    const dy = BASE[p2][1] - BASE[p1][1];
    const rest = Math.sqrt(dx * dx + dy * dy) * lengthFactor;
    return {
      kind,
      p1,
      p2,
      rest,
      endurance: kind === "bind" ? 0.057 * rest * 0.5 : 0,
    };
  },
);

/**
 * Read an exact launch state. The WASM rider exposes `ballisticState()` without
 * rebuilding the full state map; the lr-core fallback reads the same fields
 * from its ordinary point objects.
 */
// deno-lint-ignore no-explicit-any
export function constraintBallisticStateFromRider(
  rider: any,
  frameOffset = 0,
): ConstraintBallisticState | null {
  const supplied = typeof rider?.ballisticState === "function"
    ? rider.ballisticState()
    : null;
  const points = {} as Record<BallisticPointId, BallisticPointState>;
  for (const id of BALLISTIC_POINT_IDS) {
    const point = supplied?.points?.[id] ?? rider?.get?.(id);
    const pos = point?.pos ?? point;
    const prevPos = point?.prevPos ?? (
      Number.isFinite(point?.prevX) && Number.isFinite(point?.prevY)
        ? { x: point.prevX, y: point.prevY }
        : null
    );
    const vel = point?.vel ?? (
      Number.isFinite(point?.vx) && Number.isFinite(point?.vy)
        ? { x: point.vx, y: point.vy }
        : point
    );
    if (!finiteVector(pos) || !finiteVector(prevPos) || !finiteVector(vel)) return null;
    points[id] = {
      x: pos.x,
      y: pos.y,
      prevX: prevPos.x,
      prevY: prevPos.y,
      vx: vel.x,
      vy: vel.y,
    };
  }
  const riderMounted = supplied?.riderMounted ?? bindingState(rider?.get?.("RIDER_MOUNTED"));
  const sledIntact = supplied?.sledIntact ?? bindingState(rider?.get?.("SLED_INTACT"));
  if (
    typeof riderMounted !== "boolean" ||
    typeof sledIntact !== "boolean" ||
    !Number.isFinite(frameOffset)
  ) return null;
  return { frameOffset, points, riderMounted, sledIntact };
}

/**
 * Build the same state from frozen trace samples. V6 corpora carry exact
 * previous positions. Older experimental rows can still be diagnosed by using
 * the preceding consecutive sample, or pos-vel as a one-sample approximation.
 */
export function constraintBallisticStateFromSamples(
  samples: readonly ConstraintBallisticSample[],
): ConstraintBallisticState | null {
  if (samples.length === 0) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const previous = samples.length >= 2 &&
      samples[samples.length - 2].frame === last.frame - 1
    ? samples[samples.length - 2]
    : null;
  const points = {} as Record<BallisticPointId, BallisticPointState>;
  for (const id of BALLISTIC_POINT_IDS) {
    const point = last.points[id];
    if (
      point === undefined ||
      !finiteNumbers(point.x, point.y, point.vx, point.vy)
    ) return null;
    const prevX = Number.isFinite(point.prevX)
      ? point.prevX!
      : previous?.points[id].x ?? point.x - point.vx;
    const prevY = Number.isFinite(point.prevY)
      ? point.prevY!
      : previous?.points[id].y ?? point.y - point.vy;
    if (!finiteNumbers(prevX, prevY)) return null;
    points[id] = {
      x: point.x,
      y: point.y,
      prevX,
      prevY,
      vx: point.vx,
      vy: point.vy,
    };
  }
  if (
    typeof last.riderMounted !== "boolean" ||
    typeof last.sledIntact !== "boolean"
  ) return null;
  return {
    frameOffset: last.frame - first.frame,
    points,
    riderMounted: last.riderMounted,
    sledIntact: last.sledIntact,
  };
}

export function predictConstraintBallisticArrival(
  state: ConstraintBallisticState,
  dtFramesFromFirstSample: number,
  gravity: number,
): { x: number; y: number; vx: number; vy: number } | null {
  return advanceConstraintBallisticState(state, dtFramesFromFirstSample, gravity)
    ?.arrival ?? null;
}

export function cloneConstraintBallisticState(
  state: ConstraintBallisticState,
): ConstraintBallisticState {
  const points = {} as Record<BallisticPointId, BallisticPointState>;
  for (const id of BALLISTIC_POINT_IDS) points[id] = { ...state.points[id] };
  return {
    frameOffset: state.frameOffset,
    points,
    riderMounted: state.riderMounted,
    sledIntact: state.sledIntact,
  };
}

/** Advance and re-anchor so chained propagation equals one combined advance. */
export function advanceConstraintBallisticState(
  state: ConstraintBallisticState,
  dtFramesFromFirstSample: number,
  gravity: number,
): {
  arrival: { x: number; y: number; vx: number; vy: number };
  orientation: ConstraintBallisticOrientation;
  constraintState: ConstraintBallisticState;
} | null {
  return advanceConstraintBallisticTrajectory(
    state,
    dtFramesFromFirstSample,
    gravity,
  );
}

/**
 * Advance the exact collision-free constraint state once while exposing every
 * post-anchor body state to `visit`. Relative frames use the same origin as
 * `ConstraintBallisticState.frameOffset`: a normalized launch has offset 0,
 * and its first visited state is relative frame 1.
 *
 * This is the canonical hot path for suffix aggregates. It avoids repeatedly
 * re-running the micro-simulation from the launch for every requested frame.
 */
export function advanceConstraintBallisticTrajectory(
  state: ConstraintBallisticState,
  dtFramesFromFirstSample: number,
  gravity: number,
  visit?: (
    relativeFrame: number,
    arrival: Readonly<{ x: number; y: number; vx: number; vy: number }>,
    orientation: Readonly<ConstraintBallisticOrientation>,
  ) => void,
): {
  arrival: { x: number; y: number; vx: number; vy: number };
  orientation: ConstraintBallisticOrientation;
  constraintState: ConstraintBallisticState;
} | null {
  const dt = Math.max(0, Math.round(dtFramesFromFirstSample));
  const frameOffset = Math.max(0, Math.round(state.frameOffset));
  if (dt < frameOffset || !Number.isFinite(gravity)) return null;
  const mutable = mutableState(state);
  let arrival = bodyState(mutable);
  let previousSledPoseDeg = sledPoseDeg(mutable);
  let orientation: ConstraintBallisticOrientation = {
    sledPoseDeg: previousSledPoseDeg,
    sledPoseRateDegPerFrame: wrappedDegrees(
      previousSledPoseDeg - previousSledPoseDegFromPoints(mutable),
    ),
  };
  for (let frame = frameOffset; frame < dt; frame++) {
    step(mutable, gravity);
    arrival = bodyState(mutable);
    const currentSledPoseDeg = sledPoseDeg(mutable);
    orientation = {
      sledPoseDeg: currentSledPoseDeg,
      sledPoseRateDegPerFrame: wrappedDegrees(
        currentSledPoseDeg - previousSledPoseDeg,
      ),
    };
    visit?.(frame + 1, arrival, orientation);
    previousSledPoseDeg = currentSledPoseDeg;
  }
  const constraintState = frozenState(mutable);
  return [...Object.values(arrival), constraintState.frameOffset].every(Number.isFinite)
    ? { arrival, orientation, constraintState }
    : null;
}

function mutableState(state: ConstraintBallisticState): MutableState {
  const px: number[] = [];
  const py: number[] = [];
  const prevx: number[] = [];
  const prevy: number[] = [];
  const vx: number[] = [];
  const vy: number[] = [];
  for (const id of BALLISTIC_POINT_IDS) {
    const point = state.points[id];
    px.push(point.x);
    py.push(point.y);
    prevx.push(point.prevX);
    prevy.push(point.prevY);
    vx.push(point.vx);
    vy.push(point.vy);
  }
  return {
    px,
    py,
    prevx,
    prevy,
    vx,
    vy,
    riderMounted: state.riderMounted,
    sledIntact: state.sledIntact,
  };
}

function frozenState(state: MutableState): ConstraintBallisticState {
  const points = {} as Record<BallisticPointId, BallisticPointState>;
  for (let index = 0; index < BALLISTIC_POINT_IDS.length; index++) {
    points[BALLISTIC_POINT_IDS[index]] = {
      x: state.px[index],
      y: state.py[index],
      prevX: state.prevx[index],
      prevY: state.prevy[index],
      vx: state.vx[index],
      vy: state.vy[index],
    };
  }
  return {
    frameOffset: 0,
    points,
    riderMounted: state.riderMounted,
    sledIntact: state.sledIntact,
  };
}

/**
 * Collision-free frames advanced since the last reset. The compiler's budget is
 * denominated in ENGINE frames, which this kernel never charges — so without a
 * counter the volume of ballistic work a compile performs is invisible.
 */
let microSimFrames = 0;

export function getMicroSimFrames(): number {
  return microSimFrames;
}

export function resetMicroSimFrames(): void {
  microSimFrames = 0;
}
registerCompileReset(resetMicroSimFrames);

function step(state: MutableState, gravity: number): void {
  microSimFrames++;
  for (let index = 0; index < BALLISTIC_POINT_IDS.length; index++) {
    const nvx = state.px[index] - state.prevx[index];
    const nvy = state.py[index] - state.prevy[index] + gravity;
    state.prevx[index] = state.px[index];
    state.prevy[index] = state.py[index];
    state.px[index] += nvx;
    state.py[index] += nvy;
    state.vx[index] = nvx;
    state.vy[index] = nvy;
  }
  for (let iteration = 0; iteration < 6; iteration++) {
    for (const constraint of CONSTRAINTS) resolveConstraint(state, constraint);
  }
  resolveJoint(state, 5, 4, 3, 0, "rider");
  resolveJoint(state, 0, 1, 3, 0, "sled");
  resolveJoint(state, 0, 1, 3, 0, "rider");
}

function resolveConstraint(state: MutableState, constraint: Constraint): void {
  if (constraint.kind === "bind" && !state.riderMounted) return;
  const { p1, p2 } = constraint;
  const dxLength = state.px[p2] - state.px[p1];
  const dyLength = state.py[p2] - state.py[p1];
  const length = Math.sqrt(dxLength * dxLength + dyLength * dyLength);
  if (constraint.kind === "repel" && length >= constraint.rest) return;
  const gd = length === 0 ? 0 : (length - constraint.rest) / length;
  const diff = gd * 0.5;
  if (constraint.kind === "bind" && diff > constraint.endurance) {
    state.riderMounted = false;
    return;
  }
  const dx = (state.px[p1] - state.px[p2]) * diff;
  const dy = (state.py[p1] - state.py[p2]) * diff;
  state.px[p1] -= dx;
  state.py[p1] -= dy;
  state.px[p2] += dx;
  state.py[p2] += dy;
}

function resolveJoint(
  state: MutableState,
  p1: number,
  p2: number,
  q1: number,
  q2: number,
  binding: "rider" | "sled",
): void {
  const bound = binding === "rider" ? state.riderMounted : state.sledIntact;
  if (!bound) return;
  const cross = (state.px[p2] - state.px[p1]) *
      (state.py[q2] - state.py[q1]) -
    (state.py[p2] - state.py[p1]) * (state.px[q2] - state.px[q1]);
  if (cross < 0) {
    if (binding === "rider") state.riderMounted = false;
    else state.sledIntact = false;
  }
}

function bodyState(state: MutableState): {
  x: number;
  y: number;
  vx: number;
  vy: number;
} {
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  for (const index of BODY_INDICES) {
    x += state.px[index];
    y += state.py[index];
    vx += state.vx[index];
    vy += state.vy[index];
  }
  return { x: x / 6, y: y / 6, vx: vx / 6, vy: vy / 6 };
}

function sledPoseDeg(state: MutableState): number {
  const tail = 1;
  const nose = 2;
  return Math.atan2(
    state.py[nose] - state.py[tail],
    state.px[nose] - state.px[tail],
  ) * 180 / Math.PI;
}

function previousSledPoseDegFromPoints(state: MutableState): number {
  const tail = 1;
  const nose = 2;
  return Math.atan2(
    state.prevy[nose] - state.prevy[tail],
    state.prevx[nose] - state.prevx[tail],
  ) * 180 / Math.PI;
}

function wrappedDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function bindingState(value: unknown): boolean | null {
  const binding = value as { isBinded?: () => boolean } | null | undefined;
  return typeof binding?.isBinded === "function" ? binding.isBinded() : null;
}

function finiteVector(value: unknown): value is { x: number; y: number } {
  const vector = value as { x?: unknown; y?: unknown } | null | undefined;
  return typeof vector?.x === "number" && typeof vector.y === "number" &&
    Number.isFinite(vector.x) && Number.isFinite(vector.y);
}

function finiteNumbers(...values: number[]): boolean {
  return values.every(Number.isFinite);
}
