/**
 * Circus Minimus · pairs3. pairs2, after the owner's round-2 notes (2026-10-31):
 *   verse   the snare backbeat lands too (13.66, 15.27, 16.86 …: "important to the music");
 *   ghosts  the soft drum hit on beat 1 of the verse and groove bars (16.48, 19.68 …) as a
 *           small impact: an accidental contact at 16.5 s showed it works;
 *   38–49   the voice leads with sharp, distinct words: land every clear sung note
 *           (tools/music/sung.py, salience ≥ 0.2), firmly, plus the 808's bass hits that
 *           do not fall on a word;
 *   intro   the 808 a little firmer (not maximal: the story still has to build);
 *   end     the full groove firmer: it is the heaviest part of the song.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import pairs2, { intense, times as pairs2Times } from "./pairs2.ts";

const near = (layer: number[], t: number, r = 0.03) => layer.some((x) => Math.abs(x - t) < r);
const GHOSTS = [16.48, 19.68, 22.87, 26.08, 29.28, 32.48, 35.68];
const HOOK_START = 38.0;
const HOOK_WORDS = m.sungNotes(0.2).filter((t) => t >= HOOK_START && t < m.BREAK_T + 0.05);
const HOOK_BOOMS = m.HOOK_BASS.filter((t) => !near(HOOK_WORDS, t, 0.12)); // a boom on a word shares its landing

function impact(t: number): number {
  if (near(GHOSTS, t)) return 0.15;
  if (t >= HOOK_START && t < m.BREAK_T + 0.05) {
    if (near(HOOK_BOOMS, t)) return Number(m.clamp(intense(t) + 0.05, 0.6, 0.85).toFixed(3));
    const boomUnder = near(m.HOOK_BASS, t, 0.08);
    return Number(m.clamp(0.3 + 0.5 * m.voiceStrength(t) + (boomUnder ? 0.2 : 0), 0.35, 0.7).toFixed(3));
  }
  const base = intense(t);
  if (t < m.VERSE_T) return Number(m.clamp(base + 0.08, 0.55, 0.8).toFixed(3));
  if (t > m.REENTRY_T + 0.05 && t < m.LAST_HIT - 0.05) return Number(m.clamp(base + 0.08, 0.2, 0.85).toFixed(3));
  return base;
}

const times = m.landings(
  pairs2Times.filter((t) => t < HOOK_START || t >= m.BREAK_T + 0.05),
  m.VERSE_SNARES, GHOSTS, HOOK_WORDS, HOOK_BOOMS,
);

export const overlayMeta = m.overlayMeta;
const spec: Spec = { ...pairs2, contacts: beats(times.map((t) => ({ t, impact: impact(t) }))) };
export default spec;
