/**
 * rolling_hills — gently oscillating ELEVATION (up-and-over, down-and-through)
 * on a steady speed, low-mid air, ~0.9s gaps. A smooth altitude wave the rider
 * traces beat to beat. No grain. Exercises repeated small climbs/descents.
 *
 *   elevation  0.40 ↕ 0.65  (smooth wave, ~6s period)
 *   speed      0.55 (flat)
 *   air        0.45 (flat)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpact } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 17,
  // impact rides the wave in counter-phase to elevation: hard landings in the
  // valleys (after each descent), soft grazes over the crests.
  contacts: withImpact(beats(0.9, 0.9, 18), (t) => 0.5 + 0.35 * Math.cos((2 * Math.PI * t) / 6)), // ~0.9s gaps (36f)
  axes: {
    air: constant(0.45),
    speed: constant(0.55),
    elevation: keyframes(
      [
        { t: 0, v: 0.40 }, { t: 3, v: 0.65 }, { t: 6, v: 0.40 },
        { t: 9, v: 0.65 }, { t: 12, v: 0.40 }, { t: 15, v: 0.65 },
      ],
      "smooth",
    ),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
