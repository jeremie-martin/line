/**
 * Fresh long-carrier replication source: contracting pre-release cadence.
 *
 * The 4.75-second interval is a manually authored acceleration phrase, not a
 * variant of the benchmark endurance family.
 */
import { keyframes } from "../../core/curves.ts";
import type { Spec } from "../../types.ts";

const spec: Spec = {
  duration: 28,
  contacts: [
    { t: 5.000, impact: 0.36 },
    { t: 5.950, impact: 0.43 },
    { t: 6.850, impact: 0.47 },
    { t: 7.700, impact: 0.41 },
    { t: 8.500, impact: 0.54 },
    { t: 9.250, impact: 0.46 },
    { t: 9.950, impact: 0.58 },
    { t: 10.600, impact: 0.49 },
    { t: 11.200, impact: 0.62 },
    { t: 11.775, impact: 0.51 },
    { t: 12.325, impact: 0.65 },
    { t: 12.875, impact: 0.54 },
    { t: 13.400, impact: 0.69 },
    { t: 13.900, impact: 0.57 },
    { t: 14.375, impact: 0.71 },
    { t: 14.700, impact: 0.74 },
    { t: 19.450, impact: 0.79 },
    { t: 20.000, impact: 0.49 },
    { t: 20.575, impact: 0.63 },
    { t: 21.150, impact: 0.45 },
    { t: 21.775, impact: 0.60 },
    { t: 22.350, impact: 0.47 },
    { t: 23.000, impact: 0.64 },
    { t: 23.575, impact: 0.46 },
    { t: 24.225, impact: 0.61 },
  ],
  axes: {
    air: keyframes([
      { t: 0, v: 0.46 },
      { t: 13.400, v: 0.26, ease: "smooth" },
      { t: 14.700, v: 0.09, ease: "hold" },
      { t: 19.450, v: 0.09, ease: "hold" },
      { t: 20.575, v: 0.38, ease: "smooth" },
      { t: 28, v: 0.43 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.51 },
      { t: 11.200, v: 0.63, ease: "smooth" },
      { t: 14.700, v: 0.78, ease: "hold" },
      { t: 19.450, v: 0.78, ease: "hold" },
      { t: 20.575, v: 0.66, ease: "smooth" },
      { t: 28, v: 0.58 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.30 },
      { t: 14.700, v: 0.12, ease: "hold" },
      { t: 19.450, v: 0.12, ease: "hold" },
      { t: 20.575, v: 0.35, ease: "smooth" },
      { t: 28, v: 0.40 },
    ]),
  },
  jitter: 0,
};

export default spec;
