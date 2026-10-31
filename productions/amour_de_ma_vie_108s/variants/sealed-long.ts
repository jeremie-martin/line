/**
 * sealed-long (benchmark stratum P6, SEALED: not compiled until a candidate is
 * adopted). A second whole-song reading of the long cut, different from bench-long
 * in where it is dense and in what it follows in the calm half.
 *
 * What it lands, section by section (music.ts has the structure):
 *   1. INTRO: every word (0.604, 1.625, 1.962, 2.264, 2.868, 3.065) as clear light
 *      hits, running into the drums' three-kick entry (3.251, 3.587, 3.924).
 *   2. GROOVE A, first part (to 16.5 s): the short pairs from the start (snare → kick,
 *      snare → word 4.586 → 4.795, word → kick 10.286 → 10.588 and 15.604 → 15.917).
 *   3. THE HOOK (16.5–24.3, where the voice is busiest): every drum hit, and the bass
 *      pickup (23.591) in the 23.4 s drop-out.
 *   4. BREAK: the held word (24.300) instead of the kick under it, a float, and the
 *      re-entry (25.252) pinned 0.9.
 *   5. GROOVE A after the break (to 43.6): the backbeat snares only, light, long arcs.
 *   6. FILL: its snares and toms; groove B's first kick (46.579) pinned 0.85.
 *   7. GROOVE B and its lift: the pairs (music.ts PAIRS_B, including the word → kick
 *      pickups at 47.601 and 58.259), a lone snare (52.582), then the closing fill
 *      and the drums' last kick (64.935, pinned 0.95).
 *   8. BREAKDOWN: the voice by its words (salience ≥ 0.4) as soft touches: close
 *      where it sings fast (74.257 → 74.675, 87.562 → 87.841), long rides on held
 *      notes (80.271), and the 4.1-s float over the held bass at its start.
 *   9. LIGHT DRUMS: the returning kick (89.234) and the word after it (89.536), the
 *      words 91.788 and 92.973, kicks 93.576, 95.933, 96.908, the swell (94.575,
 *      pinned 0.5).
 *  10. OUTRO: the words 98.360, 98.952, 102.028, 104.861; the fade is ridden out.
 *
 * Left out on purpose:
 *   - outside the hook, the run kicks; after the break, every kick except the
 *     re-entry: this reading makes the hook its dense passage and lets the
 *     loudest stretch ride long;
 *   - 23.766 (0.175 s after the bass pickup, 0.139 s before the kick);
 *   - the fill's 45.256 (a drag 0.174 s after 45.082) and 46.266 (ghost);
 *   - groove B's high notes 60.976, 61.986, 63.936 (each within 0.06 s of a snare or
 *     kick that the pairs land or leave: the voice there rides on the drum hits);
 *   - every bass note (bench-long's reading of the calm half).
 *
 * Window: the whole song.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BASS_PICKUP, BREAK_START, BREAK_WORD, BREAKDOWN_WORDS, DRUMS_OUT, DURATION, ENTRY_CLUSTER, EXPOSED_WORDS_A,
  EXPOSED_WORDS_B, FADE, FILL_END, FILL_START, GROOVE_B, INTRO_WORDS, KICKS_A, LIFT, LIGHT_DRUMS, OUTRO,
  OUTRO_WORDS, PAIRS_A, PAIRS_B, REENTRY, SNARES_A, SWELL, bass, camera, drum, landings, music, preroll, start,
  voiceStrength, word,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const within = (list: number[], a: number, b: number) => list.filter((t) => t >= a && t < b);
const pairsWithin = (list: [number, number][], a: number, b: number) => list.filter(([x]) => x >= a && x < b).flat();

const HOOK0 = 16.5;
const EARLY_PAIRS = pairsWithin(PAIRS_A, 4, HOOK0);
const HOOK = [...within([...KICKS_A, ...SNARES_A], HOOK0, BREAK_START - 0.1).filter((t) => t !== 24.242), BASS_PICKUP];
const BACKBEAT = within(SNARES_A, REENTRY, 44);
const FILL = [44.257, 44.594, 45.082, 45.592, 45.917, GROOVE_B];
const GROOVE_B_PAIRS = [...pairsWithin(PAIRS_B, 47, 64), 52.582];
const LIGHT = [LIGHT_DRUMS, 89.536, 91.788, 92.973, 93.576, SWELL, 95.933, 96.908];

const WORDS = [...INTRO_WORDS, ...EXPOSED_WORDS_A, ...EXPOSED_WORDS_B, BREAK_WORD];
const SOFT_WORDS = [...BREAKDOWN_WORDS, 89.536, 91.788, 92.973, ...OUTRO_WORDS];
const PINNED = new Map<number, number>([[REENTRY, 0.9], [GROOVE_B, 0.85], [DRUMS_OUT, 0.95], [SWELL, 0.5]]);

const times = landings(INTRO_WORDS, ENTRY_CLUSTER, EARLY_PAIRS, HOOK, [BREAK_WORD, REENTRY], BACKBEAT, FILL,
  GROOVE_B_PAIRS, FILL_END, BREAKDOWN_WORDS, LIGHT, OUTRO_WORDS);
const strength = (t: number) =>
  PINNED.get(t) ??
  (WORDS.includes(t) ? word(t) : SOFT_WORDS.includes(t) ? voiceStrength(t) : t === BASS_PICKUP ? bass(t) : drum(t));

export const bench = {
  stratum: "P6" as const,
  pattern: "long ride: a second reading of the whole song",
  windows: [[0, DURATION]] as [number, number][],
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
      { t: 0, v: 0.6, ease: "smooth" },
      { t: 3.25, v: 0.58, ease: "smooth" },
      { t: HOOK0, v: 0.45, ease: "smooth" }, // the hook: dense, low arcs
      { t: BREAK_START, v: 0.85, ease: "hold" },
      { t: REENTRY, v: 0.75, ease: "smooth" }, // backbeat: long arcs
      { t: FILL_START, v: 0.55, ease: "smooth" },
      { t: GROOVE_B, v: 0.58, ease: "smooth" },
      { t: DRUMS_OUT, v: 0.9, ease: "smooth" }, // the calm
      { t: LIGHT_DRUMS, v: 0.8, ease: "smooth" },
      { t: OUTRO, v: 0.88, ease: "smooth" },
      { t: DURATION, v: 0.9 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.5, ease: "smooth" },
      { t: 3.25, v: 0.82, ease: "smooth" },
      { t: HOOK0, v: 0.95, ease: "smooth" },
      { t: BREAK_START, v: 0.8, ease: "smooth" },
      { t: REENTRY, v: 0.85, ease: "smooth" },
      { t: GROOVE_B, v: 0.82, ease: "smooth" },
      { t: LIFT, v: 0.9, ease: "smooth" },
      { t: DRUMS_OUT, v: 0.75, ease: "easeOut" },
      { t: 70, v: 0.38, ease: "smooth" },
      { t: LIGHT_DRUMS, v: 0.48, ease: "smooth" },
      { t: OUTRO, v: 0.4, ease: "smooth" },
      { t: FADE, v: 0.34, ease: "smooth" },
      { t: DURATION, v: 0.3 },
    ]),
  },
};

export default spec;
