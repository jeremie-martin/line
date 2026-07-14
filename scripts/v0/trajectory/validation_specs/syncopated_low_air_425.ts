/**
 * Fresh long-carrier replication source: irregular low-air release.
 *
 * This is study-only material, deliberately authored independently of the
 * benchmark and production specs. The 4.25-second interval follows the late
 * syncopated launch accent at 13.950s; it is not selected from a compiler run.
 */
import { keyframes } from "../../core/curves.ts";
import type { Spec } from "../../types.ts";

const spec: Spec = {
  duration: 26,
  contacts: [
    { t: 5.100, impact: 0.42 },
    { t: 5.800, impact: 0.55 },
    { t: 6.450, impact: 0.34 },
    { t: 7.300, impact: 0.61 },
    { t: 8.050, impact: 0.39 },
    { t: 8.650, impact: 0.58 },
    { t: 9.550, impact: 0.46 },
    { t: 10.150, impact: 0.64 },
    { t: 11.025, impact: 0.37 },
    { t: 11.575, impact: 0.55 },
    { t: 12.350, impact: 0.43 },
    { t: 13.125, impact: 0.68 },
    { t: 13.950, impact: 0.82 },
    { t: 18.200, impact: 0.74 },
    { t: 18.725, impact: 0.44 },
    { t: 19.350, impact: 0.60 },
    { t: 20.050, impact: 0.39 },
    { t: 20.650, impact: 0.57 },
    { t: 21.300, impact: 0.41 },
    { t: 22.025, impact: 0.63 },
    { t: 22.650, impact: 0.45 },
    { t: 23.400, impact: 0.58 },
  ],
  axes: {
    air: keyframes([
      { t: 0, v: 0.42 },
      { t: 12.900, v: 0.31, ease: "smooth" },
      { t: 13.950, v: 0.08, ease: "hold" },
      { t: 18.200, v: 0.08, ease: "hold" },
      { t: 19.100, v: 0.40, ease: "smooth" },
      { t: 26, v: 0.44 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.59 },
      { t: 12.900, v: 0.67, ease: "smooth" },
      { t: 13.950, v: 0.69, ease: "hold" },
      { t: 18.200, v: 0.69, ease: "hold" },
      { t: 19.100, v: 0.62, ease: "smooth" },
      { t: 26, v: 0.60 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.34 },
      { t: 13.950, v: 0.14, ease: "hold" },
      { t: 18.200, v: 0.14, ease: "hold" },
      { t: 19.100, v: 0.31, ease: "smooth" },
      { t: 26, v: 0.36 },
    ]),
  },
  jitter: 0,
};

export default spec;
