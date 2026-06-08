/**
 * drums_crosscut — axes deliberately pulling in opposite directions over the
 * 30s drums grid, so the optimizer can't satisfy them with one dominant knob.
 * Speed climbs while air sinks (they cross around mid-track); grain saw-tooths
 * independently. Showcases linear ramps + a zig-zag keyframe curve.
 *
 *   speed  0.48 ──► 0.80          (steady climb)
 *   air    0.78 ──► 0.45          (steady descent, crosses speed mid-track)
 *   grain  0.35 ▲▼ 0.62 ▲▼ 0.35   (saw-tooth: short→long→short→long→short)
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { ramp, keyframes } from "../../scripts/v0/core/curves.ts";

const spec = drumsSpec({
  speed: ramp(0, 0.48, 30, 0.80),
  air: ramp(0, 0.78, 30, 0.45),
  grain: keyframes([
    { t: 0, v: 0.35 }, { t: 7.5, v: 0.62 }, { t: 15, v: 0.35 },
    { t: 22.5, v: 0.62 }, { t: 30, v: 0.35 },
  ]),
}, (_t, i) => (i % 2 === 0 ? 0.8 : 0.25)); // impact crosscuts beat-to-beat: hard / soft / hard / soft
spec.preroll = 5;
spec.jitter = 0; // continuous curve carries the variation; no per-gap jitter
export default spec;
