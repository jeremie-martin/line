/**
 * Trouble · pulse. As many measured hits as the rider can take: the rhythm-game
 * reading. It also tests how dense the compiler can go.
 *
 *   intro    every syllable of the voice pulse, and the opening crash;
 *   groove   every kick and every pickup 0.22 s before a kick ("ta-DUM");
 *   break    the voice alone, up to the drop;
 *   drop     every heavy kick, snare, bass entry and after-hit;
 *   outro    the voice break, then every kick and the syllables between them.
 * Low air and high speed; pickups and after-hits are light, kicks firm.
 */
import type { Contact, Curve, Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";

const light = new Set([...m.GROOVE_PICKUPS, ...m.DROP_BASS_ENTRIES, ...m.DROP_AFTERHITS]);
const kicks = new Set([...m.GROOVE_KICKS, ...m.DROP_KICKS, ...m.DROP_SNARES, ...m.OUTRO_KICKS]);
const near = (set: Set<number>, t: number) => [...set].some((x) => Math.abs(x - t) < 0.03);
function impactFor(t: number): number {
  if (Math.abs(t - m.DROP_T) < 0.03) return 0.9;
  if (Math.abs(t - m.OPENING_CRASH) < 0.03) return 0.45;
  if (near(light, t)) return 0.15;
  if (near(kicks, t)) return Number(m.clamp(m.drumStrength(t, 0.75), 0.3, 0.75).toFixed(3));
  return Number(m.clamp(m.voiceStrength(t, 0.06, 0.5), 0.05, 0.3).toFixed(3));
}

const times = m.landings([m.OPENING_CRASH], m.INTRO_VOICE, m.GROOVE_KICKS, m.GROOVE_PICKUPS, m.BREAK_VOICE,
  m.DROP_KICKS, m.DROP_SNARES, m.DROP_BASS_ENTRIES, m.DROP_AFTERHITS, m.BREAK2_VOICE, m.OUTRO_KICKS, m.OUTRO_VOICE);
const contacts: Contact[] = beats(times.map((t) => ({ t, impact: impactFor(t) })));

const speed: Curve = keyframes([
  { t: 0.0, v: 0.42, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.66, ease: "smooth" },
  { t: m.DROP_T, v: 0.80, ease: "smooth" },
  { t: m.STOP_T, v: 0.62, ease: "smooth" },
  { t: m.DURATION, v: 0.72 },
]);
const air: Curve = keyframes([
  { t: 0.0, v: 0.35, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.30, ease: "smooth" },
  { t: m.DROP_T, v: 0.35, ease: "smooth" },
  { t: m.STOP_T, v: 0.35, ease: "smooth" },
  { t: m.DURATION, v: 0.30 },
]);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { beatPunch: { threshold: 0.70, amp: 0.10, floor: 0.5, decay: 5, attack: 1, dir: "in" }, zoom: m.zoom },
  contacts,
  axes: { air, speed },
};
export default spec;
