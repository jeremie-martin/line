/**
 * Luna Bala, bench-words (stratum P2: voice-led close words).
 *
 * Lands: every sung word of the voice-only intro (WORDS, 16 notes from
 * sung.json, 0.174–8.069), as clear light hits (0.21–0.35 by how sharply each
 * word enters). The voice is the only sound there, so it leads. The words come
 * 0.17–0.58 s apart: close at 4.493–5.387 (0.17, 0.41, 0.31) and at the start
 * (0.174–0.441, 0.27), otherwise a word every half second. This is a legato
 * voice: 4 of its 15 word gaps are ≤ 0.45 s, so it tests word-following more than
 * fast words (Tiki's sealed-words has the fast runs). 3.216 → 4.493 rides
 * across the one-second stop; air stays moderate on the other words so the rider
 * stays near the line between them (long low rides, not floats).
 *
 * Then the drop (8.615, pinned 1.0) and the drums by their pulse: every on-beat
 * kick (KICKS), the bar downbeat a step up (it carries a snare layer and the
 * vocal "hey"). The tom break (23.87–26.05) is read as kicks like the body.
 *
 * Deliberately left out:
 * - the fill off-beats (12.701, 21.420, 30.140, 38.859) and the body off-beats:
 *   they are the P1/P4 specs' patterns, kept out so that a failure here is a
 *   words failure;
 * - the vocal "hey" (G4) in the body: it falls on the downbeat kick, which is
 *   landed; the voice does not lead after the drop (vocals 0.05–0.15 against
 *   drums 0.86), so syllables there would read off the music;
 * - the first word's note event 0.081 (before the 0.13 s first-landing floor;
 *   its loudness arrives at 0.174, which is landed).
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  DROP, DURATION, KICKS, LAST_KICK, REENTRY, WORDS, BREAK_IN,
  kf, kickStrength, landings, music, overlayMeta, wordStrength, zoom,
} from "../music.ts";

const body = KICKS.filter((t) => t > DROP);
const times = landings(WORDS, [DROP], body);
const strength = (t: number) =>
  t === DROP ? 1.0 : WORDS.includes(t) ? wordStrength(t) : kickStrength(t, 0.5, 0.18);

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.66, amp: 0.12, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: { smoothingFrames: 8, keyframes: zoom },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  jitter: 0,
  axes: {
    air: keyframes(kf([
      [0.0, 0.5], [3.0, 0.5], [3.4, 0.78], [4.3, 0.78], [4.6, 0.48], [7.8, 0.55],
      [DROP, 0.7], [BREAK_IN, 0.68], [REENTRY, 0.7], [LAST_KICK, 0.75], [DURATION, 0.85],
    ])),
    speed: keyframes(kf([
      [0.0, 0.42], [4.5, 0.46], [7.6, 0.56], [DROP, 0.72], [16.0, 0.76], [BREAK_IN, 0.74],
      [REENTRY, 0.78], [40.0, 0.76], [LAST_KICK, 0.6], [DURATION, 0.5],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P2" as const,
  pattern: "voice-led close words",
  windows: [[0.12, 8.12]] as Array<[number, number]>,
};
