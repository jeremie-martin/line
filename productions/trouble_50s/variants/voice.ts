/**
 * Trouble · voice. Follows the singer wherever the voice leads; the drums only
 * mark the start of each 3-3-2 cycle and the outro.
 *
 *   intro    every syllable of the 0.45 s voice pulse, and the opening crash;
 *   groove   the syllables that stand out over the drums, plus each cycle start;
 *   break    the voice alone, right up to the drop (so the drop hits less hard);
 *   drop     each heavy cycle start, and the voice between them;
 *   outro    the voice break's syllables, then every kick (the drums lead again).
 * Air is lower and speed gentler than in kick: many small, close landings.
 */
import type { Contact, Curve, Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";

const cycles = new Set([...m.GROOVE_CYCLES, ...m.DROP_CYCLES, ...m.OUTRO_KICKS]);
function impactFor(t: number): number {
  if (Math.abs(t - m.DROP_T) < 0.03) return 0.95;
  if (Math.abs(t - m.OPENING_CRASH) < 0.03) return 0.45;
  if ([...cycles].some((c) => Math.abs(c - t) < 0.03)) return Number(m.clamp(m.drumStrength(t, 0.85), 0.3, 0.85).toFixed(3));
  // A syllable: by how sharply it enters, a little firmer over the drums.
  const overDrums = t >= m.GROOVE_T && !(t >= m.STOP_T && t < m.BUILD_END_T);
  return Number(m.clamp(m.voiceStrength(t, overDrums ? 0.2 : 0.06, 0.6), 0.05, 0.5).toFixed(3));
}

const times = m.landings([m.OPENING_CRASH], m.INTRO_VOICE, m.GROOVE_VOICE, m.GROOVE_CYCLES, m.BREAK_VOICE,
  m.DROP_CYCLES, m.DROP_VOICE, m.BREAK2_VOICE, m.OUTRO_KICKS);
const contacts: Contact[] = beats(times.map((t) => ({ t, impact: impactFor(t) })));

const speed: Curve = keyframes([
  { t: 0.0, v: 0.32, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.48, ease: "smooth" },
  { t: m.DROP_T, v: 0.62, ease: "smooth" },
  { t: m.STOP_T, v: 0.50, ease: "smooth" },
  { t: m.BUILD_END_T, v: 0.60, ease: "easeIn" },
  { t: m.DURATION, v: 0.60 },
]);
const air: Curve = keyframes([
  { t: 0.0, v: 0.42, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.50, ease: "smooth" },
  { t: m.DROP_T, v: 0.55, ease: "smooth" },
  { t: m.STOP_T, v: 0.45, ease: "smooth" },
  { t: m.DURATION, v: 0.55 },
]);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { beatPunch: { threshold: 0.80, amp: 0.11, floor: 0.5, decay: 4, attack: 1, dir: "in" }, zoom: m.zoom },
  contacts,
  jitter: 0,
  axes: { air, speed },
};
export default spec;
