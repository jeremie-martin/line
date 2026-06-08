/**
 * rolling_drop - sparse rolling phrase that starts high, drops, then rebounds.
 * Amplitude crests as the elevation recovers, with steady mid speed.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 19,
  contacts: beats(1.15, 1.15, 16),
  axes: {
    air: keyframes([{ t: 0, v: 0.62 }, { t: 7, v: 0.50 }, { t: 13, v: 0.82 }, { t: 19, v: 0.58 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.58 }, { t: 19, v: 0.68 }], "smooth"),
    elevation: keyframes([{ t: 0, v: 0.64 }, { t: 7, v: 0.28 }, { t: 13, v: 0.60 }, { t: 19, v: 0.48 }], "smooth"),
    amplitude: keyframes([{ t: 0, v: 0.30 }, { t: 7, v: 0.16 }, { t: 13, v: 0.62 }, { t: 19, v: 0.26 }], "smooth"),
  },
  jitter: 0.05,
  preroll: 5,
};

export default spec;
