/**
 * pop_train — AMPLITUDE pulses big↔small on a triangle wave over ~1.1s gaps, a
 * rhythmic series of taller and shorter pops. Air pulses in phase (pop height is
 * set by airborne time for one arc), steady speed, no grain. Tests amplitude
 * tracking of a continuous (raw-lambda) curve.
 *
 *   air        0.6 ▲▼ 0.9  (triangle, 8s period)
 *   amplitude  0.25 ▲▼ 0.57 (= air-supported pop ceiling at 44f gaps)
 *   speed      0.55 (flat)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant } from "../../scripts/v0/core/curves.ts";
import { withImpact } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

/** Triangle wave: `lo` at phase 0/1, `hi` at phase 0.5, period `P` seconds. */
const triangle = (lo: number, hi: number, P: number) => (t: number) => {
  const phase = (t % P) / P;
  return lo + (hi - lo) * (1 - Math.abs(2 * phase - 1));
};

const spec: Spec = {
  duration: 16,
  // impact pulses IN PHASE with the pops: the tall pops land hard, the short
  // ones soft — a rhythmic heavy↔light train.
  contacts: withImpact(beats(1.1, 1.1, 14), triangle(0.2, 0.85, 8)), // ~1.1s gaps (44f)
  axes: {
    air: triangle(0.6, 0.9, 8),
    speed: constant(0.55),
    amplitude: triangle(0.25, 0.57, 8),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
