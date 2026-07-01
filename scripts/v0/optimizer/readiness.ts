/**
 * Readiness v0 — the empirical catchability surface (R1 of
 * docs/READINESS_ROADMAP.md).
 *
 * r(speed, comAngle) ∈ [0,1]: from this arrival state, what fraction of
 * production-sampled catches pass the hard gates (survival, on-beat landing
 * ±1f, no off-beat)? Fitted from R0 ground truth — study_catchability.ts,
 * 2,871 perturbed arrivals × 8 production re-fits @300k across 12 tracks
 * (generated/analysis/catchability_300k.jsonl, 2026-06-10): Gaussian-kernel
 * local means (σ_speed 0.75 px/f, σ_angle 4°) at the grid knots below,
 * shrunk toward the global mean 0.794 with pseudo-weight 8 — low-data
 * regions (steeper than ~35°, slower than ~7 px/f, upward arrivals beyond
 * −13°) read as ~neutral, never confident. Bilinear between knots, clamped
 * at the edges.
 *
 * CURRENT INSTANCE of the readiness concept (one component, two inputs,
 * an empirical table): the R0 verdict PARKED sled pose as an input (catch
 * rate is flat across pose−comAngle misalignment up to 90°; only the >90°
 * regime — 4.2% of arrivals — degrades, and remains majority-catchable).
 * Pose stays a first-class measurable/controllable quantity elsewhere
 * (ProbeOutcome.sledPoseDeg; ~40° of exit-pitch authority) — parked here
 * means "not a catchability signal", not "not interesting": intentional
 * pose/rotation steering (e.g. upside-down at the right beat) is a future
 * aesthetic target, roadmap §R3. Future components (impact-feasibility,
 * speed-compatibility), richer fits, or learned models replace the table
 * behind the same state-shaped function boundary.
 *
 * Production now uses this as a proposer signal. The scalar table still
 * reads only speed and CoM angle; the wrapper below accepts the broader
 * predicted rider-arrival state so pose, angular rate, position, or other
 * components can become readiness inputs without changing call sites.
 */

import type { RiderArrivalState } from "./arc_model.ts";

/** Grid knots. Rows = arrival CoM velocity angle (deg, +down); columns =
 *  arrival speed (px/frame). Values = smoothed tier-B catch rate. */
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

// Study-only observer hook. study_catchability_telemetry.ts subscribes here to
// histogram every readinessCatch() value across a run (LR_CATCHABILITY_TELEMETRY
// study path). Null in production — the optional call below is a no-op and can
// never affect the returned readiness (computed before the observer fires). The
// telemetry state itself lives in the study module, not this core model file.
let catchabilityObserver: ((value: number) => void) | null = null;
export function setCatchabilityObserver(observer: ((value: number) => void) | null): void {
  catchabilityObserver = observer;
}

/** Locate `x` in ascending `knots`: returns [index, t] with t ∈ [0,1] the
 *  fraction toward the next knot; clamps outside the range. */
function locate(knots: readonly number[], x: number): [number, number] {
  if (x <= knots[0]) return [0, 0];
  const last = knots.length - 1;
  if (x >= knots[last]) return [last - 1, 1];
  let i = 0;
  while (x > knots[i + 1]) i++;
  return [i, (x - knots[i]) / (knots[i + 1] - knots[i])];
}

/** Shared usability predicate for a predicted arrival state's scalar fields:
 *  both the arrival speed and CoM velocity angle must be finite numbers (a
 *  null comAngle — an unresolved heading — reads as non-finite via
 *  Number.isFinite). This is the single condition behind the two guards that
 *  test it identically — objective.scoreNextTargetReadiness and readinessCatch
 *  below — each of which keeps its own distinct failure encoding (return null
 *  vs observer(0)+return 0). readinessCatchState's `comAngleDeg === null` guard
 *  is a narrower type-narrowing check and is intentionally left separate. */
export function isValidArrivalState(speed: number, comAngleDeg: number | null): boolean {
  return Number.isFinite(speed) && Number.isFinite(comAngleDeg);
}

/** Catchability readiness of an arrival state: smooth, continuous over the
 *  whole (speed, angle) plane (bilinear inside the knot range, clamped to
 *  the edge values outside). */
export function readinessCatch(speedPxPerFrame: number, comAngleDeg: number): number {
  if (!isValidArrivalState(speedPxPerFrame, comAngleDeg)) {
    catchabilityObserver?.(0);
    return 0;
  }
  const [ai, at] = locate(ANGLE_KNOTS, comAngleDeg);
  const [si, st] = locate(SPEED_KNOTS, speedPxPerFrame);
  const top = RATE_GRID[ai][si] * (1 - st) + RATE_GRID[ai][si + 1] * st;
  const bot = RATE_GRID[ai + 1][si] * (1 - st) + RATE_GRID[ai + 1][si + 1] * st;
  const r = top * (1 - at) + bot * at;
  const clamped = Math.min(1, Math.max(0, r));
  catchabilityObserver?.(clamped);
  return clamped;
}

export type ReadinessArrivalState =
  & Pick<RiderArrivalState, "speed" | "comAngleDeg">
  & Partial<RiderArrivalState>;

/** Catchability readiness from the full predicted rider-arrival state. Current
 *  production consumes speed and CoM velocity angle only; the state-shaped API
 *  is the boundary for richer readiness components. */
export function readinessCatchState(state: ReadinessArrivalState): number {
  return state.comAngleDeg === null ? 0 : readinessCatch(state.speed, state.comAngleDeg);
}
