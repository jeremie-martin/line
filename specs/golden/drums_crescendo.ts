/**
 * drums_crescendo — monotonic multi-axis build against
 * beats/drums_0_30s_60_125.json. Every axis grows linearly across three
 * 10-second sections: calm → driving → unleashed. Tests *graduated coupling*,
 * not contrast — the compiler must deliver a felt buildup arc where each
 * section is visibly more energetic than the last on all four axes
 * simultaneously.
 *
 *   §0 [ 0–10s]  whisper   air 0.30  speed 0.35  grain 0.20  contact 0.30
 *                          — quiet ground-pattering, short clipped contacts
 *   §1 [10–20s]  drive     air 0.55  speed 0.60  grain 0.50  contact 0.55
 *                          — middle gear, medium lines, half-riding
 *   §2 [20–30s]  unleash   air 0.85  speed 0.90  grain 0.80  contact 0.85
 *                          — sweeping leaps along long lines, fully gripped
 *
 * Why this is hard:
 *   - All four axes increase together; the compiler can't trade off (the way
 *     drums_signature lets it flip contact_style while pinning speed).
 *   - §0's `grain=0.20` asks for very short lines (~10px median) while
 *     `contact_style=0.30` means lightly clipping them — gives the opener a
 *     restless, scampering texture before the build hits.
 *   - §2's `speed=0.90` is near the SPEED_CAP (≈10.8 px/f mean); achieving
 *     that *along long lines* (grain 0.80) without sliding off is the visual
 *     payoff and the algorithmic cliff.
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";

const spec = drumsSpec([
  { t0:  0, t1: 10, air: 0.30, speed: 0.35, grain: 0.20, contact_style: 0.30 },
  { t0: 10, t1: 20, air: 0.55, speed: 0.60, grain: 0.50, contact_style: 0.55 },
  { t0: 20, t1: 30, air: 0.85, speed: 0.90, grain: 0.80, contact_style: 0.85 },
]);
spec.preroll = 5;
export default spec;
