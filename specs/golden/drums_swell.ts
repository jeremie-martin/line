/**
 * drums_swell — a single symmetric rise-and-fall against the 30s drums grid.
 * Every axis swells smoothly to a mid-track peak (~15s) then recedes to where
 * it started: a breathing "in and out" arc. Showcases smooth (smoothstep)
 * keyframe easing and a continuous hump that the old constant sections could
 * not express without stair-stepping.
 *
 *   air    0.45 → 0.80 → 0.45   (lofts mid-track, settles)
 *   speed  0.50 → 0.78 → 0.50   (accelerates into the peak, eases off)
 *   grain  0.40 → 0.62 → 0.40   (lines grow then shrink)
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const swell = (lo: number, hi: number) =>
  keyframes([{ t: 0, v: lo, ease: "smooth" }, { t: 15, v: hi, ease: "smooth" }, { t: 30, v: lo }]);

const spec = drumsSpec({
  air: swell(0.45, 0.80),
  speed: swell(0.50, 0.78),
  grain: swell(0.40, 0.62),
});
spec.preroll = 5;
spec.jitter = 0; // continuous curve carries the variation; no per-gap jitter
export default spec;
