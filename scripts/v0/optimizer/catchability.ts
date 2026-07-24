/**
 * Current empirical catchability model.
 *
 * Catchability has one narrow meaning: the probability that one
 * production-sampled catch passes survival, on-beat landing (±1 frame), and
 * no-off-beat gates from the supplied incoming state. It does not include
 * speed, air, impact, or elevation target fit; those belong to readiness.
 *
 * The table is the current implementation inherited from the 2026-06-10 R0
 * study (2,871 perturbed arrivals × 8 refits over twelve pre-V2 tracks). Its
 * interface is canonical, but its calibration must be revalidated on current
 * representative V2 outcomes before claiming the model itself is current.
 */

import type { IncomingKinematics } from "../core/ballistic_projection.ts";
import type { AxisValues } from "../types.ts";

const ANGLE_KNOTS = [-15, -5, 0, 5, 10, 15, 20, 25, 30, 40] as const;
const SPEED_KNOTS = [6, 7, 8, 9, 10, 11, 12] as const;
const RATE_GRID: readonly (readonly number[])[] = [
  [0.781, 0.744, 0.669, 0.636, 0.695, 0.772, 0.792],
  [0.589, 0.378, 0.394, 0.465, 0.551, 0.659, 0.775],
  [0.544, 0.361, 0.442, 0.538, 0.628, 0.721, 0.798],
  [0.58, 0.426, 0.538, 0.639, 0.719, 0.803, 0.858],
  [0.665, 0.527, 0.642, 0.74, 0.803, 0.87, 0.914],
  [0.743, 0.619, 0.706, 0.808, 0.861, 0.909, 0.942],
  [0.778, 0.676, 0.724, 0.84, 0.894, 0.926, 0.946],
  [0.79, 0.726, 0.733, 0.844, 0.895, 0.916, 0.928],
  [0.793, 0.778, 0.766, 0.831, 0.868, 0.879, 0.879],
  [0.794, 0.794, 0.792, 0.783, 0.777, 0.768, 0.75],
];

let catchabilityObserver: ((value: number) => void) | null = null;

/** Study-only observer; null in production. */
export function setCatchabilityObserver(
  observer: ((value: number) => void) | null,
): void {
  catchabilityObserver = observer;
}

export type CatchabilityState =
  & Pick<IncomingKinematics, "speed" | "comAngleDeg">
  & Partial<IncomingKinematics>;

export type CatchabilityContext = {
  nextGapTargets: AxisValues;
  nextGapFrameCount?: number;
  generatorPolicyId: string;
};

export type CatchabilityEstimate = {
  pViableAttempt: number;
  modelId: string;
};

export type CatchabilityModel = {
  id: string;
  predict(
    incoming: CatchabilityState,
    context: CatchabilityContext,
  ): number;
};

/** The attempt distribution whose outcomes the current table approximates. */
export const PRODUCTION_CATCHABILITY_POLICY_ID =
  "compiler-v0-production-sampler";

const CURRENT_CATCHABILITY_MODEL: CatchabilityModel = {
  id: "speed-angle-table-r0",
  predict: (incoming) =>
    incoming.comAngleDeg === null
      ? 0
      : interpolateCatchability(incoming.speed, incoming.comAngleDeg),
};

export function isValidCatchabilityState(
  speed: number,
  comAngleDeg: number | null,
): boolean {
  return Number.isFinite(speed) && Number.isFinite(comAngleDeg);
}

/** Bilinear interpolation of the current empirical viable-catch rate. */
export function predictCatchability(
  speedPxPerFrame: number,
  comAngleDeg: number,
): number {
  if (!isValidCatchabilityState(speedPxPerFrame, comAngleDeg)) {
    catchabilityObserver?.(0);
    return 0;
  }
  const value = interpolateCatchability(speedPxPerFrame, comAngleDeg);
  catchabilityObserver?.(value);
  return value;
}

export function estimateCatchability(
  incoming: CatchabilityState,
  context: CatchabilityContext,
): CatchabilityEstimate {
  const pViableAttempt = isValidCatchabilityState(
      incoming.speed,
      incoming.comAngleDeg,
    ) &&
      incoming.riderMounted !== false &&
      incoming.sledIntact !== false
    ? CURRENT_CATCHABILITY_MODEL.predict(incoming, context)
    : 0;
  catchabilityObserver?.(pViableAttempt);
  return {
    pViableAttempt,
    modelId: CURRENT_CATCHABILITY_MODEL.id,
  };
}

function interpolateCatchability(
  speedPxPerFrame: number,
  comAngleDeg: number,
): number {
  const [angleIndex, angleT] = locate(ANGLE_KNOTS, comAngleDeg);
  const [speedIndex, speedT] = locate(SPEED_KNOTS, speedPxPerFrame);
  const top = RATE_GRID[angleIndex][speedIndex] * (1 - speedT) +
    RATE_GRID[angleIndex][speedIndex + 1] * speedT;
  const bottom = RATE_GRID[angleIndex + 1][speedIndex] * (1 - speedT) +
    RATE_GRID[angleIndex + 1][speedIndex + 1] * speedT;
  const value = Math.min(
    1,
    Math.max(0, top * (1 - angleT) + bottom * angleT),
  );
  return value;
}

export function predictCatchabilityForState(
  state: CatchabilityState,
): number {
  return state.comAngleDeg === null
    ? 0
    : predictCatchability(state.speed, state.comAngleDeg);
}

function locate(
  knots: readonly number[],
  value: number,
): [index: number, fraction: number] {
  if (value <= knots[0]) return [0, 0];
  const last = knots.length - 1;
  if (value >= knots[last]) return [last - 1, 1];
  let index = 0;
  while (value > knots[index + 1]) index++;
  return [
    index,
    (value - knots[index]) / (knots[index + 1] - knots[index]),
  ];
}
