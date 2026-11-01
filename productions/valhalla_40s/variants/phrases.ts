/**
 * Valhalla · phrases. The voice by its phrases until the drop, then the drums.
 *
 *   opening  the held notes of the voice alone (1.46, 4.16, 6.75, 8.58): soft
 *            landings and long, high floats, since the music is calm;
 *   9.32     the lone kick + snare, a clear hit;
 *   phrases  each phrase start and its strongest syllable; the lone kick at 19.69;
 *            a long float over the quiet gap (26.64–29.37), one syllable, then the drop;
 *   drop     the loudest hit;
 *   groove   every kick and every snare: kick→snare pairs 0.31 s apart, then airs.
 * Faster and lower once the drums play. Not landed: the fast word runs (variant
 * words), the bass entries and the voice over the drums (the drums lead).
 */
import type { Contact, Curve, Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";

const near = (layer: number[], t: number) => layer.some((x) => Math.abs(x - t) < 0.03);
export function impactFor(t: number): number {
  if (near([m.DROP_T], t)) return 1.0;
  if (near(m.LONE_HITS, t)) return near([9.32], t) ? 0.55 : 0.45;
  if (t < m.DROP_T) {
    const accent = near(m.ACCENTS, t) ? 0.12 : 0;
    return Number(m.clamp(m.voiceStrength(t) + accent, 0.08, 0.35).toFixed(3));
  }
  return Number(m.clamp(m.drumStrength(t), 0.3, 0.95).toFixed(3));
}

export const times = m.landings(m.OPENING_NOTES, m.LONE_HITS, m.PHRASE_STARTS, m.ACCENTS, m.KICKS, m.SNARES);

export const speed: Curve = keyframes([
  { t: 0.0, v: 0.34, ease: "smooth" },
  { t: m.PHRASES_T, v: 0.44, ease: "smooth" },
  { t: 26.6, v: 0.56, ease: "smooth" },
  { t: m.DROP_T, v: 0.86, ease: "easeIn" },
  { t: m.DURATION, v: 0.82 },
]);
export const air: Curve = keyframes([
  { t: 0.0, v: 0.80, ease: "smooth" },
  { t: 8.6, v: 0.78, ease: "smooth" },
  { t: m.PHRASES_T, v: 0.56, ease: "smooth" },
  { t: 26.6, v: 0.60, ease: "smooth" },
  { t: 28.0, v: 0.85, ease: "smooth" }, // the float over the quiet gap
  { t: m.DROP_T, v: 0.60, ease: "smooth" },
  { t: m.DURATION, v: 0.58 },
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
