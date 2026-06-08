/**
 * glide_stairs - medium cadence stair steps that glide down, level, then climb.
 * Moderate amplitude keeps the stair profile visible without needing huge air.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 18,
  contacts: beats(0.95, 0.95, 18),
  axes: {
    air: keyframes([{ t: 0, v: 0.52 }, { t: 9, v: 0.66 }, { t: 18, v: 0.58 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.54 }, { t: 18, v: 0.70 }], "smooth"),
    elevation: keyframes(
      [{ t: 0, v: 0.58 }, { t: 4, v: 0.42 }, { t: 8, v: 0.50 }, { t: 12, v: 0.60 }, { t: 16, v: 0.64 }],
      "hold",
    ),
    amplitude: keyframes([{ t: 0, v: 0.22 }, { t: 6, v: 0.34 }, { t: 12, v: 0.42 }, { t: 18, v: 0.30 }], "smooth"),
  },
  jitter: 0.05,
  preroll: 5,
};

export default spec;
