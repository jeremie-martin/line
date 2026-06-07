/**
 * float_bounds — AMPLITUDE oscillating between medium and big bounds on a steady
 * high air and steady speed, over ~1.0s gaps. A repeating tall/short pop wave
 * that keeps the rider floating. No grain. Complements pop_train (triangle)
 * with a smooth (eased) amplitude wave.
 *
 *   amplitude  0.5 ↕ 0.85  (smooth wave, ~8s period)
 *   air        0.7 (high)
 *   speed      0.6 (flat)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 17,
  contacts: beats(1.0, 1.0, 16), // ~1.0s gaps (40f)
  axes: {
    air: constant(0.7),
    speed: constant(0.6),
    amplitude: keyframes(
      [{ t: 0, v: 0.5 }, { t: 4, v: 0.85 }, { t: 8, v: 0.5 }, { t: 12, v: 0.85 }, { t: 16, v: 0.5 }],
      "smooth",
    ),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
