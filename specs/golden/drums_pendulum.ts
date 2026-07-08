/**
 * drums_pendulum — single-axis swing against beats/drums_0_30s_60_125.json.
 *
 * `air` alternates between extremes every 5s while the other three axes are
 * held flat (constant) across the whole spec. An *isolation* stressor: the
 * compiler must flip ground↔air every 5s without letting speed/grain/contact
 * drift along.
 *
 *   [ 0– 5s]  glued    air=0.15   — wheels on the floor
 *   [ 5–10s]  lofted   air=0.85   — riding above the beat
 *   [10–15s]  glued    air=0.15
 *   [15–20s]  lofted   air=0.85
 *   [20–25s]  glued    air=0.15
 *   [25–30s]  lofted   air=0.85
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const spec = drumsSpec({
  air: keyframes(
    [
      { t: 0, v: 0.15 }, { t: 5, v: 0.85 }, { t: 10, v: 0.15 },
      { t: 15, v: 0.85 }, { t: 20, v: 0.15 }, { t: 25, v: 0.85 },
    ],
    "hold",
  ),
  speed: constant(0.55),
  grain: constant(0.45),
}, (t) => (Math.floor(t / 5) % 2 === 0 ? 0.85 : 0.2)); // impact swings with the pendulum: glued blocks slam hard, lofted blocks land soft
spec.preroll = 5;
spec.jitter = 0;
export default spec;
