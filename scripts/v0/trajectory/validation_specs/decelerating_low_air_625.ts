/**
 * Fresh long-carrier replication source: expanding, decelerating low-air run.
 *
 * Its 6.25-second interval reverses the speed trend of the accelerating source
 * so duration is not confounded with one fixed pace regime.
 */
import { keyframes } from "../../core/curves.ts";
import type { Spec } from "../../types.ts";

const spec: Spec = {
  duration: 31,
  contacts: [
    { t: 5.200, impact: 0.47 },
    { t: 5.800, impact: 0.53 },
    { t: 6.425, impact: 0.45 },
    { t: 7.100, impact: 0.58 },
    { t: 7.825, impact: 0.49 },
    { t: 8.600, impact: 0.61 },
    { t: 9.425, impact: 0.50 },
    { t: 10.300, impact: 0.66 },
    { t: 11.250, impact: 0.52 },
    { t: 12.250, impact: 0.68 },
    { t: 13.275, impact: 0.55 },
    { t: 14.350, impact: 0.72 },
    { t: 15.450, impact: 0.57 },
    { t: 16.000, impact: 0.86 },
    { t: 22.250, impact: 0.72 },
    { t: 22.925, impact: 0.46 },
    { t: 23.675, impact: 0.60 },
    { t: 24.500, impact: 0.43 },
    { t: 25.325, impact: 0.58 },
    { t: 26.250, impact: 0.47 },
    { t: 27.100, impact: 0.62 },
    { t: 28.075, impact: 0.45 },
  ],
  axes: {
    air: keyframes([
      { t: 0, v: 0.38 },
      { t: 15.000, v: 0.23, ease: "smooth" },
      { t: 16.000, v: 0.07, ease: "hold" },
      { t: 22.250, v: 0.07, ease: "hold" },
      { t: 23.400, v: 0.37, ease: "smooth" },
      { t: 31, v: 0.40 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.72 },
      { t: 11.250, v: 0.68, ease: "smooth" },
      { t: 16.000, v: 0.62, ease: "hold" },
      { t: 22.250, v: 0.52, ease: "linear" },
      { t: 23.400, v: 0.57, ease: "smooth" },
      { t: 31, v: 0.61 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.33 },
      { t: 16.000, v: 0.16, ease: "hold" },
      { t: 22.250, v: 0.16, ease: "hold" },
      { t: 23.400, v: 0.34, ease: "smooth" },
      { t: 31, v: 0.37 },
    ]),
    elevation: keyframes([
      { t: 0, v: 0.56 },
      { t: 16.000, v: 0.43, ease: "smooth" },
      { t: 22.250, v: 0.36, ease: "linear" },
      { t: 31, v: 0.52, ease: "smooth" },
    ]),
  },
  jitter: 0,
};

export default spec;
