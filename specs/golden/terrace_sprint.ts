/**
 * terrace_sprint - dense fast intro, sparse climb terraces, then dense runout.
 * Amplitude opens only in the roomy middle while speed stays assertive.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpactLegacy } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 20,
  // impact: light pattering through the dense sprint intro, firmer climbing
  // terraces in the roomy middle, then hard accents on the dense run-out.
  contacts: withImpactLegacy(
    [
      ...beats(0.65, 0.5, 9),
      ...beats(5.9, 1.25, 8),
      ...beats(16.4, 0.6, 6),
    ],
    (t) => (t < 5.5 ? 0.28 : t < 16 ? 0.45 + 0.3 * ((t - 5.9) / 8.75) : 0.9),
  ),
  axes: {
    air: keyframes([{ t: 0, v: 0.40 }, { t: 6, v: 0.74 }, { t: 16, v: 0.46 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.76 }, { t: 10, v: 0.66 }, { t: 20, v: 0.82 }], "smooth"),
    elevation: keyframes([{ t: 0, v: 0.50 }, { t: 6, v: 0.56 }, { t: 10, v: 0.62 }, { t: 16, v: 0.50 }], "hold"),
    amplitude: keyframes([{ t: 0, v: 0.08 }, { t: 6, v: 0.38 }, { t: 11, v: 0.56 }, { t: 16, v: 0.10 }], "smooth"),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
