/**
 * drums_signature — 3-act narrative against beats/drums_0_30s_60_125.json.
 * §1↔§2 hold speed constant and flip contact_style so the axis change is
 * legible on-screen; §0 sets a slower baseline so §1's kick lands.
 *
 *   §0 [ 0–10s]  cruise   slow, mid-air                      — relaxed opener
 *   §1 [10–20s]  grip     fast + long contact, long lines    — rider rides each line
 *   §2 [20–30s]  skip     fast + short contact, short lines  — rider ricochets
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";

const spec = drumsSpec([
  { t0:  0, t1: 10, air: 0.45, speed: 0.40, grain: 0.45, contact_style: 0.50 },
  { t0: 10, t1: 20, air: 0.60, speed: 0.80, grain: 0.75, contact_style: 0.80 },
  { t0: 20, t1: 30, air: 0.60, speed: 0.80, grain: 0.25, contact_style: 0.20 },
]);
spec.preroll = 5;
export default spec;
