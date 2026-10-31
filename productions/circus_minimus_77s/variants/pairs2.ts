/**
 * Circus Minimus · pairs2. pairs (owner: "infinitely better", much more aligned), with
 * two readings corrected by the owner (2026-10-31):
 *   intro  is not calm: the 808 is strong from the first second. Land every 808 hit
 *          (3-2-3 from 1.26), firmly, with airs between them, at a real speed;
 *   38–51  is not a soft vocal hook but the most intense part of the song: land the 808,
 *          the snares, the synth pickups and the voice's phrase starts, fast and firm.
 * Everything else as pairs; snares a little firmer throughout.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import pairs from "./pairs.ts";
import { impactFor } from "./groove.ts";

const near = (layer: number[], t: number) => layer.some((x) => Math.abs(x - t) < 0.03);
const SNARES = [...m.VERSE_SNARES, ...m.GROOVE_SNARES, ...m.HOOK_SNARES, ...m.OUTRO_SNARES];
const PICKUPS = [...m.VERSE_PICKUPS, ...m.GROOVE_PICKUPS, ...m.HOOK_SYNTH_PICKUPS, ...m.OUTRO_PICKUPS];
const bass = (t: number) => m.event(t).sources.bass?.peak ?? 0;

export function intense(t: number): number {
  if (t < m.VERSE_T) return Number(m.clamp(0.3 + 0.5 * Math.max(m.drumPeak(t), 0.7 * bass(t)), 0.5, 0.75).toFixed(3));
  if (near(PICKUPS, t)) return Number(m.clamp(m.drumStrength(t), 0.25, 0.45).toFixed(3));
  if (near(SNARES, t)) return Number(m.clamp(m.drumStrength(t) + 0.08, 0.35, 0.55).toFixed(3));
  if (t >= m.HOOK_T && t < m.BREAK_T) {
    if (near(m.HOOK_BASS, t)) return Number(m.clamp(0.35 + 0.5 * bass(t), 0.55, 0.85).toFixed(3));
    if (near(m.HOOK_PHRASES, t)) return 0.4;
  }
  return impactFor(t);
}

export const times = m.landings(
  pairs.contacts.map((c) => c.t).filter((t) => !(t >= m.HOOK_T - 0.4 && t < m.BREAK_T) && t >= m.VERSE_T),
  m.INTRO_KICKS,
  m.HOOK_BASS, m.HOOK_SNARES, m.HOOK_SYNTH_PICKUPS, [38.15, 48.30],
);

export const speed = keyframes([
  { t: 0.0, v: 0.55, ease: "smooth" },
  { t: m.VERSE_T, v: 0.58, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.66, ease: "smooth" },
  { t: m.HOOK_T, v: 0.80, ease: "easeIn" },
  { t: m.BREAK_T, v: 0.78, ease: "smooth" },
  { t: m.REENTRY_T, v: 0.86, ease: "easeIn" },
  { t: m.DURATION, v: 0.88 },
]);
export const air = keyframes([
  { t: 0.0, v: 0.66, ease: "smooth" },
  { t: m.VERSE_T, v: 0.60, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.52, ease: "smooth" },
  { t: m.HOOK_T, v: 0.50, ease: "smooth" },
  { t: 49.5, v: 0.55, ease: "smooth" },
  { t: 50.4, v: 0.86, ease: "smooth" }, // the float over the break
  { t: m.REENTRY_T, v: 0.55, ease: "smooth" },
  { t: m.DURATION, v: 0.52 },
]);

export const overlayMeta = m.overlayMeta;
const spec: Spec = { ...pairs, contacts: beats(times.map((t) => ({ t, impact: intense(t) }))), axes: { air, speed } };
export default spec;
