/**
 * valley_bounce - sparse beats dive into a valley and rebound into high pops.
 * Air, amplitude, speed, and elevation all change together over roomy gaps.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 17,
  contacts: beats(1.1, 1.1, 15),
  axes: {
    air: keyframes([{ t: 0, v: 0.58 }, { t: 6, v: 0.44 }, { t: 12, v: 0.86 }, { t: 17, v: 0.64 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.50 }, { t: 8, v: 0.66 }, { t: 17, v: 0.60 }], "smooth"),
    elevation: keyframes([{ t: 0, v: 0.50 }, { t: 5, v: 0.24 }, { t: 12, v: 0.64 }, { t: 17, v: 0.52 }], "smooth"),
    amplitude: keyframes([{ t: 0, v: 0.26 }, { t: 6, v: 0.12 }, { t: 12, v: 0.66 }, { t: 17, v: 0.34 }], "smooth"),
  },
  jitter: 0.05,
  preroll: 5,
};

export default spec;
