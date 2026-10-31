/**
 * bench-words (benchmark stratum P2: voice-led close words). A THIN instance of
 * the pattern: this cut has voice-led close words only in its 3-second intro.
 *
 * What it lands. The voice wherever it leads, as clear light hits (0.2–0.35 from the
 * vocal rise):
 *   - the intro, where the voice is alone: every pitched word, A3 0.604, then the fast
 *     run E4 1.625, D4 1.962, D4 2.264, D4 2.856, D4 3.053 (gaps 0.34, 0.30, 0.59,
 *     0.20), running 0.198 s later into the drums' first kick (3.251);
 *   - the four words sung alone in a drum rest: 4.795, 10.275, 15.604, 23.766, each a
 *     response to the backbeat snare before it (0.21–0.51 s earlier).
 * Elsewhere the drums are about twice as loud as the voice, so the groove is read by
 * its backbeat: every snare (beats 1 and 3, 1.33 s apart) at its measured loudness,
 * the last kick before the break (24.242, where the held word starts), the re-entry
 * (25.252, pinned 0.85) and the fill's snare (44.257).
 *
 * Why. P2 tests light, clear word hits at close spacing where the voice is the music.
 * The intro run is the real thing; the exposed words add four single words at speed.
 *
 * Left out on purpose:
 *   - words sung on a drum hit (most of them: 7.326, 8.638, 11.320, 16.974, 18.971,
 *     33.924, 40.519 …): there the drum hit is the louder sound, and the reading of
 *     the groove is by the backbeat;
 *   - the hook's held G4 (19.4, 2.88 s): it is held under the drums, which keep
 *     playing; a ride over it would ignore the louder layer;
 *   - all kicks except 3.251, 24.242 and 25.252: this spec reads the groove by its
 *     backbeat, so the words stand out (the runs belong to bench-intense);
 *   - the break's later vocal onsets (24.706, 24.950: the held word's tail).
 *
 * Windows: the intro words, and each exposed word ±0.05 s. Report: P2 is thin here
 * (10 word landings); a song whose voice leads for longer would test it better.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BREAK_LAST, BREAK_START, DRUMS_IN, DURATION, EXPOSED_WORDS, FILL, INTRO_WORDS, REENTRY, SNARES, camera, drum,
  landings, music, preroll, start, word,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const WORDS = [...INTRO_WORDS, ...EXPOSED_WORDS];
const times = landings(WORDS, SNARES, [DRUMS_IN, BREAK_LAST, REENTRY, FILL]);
const strength = (t: number) => (t === REENTRY ? 0.85 : WORDS.includes(t) ? word(t) : drum(t));

export const bench = {
  stratum: "P2" as const,
  pattern: "voice-led close words",
  windows: [
    [0.55, 3.1] as [number, number],
    ...EXPOSED_WORDS.map((t): [number, number] => [Number((t - 0.05).toFixed(3)), Number((t + 0.05).toFixed(3))]),
  ],
};

const spec: Spec = {
  duration: DURATION,
  music,
  camera,
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  start,
  preroll,
  axes: {
    air: keyframes([
      { t: 0, v: 0.6, ease: "smooth" }, // fast words: low arcs
      { t: DRUMS_IN, v: 0.72, ease: "smooth" },
      { t: BREAK_LAST, v: 0.85, ease: "hold" }, // ride the held word
      { t: REENTRY, v: 0.72, ease: "smooth" },
      { t: DURATION, v: 0.7 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.45, ease: "smooth" },
      { t: DRUMS_IN, v: 0.75, ease: "smooth" },
      { t: BREAK_START, v: 0.7, ease: "smooth" },
      { t: REENTRY, v: 0.82, ease: "smooth" },
      { t: DURATION, v: 0.78 },
    ]),
  },
};

export default spec;
