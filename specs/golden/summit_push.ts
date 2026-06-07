/**
 * summit_push — monotonic ELEVATION climb to the ceiling, funded by high speed,
 * over sparse ~1.1s gaps. Climbing spends speed, so this pairs a steep target
 * with a high speed target to keep the ascent feasible. Air mid; no grain.
 *
 *   elevation  0.5 → 1.0  (steady climb to the speed-supported ceiling)
 *   speed      0.7 → 0.9  (high, to fund the climb)
 *   air        0.5 (flat)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 14,
  contacts: beats(1.1, 1.1, 12), // ~1.1s gaps (44f) — non-dense
  axes: {
    air: constant(0.5),
    speed: keyframes([{ t: 0, v: 0.7 }, { t: 13, v: 0.9 }], "smooth"),
    elevation: keyframes([{ t: 0, v: 0.5 }, { t: 13, v: 1.0 }], "smooth"),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
