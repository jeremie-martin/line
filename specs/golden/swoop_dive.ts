/**
 * swoop_dive — ELEVATION contour with a dive then a climb, against a building
 * speed, over ~1.0s gaps. The rider drops (elevation 0.2), then swoops back up
 * (0.8) as speed grows to fund the climb. Air mid; no grain. Tests that the
 * compiler can both shed and gain altitude on a sparse cadence.
 *
 *   elevation  0.5 → 0.2 (dive) → 0.62 (climb to ceiling) → 0.5
 *   speed      0.5 → 0.8 (smooth build)
 *   air        0.55 (flat)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpact } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 14,
  // impact: soft as it swoops down, hardest slam at the dive bottom (~4-5s),
  // then easing off as it climbs back out.
  contacts: withImpact(
    beats(1.0, 1.0, 13),
    keyframes([{ t: 0, v: 0.2 }, { t: 4.5, v: 0.95 }, { t: 9, v: 0.4 }, { t: 13, v: 0.45 }], "smooth"),
  ), // ~1.0s gaps (40f)
  axes: {
    air: constant(0.55),
    speed: keyframes([{ t: 0, v: 0.5 }, { t: 13, v: 0.8 }], "smooth"),
    elevation: keyframes(
      [{ t: 0, v: 0.5 }, { t: 4, v: 0.2 }, { t: 9, v: 0.62 }, { t: 13, v: 0.5 }],
      "smooth",
    ),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
