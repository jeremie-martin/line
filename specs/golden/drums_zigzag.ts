/**
 * drums_zigzag — air saw-tooths up and down on a 12s
 * triangle while speed climbs steadily underneath, so the two axes repeatedly
 * cross. A rhythmic up-down against a monotone trend.
 *
 *   air    0.50 ▲▼ 0.78   (triangle, 12s period)
 *   speed  0.50 ──► 0.78  (steady climb, crosses air each cycle)
 *   grain  0.45 (flat)
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { constant, ramp } from "../../scripts/v0/core/curves.ts";

const triangle = (lo: number, hi: number, P: number) => (t: number) => {
  const phase = (t % P) / P;
  return lo + (hi - lo) * (1 - Math.abs(2 * phase - 1));
};

const spec = drumsSpec({
  air: triangle(0.50, 0.78, 12),
  speed: ramp(0, 0.50, 30, 0.78),
  grain: constant(0.45),
}, (_t, i) => (i % 2 === 0 ? 0.75 : 0.3)); // impact zigzags beat-to-beat: alternating hard / soft landings
spec.preroll = 5;
spec.jitter = 0; // continuous curve carries the variation; no per-gap jitter
export default spec;
