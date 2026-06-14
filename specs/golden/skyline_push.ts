/**
 * skyline_push - sparse high-air launch into a denser skyline push. The target
 * starts with big amplitude, then trades height for speed and compact cadence.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpactLegacy } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 18,
  // impact: floaty soft touchdowns off the big high-air launch, then pushing
  // progressively harder through the compact skyline run.
  contacts: withImpactLegacy(
    [
      ...beats(1.25, 1.25, 6),
      ...beats(9.2, 0.7, 12),
    ],
    (t) => (t < 9 ? 0.3 : 0.5 + 0.45 * ((t - 9.2) / 8.7)),
  ),
  axes: {
    air: keyframes([{ t: 0, v: 0.86 }, { t: 8, v: 0.66 }, { t: 18, v: 0.48 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.48 }, { t: 9, v: 0.68 }, { t: 18, v: 0.84 }], "smooth"),
    elevation: keyframes([{ t: 0, v: 0.58 }, { t: 8, v: 0.64 }, { t: 18, v: 0.52 }], "smooth"),
    amplitude: keyframes([{ t: 0, v: 0.68 }, { t: 8, v: 0.38 }, { t: 18, v: 0.12 }], "smooth"),
  },
  jitter: 0.05,
  preroll: 5,
};

export default spec;
