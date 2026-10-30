/**
 * Trouble · slam. Few landings, long airs, every one hit hard: only the start of
 * each 1.79 s cycle once the drums play.
 *
 *   intro    the opening crash and the strongest vocal phrase starts, ~2–3 s apart;
 *   groove   each 3-3-2 cycle start;
 *   break    a long float into the drop;
 *   drop     each heavy cycle start, at full strength;
 *   outro    one syllable in the voice break, then the cycle starts and the last kick.
 * Not landed: everything between cycle starts. This trades sync for height and slam.
 */
import type { Contact, Curve, Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";

const INTRO = [m.OPENING_CRASH, 3.51, 5.77, 8.01, 10.70, 12.93];
const OUTRO = [44.91, 46.95, 48.74, 50.07];
function impactFor(t: number): number {
  if (Math.abs(t - m.DROP_T) < 0.03) return 1.0;
  if (t < m.GROOVE_T) return Number(m.clamp(m.voiceStrength(t, 0.15, 1.0), 0.2, 0.5).toFixed(3));
  if (Math.abs(t - 44.91) < 0.03) return 0.3;
  return Number(m.clamp(m.drumStrength(t, 1.0), 0.6, 1.0).toFixed(3));
}

const times = m.landings(INTRO, m.GROOVE_CYCLES, m.DROP_CYCLES, OUTRO);
const contacts: Contact[] = beats(times.map((t) => ({ t, impact: impactFor(t) })));

const speed: Curve = keyframes([
  { t: 0.0, v: 0.40, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.58, ease: "smooth" },
  { t: m.DROP_T, v: 0.80, ease: "easeIn" },
  { t: m.STOP_T, v: 0.64, ease: "smooth" },
  { t: m.DURATION, v: 0.70 },
]);
const air: Curve = keyframes([
  { t: 0.0, v: 0.80, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.85, ease: "smooth" },
  { t: m.DROP_T, v: 0.90, ease: "smooth" },
  { t: m.STOP_T, v: 0.85, ease: "smooth" },
  { t: m.DURATION, v: 0.85 },
]);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { beatPunch: { threshold: 0.75, amp: 0.16, floor: 0.5, decay: 4, attack: 1, dir: "in" }, zoom: m.zoom },
  contacts,
  jitter: 0,
  axes: { air, speed },
};
export default spec;
