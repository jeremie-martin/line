/**
 * Fresh scope control: open high-air phrase. A duration-only support action is
 * not expected to be beneficial here; its response is reported, never pooled
 * as evidence for the low-air relation.
 */
import { keyframes } from "../../core/curves.ts";
import type { Spec } from "../../types.ts";

const spec: Spec = {
  duration: 23,
  contacts: [
    { t: 5.250, impact: 0.44 },
    { t: 6.100, impact: 0.58 },
    { t: 6.875, impact: 0.48 },
    { t: 7.775, impact: 0.64 },
    { t: 8.525, impact: 0.49 },
    { t: 9.450, impact: 0.66 },
    { t: 10.225, impact: 0.50 },
    { t: 11.075, impact: 0.63 },
    { t: 11.825, impact: 0.47 },
    { t: 12.750, impact: 0.67 },
    { t: 13.525, impact: 0.53 },
    { t: 14.400, impact: 0.78 },
    { t: 16.350, impact: 0.88 },
    { t: 17.200, impact: 0.50 },
    { t: 18.075, impact: 0.65 },
    { t: 18.875, impact: 0.48 },
    { t: 19.800, impact: 0.66 },
    { t: 20.600, impact: 0.49 },
    { t: 21.500, impact: 0.63 },
  ],
  axes: {
    air: keyframes([
      { t: 0, v: 0.52 },
      { t: 13.525, v: 0.70, ease: "smooth" },
      { t: 14.400, v: 0.80, ease: "hold" },
      { t: 16.350, v: 0.80, ease: "hold" },
      { t: 17.200, v: 0.56, ease: "smooth" },
      { t: 23, v: 0.50 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.62 },
      { t: 14.400, v: 0.70, ease: "hold" },
      { t: 16.350, v: 0.70, ease: "hold" },
      { t: 17.200, v: 0.63, ease: "smooth" },
      { t: 23, v: 0.60 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.39 },
      { t: 14.400, v: 0.72, ease: "hold" },
      { t: 16.350, v: 0.72, ease: "hold" },
      { t: 17.200, v: 0.42, ease: "smooth" },
      { t: 23, v: 0.36 },
    ]),
  },
  jitter: 0,
};

export default spec;
