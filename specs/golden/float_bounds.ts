/**
 * float_bounds — AMPLITUDE oscillating between medium and big bounds over ~1.2s
 * gaps. Air rides WITH amplitude (pop height is set by airborne time for one
 * arc), so the rider alternates between shorter medium hops and longer big
 * floats. Speed steady; no grain. Smooth (eased) wave; complements pop_train.
 *
 *   air        0.6 ↕ 0.9   (in phase with amplitude)
 *   amplitude  0.30 ↕ 0.68 (= the air-supported pop ceiling at 48f gaps)
 *   speed      0.6 (flat)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 17,
  contacts: beats(1.2, 1.2, 14), // ~1.2s gaps (48f)
  axes: {
    air: keyframes(
      [{ t: 0, v: 0.6 }, { t: 4, v: 0.9 }, { t: 8, v: 0.6 }, { t: 12, v: 0.9 }, { t: 16, v: 0.6 }],
      "smooth",
    ),
    speed: constant(0.6),
    amplitude: keyframes(
      [{ t: 0, v: 0.30 }, { t: 4, v: 0.68 }, { t: 8, v: 0.30 }, { t: 12, v: 0.68 }, { t: 16, v: 0.30 }],
      "smooth",
    ),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
