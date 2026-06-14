/**
 * canyon_steps - mixed cadence with a low valley, stepped climb, and pop accents.
 * Dense early beats stay compact; sparse middle gaps carry larger lift and climb.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpactLegacy } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 18,
  // impact in three steps matching the cadence: soft dense valley, firmer
  // climbing middle, hard stepped pop accents on the final run-out.
  contacts: withImpactLegacy(
    [
      ...beats(0.75, 0.55, 8),
      ...beats(5.8, 1.15, 7),
      ...beats(14.2, 0.65, 5),
    ],
    (t) => (t < 5.5 ? 0.22 : t < 14 ? 0.55 : 0.9),
  ),
  axes: {
    air: keyframes([{ t: 0, v: 0.45 }, { t: 5, v: 0.78 }, { t: 14, v: 0.52 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.52 }, { t: 10, v: 0.72 }, { t: 18, v: 0.58 }], "smooth"),
    elevation: keyframes([{ t: 0, v: 0.34 }, { t: 6, v: 0.42 }, { t: 11, v: 0.62 }, { t: 18, v: 0.50 }], "hold"),
    amplitude: keyframes([{ t: 0, v: 0.08 }, { t: 5, v: 0.42 }, { t: 11, v: 0.58 }, { t: 18, v: 0.16 }], "smooth"),
  },
  jitter: 0.05,
  preroll: 5,
};

export default spec;
