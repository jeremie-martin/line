/**
 * drums_breath — air and speed breathe in ANTI-phase
 * over a 12s cycle: when the rider lofts, it slows; when it grounds, it speeds
 * up. A trade-off oscillation (raw-lambda sines), grain steady underneath.
 *
 *   air    0.62 + 0.14·sin(2π·t/12)     (0.48–0.76)
 *   speed  0.62 − 0.12·sin(2π·t/12)     (anti-phase, 0.50–0.74)
 *   grain  0.45 (flat)
 *
 * 12s period ≫ ~0.5s contact spacing, so the oscillation is well within the
 * per-gap sampling bandwidth (~2.5 cycles across the track).
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { constant } from "../../scripts/v0/core/curves.ts";

const w = (2 * Math.PI) / 12;
const spec = drumsSpec({
  air: (t) => 0.62 + 0.14 * Math.sin(w * t),
  speed: (t) => 0.62 - 0.12 * Math.sin(w * t),
  grain: constant(0.45),
});
spec.preroll = 5;
spec.jitter = 0; // continuous curve carries the variation; no per-gap jitter
export default spec;
