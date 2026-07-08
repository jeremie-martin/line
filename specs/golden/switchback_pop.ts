/**
 * switchback_pop - irregular switchback cadence with alternating climb/drop
 * targets and pop accents. The compact beats force restrained amplitude.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpactLegacy } from "../../scripts/v0/core/beats.ts";

// pops accent the high-amplitude switchback windows (t≈4–8, t≈12+), restrained
// elsewhere; alternating beat-to-beat to read as climb/drop switchbacks.
const contacts: Contact[] = withImpactLegacy(
  [
    0.8, 1.3, 2.1, 2.6, 3.4, 4.4, 5.0, 5.9, 6.4, 7.3,
    8.4, 8.9, 9.8, 10.3, 11.2, 12.4, 12.9, 13.8, 14.6,
  ].map((t) => ({ t })),
  (t, i) => {
    const inPopWindow = (t >= 4 && t < 8) || t >= 12;
    const base = inPopWindow ? 0.6 : 0.25;
    return base + (i % 2 === 0 ? 0.2 : -0.05); // alternate accent for switchback feel
  },
);

const spec: Spec = {
  duration: 15.5,
  contacts,
  axes: {
    air: keyframes([{ t: 0, v: 0.50 }, { t: 4, v: 0.68 }, { t: 8, v: 0.46 }, { t: 12, v: 0.72 }], "hold"),
    speed: keyframes([{ t: 0, v: 0.58 }, { t: 7, v: 0.76 }, { t: 15, v: 0.62 }], "smooth"),
    elevation: keyframes(
      [{ t: 0, v: 0.58 }, { t: 3, v: 0.38 }, { t: 6, v: 0.62 }, { t: 9, v: 0.36 }, { t: 12, v: 0.62 }],
      "hold",
    ),
    amplitude: keyframes([{ t: 0, v: 0.18 }, { t: 4, v: 0.40 }, { t: 8, v: 0.12 }, { t: 12, v: 0.46 }], "hold"),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
