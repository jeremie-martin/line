/**
 * leap_cadence — AMPLITUDE stepped in three blocks (modest → bigger → biggest
 * leaps) against a building speed, over sparse ~1.2s gaps. High air. The step
 * blocks make each amplitude tier legible on-screen. No grain.
 *
 *   amplitude  0.4 / 0.65 / 0.9  (5s hold blocks)
 *   speed      0.55 → 0.75 (build)
 *   air        0.7 (high)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 15,
  contacts: beats(1.2, 1.2, 12), // ~1.2s gaps (48f)
  axes: {
    air: constant(0.7),
    speed: keyframes([{ t: 0, v: 0.55 }, { t: 14, v: 0.75 }], "smooth"),
    amplitude: keyframes(
      [{ t: 0, v: 0.4 }, { t: 5, v: 0.65 }, { t: 10, v: 0.9 }],
      "hold",
    ),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
