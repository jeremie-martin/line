/**
 * drums_dropout — air holds high, then a sudden floor
 * dip mid-track (the rider "drops to the ground" for a few seconds) before
 * lofting again. A single dramatic valley in one axis while the others hold.
 *
 *   air    0.74 ▔▔╲__╱▔▔ 0.34 dip over ~12–18s
 *   speed  0.60 (flat)
 *   grain  0.50 (flat)
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const spec = drumsSpec({
  air: keyframes([
    { t: 0, v: 0.74 }, { t: 11, v: 0.74, ease: "smooth" },
    { t: 15, v: 0.34, ease: "smooth" }, { t: 19, v: 0.34, ease: "smooth" },
    { t: 23, v: 0.74 },
  ]),
  speed: constant(0.60),
  grain: constant(0.50),
});
spec.preroll = 5;
export default spec;
