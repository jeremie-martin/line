/**
 * Fresh long-carrier replication source: sparse low-air endurance phrase.
 *
 * The slow, uneven prefix and 7.25-second gap deliberately differ from the
 * fixed-groove benchmark frontier while retaining a positive-impact release.
 */
import { keyframes } from "../../core/curves.ts";
import type { Spec } from "../../types.ts";

const spec: Spec = {
  duration: 34,
  contacts: [
    { t: 5.150, impact: 0.39 },
    { t: 5.925, impact: 0.55 },
    { t: 6.725, impact: 0.42 },
    { t: 7.600, impact: 0.60 },
    { t: 8.425, impact: 0.45 },
    { t: 9.350, impact: 0.62 },
    { t: 10.175, impact: 0.43 },
    { t: 11.100, impact: 0.59 },
    { t: 11.950, impact: 0.47 },
    { t: 12.900, impact: 0.65 },
    { t: 13.800, impact: 0.49 },
    { t: 14.775, impact: 0.68 },
    { t: 15.650, impact: 0.80 },
    { t: 22.900, impact: 0.70 },
    { t: 23.750, impact: 0.42 },
    { t: 24.600, impact: 0.58 },
    { t: 25.525, impact: 0.44 },
    { t: 26.400, impact: 0.60 },
    { t: 27.375, impact: 0.46 },
    { t: 28.250, impact: 0.62 },
    { t: 29.225, impact: 0.48 },
    { t: 30.100, impact: 0.59 },
  ],
  axes: {
    air: keyframes([
      { t: 0, v: 0.34 },
      { t: 14.775, v: 0.18, ease: "smooth" },
      { t: 15.650, v: 0.05, ease: "hold" },
      { t: 22.900, v: 0.05, ease: "hold" },
      { t: 24.000, v: 0.35, ease: "smooth" },
      { t: 34, v: 0.38 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.57 },
      { t: 14.775, v: 0.63, ease: "smooth" },
      { t: 15.650, v: 0.61, ease: "hold" },
      { t: 22.900, v: 0.61, ease: "hold" },
      { t: 24.000, v: 0.58, ease: "smooth" },
      { t: 34, v: 0.60 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.28 },
      { t: 15.650, v: 0.15, ease: "hold" },
      { t: 22.900, v: 0.15, ease: "hold" },
      { t: 24.000, v: 0.31, ease: "smooth" },
      { t: 34, v: 0.34 },
    ]),
  },
  jitter: 0,
};

export default spec;
