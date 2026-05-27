/**
 * drums_fast — 2-section, speed-biased ride against
 * beats/drums_0_30s_60_125.json.
 *
 *   §0 [ 0– 15s] balanced  (air 0.60, speed 0.70)
 *   §1 [15– 30s] aerial    (air 0.80, speed 0.75)
 *
 * speed is mean(|v|) / SPEED_CAP where SPEED_CAP = 12 px/frame, so the
 * targets here ask the compiler to keep the rider in the upper-velocity
 * band throughout (≈ 8.4–9 px/frame). Combined with the air axis this
 * exercises multi-axis cost, the v0 compiler's known weak spot.
 */
import { drumsSpec } from "../scripts/v0/specs/_drums.ts";

const spec = drumsSpec([
  { t0: 0,  t1: 15, air: 0.6, speed: 0.7  },
  { t0: 15, t1: 30, air: 0.8, speed: 0.75 },
]);
export default spec;
