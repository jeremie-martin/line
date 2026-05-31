/**
 * drums_accelerando — a patient speed build that surges
 * late (easeIn), while the lines tighten as the pace picks up. Air held steady
 * so the acceleration reads cleanly on its own.
 *
 *   speed  0.45 ──► 0.85   (easeIn: slow start, late surge)
 *   grain  0.60 ──► 0.35   (lines shorten as speed rises)
 *   air    0.60 (flat)
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { constant, ramp } from "../../scripts/v0/core/curves.ts";

const spec = drumsSpec({
  speed: ramp(0, 0.45, 30, 0.85, "easeIn"),
  grain: ramp(0, 0.60, 30, 0.35),
  air: constant(0.60),
});
spec.preroll = 5;
spec.jitter = 0; // continuous curve carries the variation; no per-gap jitter
export default spec;
