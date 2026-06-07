/**
 * pop_train — AMPLITUDE pulses big↔small on a triangle wave over ~1.1s gaps,
 * a rhythmic series of taller and shorter pops. High air, steady speed, no
 * grain. Tests amplitude tracking of a continuous (raw-lambda) curve.
 *
 *   amplitude  0.3 ▲▼ 0.8  (triangle, 8s period)
 *   air        0.65 (high)
 *   speed      0.55 (flat)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

/** Triangle wave: `lo` at phase 0/1, `hi` at phase 0.5, period `P` seconds. */
const triangle = (lo: number, hi: number, P: number) => (t: number) => {
  const phase = (t % P) / P;
  return lo + (hi - lo) * (1 - Math.abs(2 * phase - 1));
};

const spec: Spec = {
  duration: 16,
  contacts: beats(1.1, 1.1, 14), // ~1.1s gaps (44f)
  axes: {
    air: constant(0.65),
    speed: constant(0.55),
    amplitude: triangle(0.3, 0.8, 8),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
