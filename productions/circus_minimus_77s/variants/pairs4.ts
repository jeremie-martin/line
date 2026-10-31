/**
 * Circus Minimus · pairs4. pairs3, after the owner's round-3 notes (2026-10-31):
 *   38–49   the voice alone: every clear sung note (tools/music/sung.py, salience ≥ 0.15), no
 *           bass hits in between, so the ride follows the sharp words consistently;
 *   overall every hit bigger (about +0.12), the song being heavy throughout; the pinned
 *           moments (section entries, re-entry, last hit) and the small ghosts unchanged.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import pairs3 from "./pairs3.ts";

const near = (layer: number[], t: number, r = 0.03) => layer.some((x) => Math.abs(x - t) < r);
const HOOK_START = 38.0;
const PINNED = [12.86, 25.68, m.REENTRY_T, m.LAST_HIT];
const GHOSTS = [16.48, 19.68, 22.87, 26.08, 29.28, 32.48, 35.68];
// The hook's sung notes, at least 0.2 s apart (the more salient of a closer pair kept).
const HOOK_WORDS = m.sungNotes(0.15).filter((t) => t >= HOOK_START && t < m.BREAK_T + 0.05)
  .filter((t, i, all) => i === 0 || t - all[i - 1] >= 0.2);

function impact(t: number, before: number): number {
  if (t >= HOOK_START && t < m.BREAK_T + 0.05) {
    if (Math.abs(t - 38.48) < 0.03) return 0.8; // the section's first word, on its downbeat
    return Number(m.clamp(0.42 + 0.6 * m.voiceStrength(t), 0.42, 0.7).toFixed(3));
  }
  if (near(PINNED, t) || near(GHOSTS, t)) return before;
  return Number(m.clamp(before + 0.12, 0.3, 0.9).toFixed(3));
}

const outside = pairs3.contacts.filter((c) => c.t < HOOK_START || c.t >= m.BREAK_T + 0.05);
const contacts = m.landings(outside.map((c) => c.t), HOOK_WORDS).map((t) => {
  const was = outside.find((c) => Math.abs(c.t - t) < 0.03);
  return { t, impact: impact(t, was?.impact ?? 0) };
});

export const overlayMeta = m.overlayMeta;
const spec: Spec = { ...pairs3, contacts: beats(contacts) };
export default spec;
