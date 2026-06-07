/**
 * big_air_ramp — AMPLITUDE build over long ~1.3s gaps, where a tall airborne
 * arc (pop ≈ g·N²/8) can actually form. High air keeps the rider aloft; the
 * amplitude ramp grows the height of each pop from a low hop to a big soar.
 * Speed steady; no grain. The headline amplitude-room spec.
 *
 *   amplitude  0.2 → 0.9  (smooth build, small hop → big soar)
 *   air        0.7 (high — long aloft)
 *   speed      0.6 (flat)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 18,
  contacts: beats(1.3, 1.3, 13), // ~1.3s gaps (52f) — room for big pops
  axes: {
    air: constant(0.7),
    speed: constant(0.6),
    amplitude: keyframes([{ t: 0, v: 0.2 }, { t: 17, v: 0.9 }], "smooth"),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
