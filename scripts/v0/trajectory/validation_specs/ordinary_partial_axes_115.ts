/**
 * Fresh scope control: ordinary irregular cadence with amplitude deliberately
 * unspecified. It is not a positive low-air replication condition.
 */
import { keyframes } from "../../core/curves.ts";
import type { Spec } from "../../types.ts";

const spec: Spec = {
  duration: 24,
  contacts: [
    { t: 5.050, impact: 0.38 },
    { t: 5.675, impact: 0.52 },
    { t: 6.225, impact: 0.41 },
    { t: 6.925, impact: 0.56 },
    { t: 7.475, impact: 0.43 },
    { t: 8.150, impact: 0.59 },
    { t: 8.725, impact: 0.45 },
    { t: 9.475, impact: 0.61 },
    { t: 10.050, impact: 0.46 },
    { t: 10.725, impact: 0.58 },
    { t: 11.300, impact: 0.44 },
    { t: 12.025, impact: 0.63 },
    { t: 12.575, impact: 0.47 },
    { t: 13.275, impact: 0.59 },
    { t: 14.000, impact: 0.62 },
    { t: 15.150, impact: 0.68 },
    { t: 15.725, impact: 0.45 },
    { t: 16.400, impact: 0.60 },
    { t: 16.975, impact: 0.43 },
    { t: 17.700, impact: 0.58 },
    { t: 18.300, impact: 0.46 },
    { t: 19.025, impact: 0.62 },
    { t: 19.600, impact: 0.45 },
    { t: 20.300, impact: 0.59 },
  ],
  axes: {
    air: keyframes([
      { t: 0, v: 0.40 },
      { t: 13.275, v: 0.35, ease: "smooth" },
      { t: 14.000, v: 0.32, ease: "hold" },
      { t: 15.150, v: 0.32, ease: "hold" },
      { t: 16.000, v: 0.41, ease: "smooth" },
      { t: 24, v: 0.43 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.60 },
      { t: 14.000, v: 0.64, ease: "hold" },
      { t: 15.150, v: 0.64, ease: "hold" },
      { t: 16.000, v: 0.61, ease: "smooth" },
      { t: 24, v: 0.60 },
    ]),
  },
  jitter: 0,
};

export default spec;
