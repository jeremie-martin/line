/**
 * Circus Minimus · groove. Follows whatever leads each section, building up to the end.
 *
 *   intro    the bar starts of the 808 alone (3.29, 6.48, 9.68): long high floats,
 *            since the music is calm;
 *   verse    the 808's 3-2-3 kicks (BOOM . . BOOM . BOOM . .), downbeats firmer;
 *   groove   the kicks and the snare backbeat (BOOM . TAK BOOM . BOOM TAK .);
 *   hook     the voice leads: its phrase starts on the bars and its strongest syllables,
 *            with long low rides on the legato line;
 *   break    a float over voice and synth alone (49.73–51.28);
 *   re-entry the bass returns: the hardest hit;
 *   full     downbeats, kicks and snares, the rising vocal run at 68.08–68.93 as close
 *            light hits (the high point), and the last hit at 76.88.
 * Strength: the 808 by its loudness (kick drum and bass swell), downbeats firmer; snares
 * by the drum stem; the voice gentle. Not landed: the beat-1 ghost hits, single hats,
 * the pickups (variant pairs), the voice under the drums except the 68 s run.
 */
import type { Contact, Curve, Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";

const near = (layer: number[], t: number) => layer.some((x) => Math.abs(x - t) < 0.03);
const bass = (t: number) => m.event(t).sources.bass?.peak ?? 0;
/** The 808: a kick drum fused with a bass swell. */
const boom = (t: number) => m.clamp(0.25 + 0.6 * Math.max(m.drumPeak(t), 0.7 * bass(t)), 0.35, 0.8);
export const BARS = [...m.INTRO_BARS, ...m.VERSE_BARS, ...m.GROOVE_BARS, ...m.HOOK_BARS, ...m.OUTRO_BARS];
export const VOCAL_RUN = [68.08, 68.93]; // 68.66 is 0.17 s after the 68.49 kick: too close
const HOOK_VOICE = [38.15, 40.14, 44.12, 46.53, 48.30];

/** Structural moments, pinned: each section's entry and the last hit. */
const PINNED: [number, number][] = [[12.86, 0.7], [25.68, 0.75], [38.48, 0.8], [m.REENTRY_T, 1.0], [m.LAST_HIT, 0.9]];

export function impactFor(t: number): number {
  const pin = PINNED.find(([x]) => Math.abs(x - t) < 0.03);
  if (pin) return pin[1];
  if (near(VOCAL_RUN, t)) return 0.3;
  if (near(m.HOOK_PHRASES, t) || near(HOOK_VOICE, t) || near(m.HOOK_ACCENTS, t)) {
    return Number(m.clamp(m.voiceStrength(t) + (near(BARS, t) ? 0.2 : 0.05), 0.15, 0.45).toFixed(3));
  }
  if (near([...m.VERSE_SNARES, ...m.GROOVE_SNARES, ...m.OUTRO_SNARES], t)) return Number(m.clamp(m.drumStrength(t), 0.3, 0.5).toFixed(3));
  return Number(m.clamp(boom(t) + (near(BARS, t) ? 0.1 : 0), 0.35, 0.85).toFixed(3));
}

export const times = m.landings(
  m.INTRO_BARS,
  m.VERSE_KICKS,
  m.GROOVE_KICKS, m.GROOVE_SNARES,
  m.HOOK_PHRASES, HOOK_VOICE, [38.48],
  m.OUTRO_BARS, m.OUTRO_KICKS, m.OUTRO_SNARES, VOCAL_RUN,
);

export const speed: Curve = keyframes([
  { t: 0.0, v: 0.36, ease: "smooth" },
  { t: m.VERSE_T, v: 0.48, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.62, ease: "smooth" },
  { t: m.HOOK_T, v: 0.58, ease: "smooth" },
  { t: m.BREAK_T, v: 0.60, ease: "smooth" },
  { t: m.REENTRY_T, v: 0.84, ease: "easeIn" },
  { t: m.DURATION, v: 0.86 },
]);
export const air: Curve = keyframes([
  { t: 0.0, v: 0.82, ease: "smooth" },
  { t: 11.5, v: 0.80, ease: "smooth" },
  { t: m.VERSE_T, v: 0.62, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.52, ease: "smooth" },
  { t: m.HOOK_T, v: 0.48, ease: "smooth" }, // long low rides on the legato hook
  { t: 49.5, v: 0.55, ease: "smooth" },
  { t: 50.4, v: 0.88, ease: "smooth" }, // the float over the break
  { t: m.REENTRY_T, v: 0.55, ease: "smooth" },
  { t: m.DURATION, v: 0.52 },
]);

export const overlayMeta = m.overlayMeta;
const contacts: Contact[] = beats(times.map((t) => ({ t, impact: impactFor(t) })));
const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { beatPunch: { threshold: 0.80, amp: 0.13, floor: 0.5, decay: 4, attack: 1, dir: "in" }, zoom: m.zoom },
  contacts,
  axes: { air, speed },
};
export default spec;
