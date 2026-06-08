/**
 * drums_pulse — grain pulses chunky↔fine on a 10s
 * triangle wave (lines grow and shrink rhythmically) while air gently swells
 * and recedes once. Speed steady. Showcases a triangle (raw-lambda) grain.
 *
 *   grain  0.32 ▲▼ 0.60   (triangle, 10s period → 3 pulses)
 *   air    0.50 → 0.70 → 0.50   (one slow swell)
 *   speed  0.60 (flat)
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

/** Triangle wave: `lo` at phase 0/1, `hi` at phase 0.5, period `P` seconds. */
const triangle = (lo: number, hi: number, P: number) => (t: number) => {
  const phase = (t % P) / P;
  return lo + (hi - lo) * (1 - Math.abs(2 * phase - 1));
};

const spec = drumsSpec({
  grain: triangle(0.32, 0.60, 10),
  air: keyframes([{ t: 0, v: 0.50, ease: "smooth" }, { t: 15, v: 0.70, ease: "smooth" }, { t: 30, v: 0.50 }]),
  speed: constant(0.60),
}, triangle(0.2, 0.9, 10)); // impact pulses in phase with the grain triangle: a hard accent at each peak, soft in the troughs
spec.preroll = 5;
spec.jitter = 0; // continuous curve carries the variation; no per-gap jitter
export default spec;
