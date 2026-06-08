/**
 * drums_tide — a periodic "tide" on air against the 30s drums grid, under a
 * steadily building speed and slowly coarsening grain. Showcases the raw-lambda
 * escape hatch (a sine curve, which has no named builder) composed alongside
 * eased and linear ramps.
 *
 *   air    0.62 + 0.16·sin(2π·t/10)   (~3 swells over the track, 0.46–0.78)
 *   speed  0.50 ──► 0.78  (easeIn — patient start, late surge)
 *   grain  0.40 ──► 0.60  (gradual coarsening)
 *
 * The sine period (10s) is far longer than the contact spacing (~0.5s), so it
 * is well within the per-gap sampling bandwidth — the oscillation is real, not
 * aliased. (A curve that oscillates *within* a single gap is a deliberate
 * non-goal for now; see CALIB.SIGMA note.)
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { ramp } from "../../scripts/v0/core/curves.ts";

const spec = drumsSpec({
  air: (t) => 0.62 + 0.16 * Math.sin((2 * Math.PI * t) / 10),
  speed: ramp(0, 0.50, 30, 0.78, "easeIn"),
  grain: ramp(0, 0.40, 30, 0.60),
}, (t) => 0.5 + 0.35 * Math.sin((2 * Math.PI * t) / 10)); // impact rides the tide: a slow long swell of harder/softer landings tracking the air sine
spec.preroll = 5;
spec.jitter = 0; // continuous curve carries the variation; no per-gap jitter
export default spec;
