/**
 * Trouble · kick. Follows the drums wherever they play and the voice where it plays
 * alone (draft v1, plus the opening voice syllables and the last kick at 50.07).
 *
 *   intro    the opening crash, the first syllables of the voice pulse, then
 *            phrase starts and chord entries;
 *   groove   every kick of the 3-3-2 pattern;
 *   break    the rider floats into the drop;
 *   drop     every heavy kick, and the snares that stand alone;
 *   outro    the voice break's syllables, then every kick.
 * Not landed: the pickups 0.22 s before kicks, the bass entries and after-hits
 * around the heavy kicks (the kick is the accent), the voice over the drums.
 */
import type { Contact, Curve, Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";

const voiceLed = (t: number) => t < m.GROOVE_T || (t >= m.STOP_T && t < m.BUILD_END_T - 0.03);
function impactFor(t: number): number {
  if (Math.abs(t - m.DROP_T) < 0.03) return 1.0; // the drop: pinned
  if (Math.abs(t - m.OPENING_CRASH) < 0.03) return 0.5; // a real hit, kept medium at the very start
  if (voiceLed(t)) {
    // Gentle, building over the last ~2.5 s of the intro into the groove.
    const build = t < m.GROOVE_T && t > 11.8 ? (t - 11.8) / (m.GROOVE_T - 11.8) : 0;
    return Number(m.clamp(m.voiceStrength(t) + 0.18 * build, 0.04, 0.35).toFixed(3));
  }
  return Number(m.clamp(m.drumStrength(t), 0.2, 0.9).toFixed(3));
}

const times = m.landings([m.OPENING_CRASH, 0.85, 1.30, 1.73], m.INTRO_PHRASES, m.GROOVE_KICKS,
  m.DROP_KICKS, m.DROP_SNARES, m.BREAK2_VOICE, m.OUTRO_KICKS);
const contacts: Contact[] = beats(times.map((t) => ({ t, impact: impactFor(t) })));

const speed: Curve = keyframes([
  { t: 0.0, v: 0.36, ease: "smooth" },
  { t: 12.0, v: 0.42, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.56, ease: "easeIn" },
  { t: 27.24, v: 0.62, ease: "smooth" },
  { t: m.DROP_T, v: 0.78, ease: "easeIn" }, // build speed through the float into the drop
  { t: 42.3, v: 0.80, ease: "smooth" },
  { t: m.STOP_T, v: 0.60, ease: "smooth" },
  { t: 46.0, v: 0.52, ease: "smooth" },
  { t: m.BUILD_END_T, v: 0.66, ease: "easeIn" },
  { t: m.DURATION, v: 0.64 },
]);
const air: Curve = keyframes([
  { t: 0.0, v: 0.60, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.64, ease: "smooth" },
  { t: m.DROP_T, v: 0.70, ease: "smooth" },
  { t: m.STOP_T, v: 0.66, ease: "smooth" },
  { t: m.DURATION, v: 0.66 },
]);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { beatPunch: { threshold: 0.80, amp: 0.13, floor: 0.5, decay: 4, attack: 1, dir: "in" }, zoom: m.zoom },
  contacts,
  jitter: 0,
  axes: { air, speed },
};
export default spec;
