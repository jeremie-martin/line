/**
 * drums_pendulum — single-axis swing against beats/drums_0_30s_60_125.json.
 *
 * Six 5-second sections alternating only `air` between extremes; the other
 * three axes are held flat across the whole spec. This is an *isolation*
 * stressor: the compiler must flip ground↔air every 5s without letting
 * speed/grain/contact_style drift along.
 *
 *   §0 [ 0– 5s]  glued    air=0.15   — wheels on the floor
 *   §1 [ 5–10s]  lofted   air=0.85   — riding above the beat
 *   §2 [10–15s]  glued    air=0.15
 *   §3 [15–20s]  lofted   air=0.85
 *   §4 [20–25s]  glued    air=0.15
 *   §5 [25–30s]  lofted   air=0.85
 *
 * Why this is hard:
 *   - The v0 compiler (as of 89038c1) drifts +0.15 air across all sections;
 *     hitting air=0.15 with 11 contacts in the section is a tight squeeze.
 *   - Section boundary at every 5s coincides with drum onsets, so the
 *     compiler can't slide the transition around.
 *   - Holding speed=0.55 across both glued and lofted means it must actively
 *     resist the natural speed-up that gravity gives airborne sections.
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";

const FLAT = { speed: 0.55, grain: 0.45, contact_style: 0.45 };

const spec = drumsSpec([
  { t0:  0, t1:  5, air: 0.15, ...FLAT },
  { t0:  5, t1: 10, air: 0.85, ...FLAT },
  { t0: 10, t1: 15, air: 0.15, ...FLAT },
  { t0: 15, t1: 20, air: 0.85, ...FLAT },
  { t0: 20, t1: 25, air: 0.15, ...FLAT },
  { t0: 25, t1: 30, air: 0.85, ...FLAT },
]);
spec.preroll = 5;
export default spec;
