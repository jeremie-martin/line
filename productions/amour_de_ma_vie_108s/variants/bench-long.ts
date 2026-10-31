/**
 * bench-long (benchmark stratum P6: a long ride, the whole song read as a story).
 *
 * What it lands, section by section (music.ts has the structure). The reading grows
 * with the music's loudness, peaks where the song is loudest, and then lets the calm
 * half breathe:
 *   1. INTRO: the two salient words (0.604, 2.264) as light hits, then a float into the
 *      drums' first kick (3.251).
 *   2. GROOVE A, opening (to 16.6 s, the softest part of the groove): the backbeat
 *      snares, and the words sung alone in a rest (10.286, 15.604) as light answers.
 *   3. GROOVE A, build (16.6–24.3, the hook): the snare → kick pairs and the bass
 *      pickup → kick (music.ts PAIRS_A), a lone snare (20.596), the last kick before
 *      the break (24.242).
 *   4. BREAK: a 1-s float over the held word; the re-entry (25.252) pinned 0.9.
 *   5. PEAK (25.25–36.6, the loudest stretch): every kick and snare.
 *   6. EASE (36.6–43.6): back to the pairs.
 *   7. FILL: its snares and toms (44.257, 44.594, 45.082, 45.592, 45.917); groove B's
 *      first kick (46.579) pinned 0.85.
 *   8. GROOVE B (to 57 s): the backbeat again, with the word → kick pickup at 47.601.
 *   9. LIFT (57–64.9, louder, the voice at its highest): every hit, the word alone at
 *      58.259, the closing fill, and the drums' last kick with its cymbal (64.935)
 *      pinned 0.95.
 *  10. BREAKDOWN (65–89, calm): a 4.1-s float over the held bass note to the first
 *      word (68.998), then the bass note on each bar's downbeat (every ~2.65 s) as
 *      soft landings with high floats, and the word that leads into the drums (88.654).
 *  11. LIGHT DRUMS (89–97): the soft kicks, the salient G♯4 (91.788) instead of the
 *      kick under it, and the swell (94.575, pinned 0.5).
 *  12. OUTRO: the bass notes (97.257, 99.950, 102.272) and the last word (104.861);
 *      the fade is ridden out (3.7 s, nothing is heard to land on).
 * Strength is measured loudness throughout; only the re-entry, groove B's entry, the
 * drums' last kick and the swell are pinned.
 *
 * Why. P6 tests a long ride that keeps its shape: sparse and dense passages, quick
 * pairs, a fill, a long calm with floats of 2–4 s, and soft hits at low speed, all in
 * one compile.
 *
 * Left out on purpose:
 *   - the exposed word 4.795 (0.209 s after the 4.586 snare): it would put a sub-0.25 s
 *     pair in the ride's first 5 s, so the long ride would be decided by the P1
 *     pattern before it starts; the quick pairs come later, in the build;
 *   - 23.766 (0.139 s before the 23.905 kick) and the break's held word (0.058 s after
 *     the 24.242 kick);
 *   - outside the peak and lift, the run kicks (leaving them makes the peak the peak);
 *   - the fill's second snare 45.256 (0.174 s after 45.082, a drag) and 46.266 (ghost);
 *   - breakdown words (that is sealed-long's reading), the mid-bar bass notes 74.606
 *     and 85.264, and the light drums' other kicks (90.918, 91.580, 94.238, 96.235,
 *     96.908: under the G♯4, or within 0.35 s of a landed hit);
 *   - 89.536 (a word 0.302 s after the returning kick; this reading lets the drums
 *     return alone).
 *
 * Window: the whole song.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BASS_BARS, BREAK_LAST, BREAK_START, DRUMS_IN, DRUMS_OUT, DURATION, EXPOSED_WORDS_B, FADE, FILL_END, FILL_START,
  GROOVE_B, KICKS_A, KICKS_B, LIFT, LIGHT_DRUMS, OUTRO, OUTRO_BASS, PAIRS_A, PAIRS_B, REENTRY, SNARES_A, SNARES_B,
  SWELL, bass, camera, drum, landings, music, preroll, start, voiceStrength, word,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const within = (list: number[], a: number, b: number) => list.filter((t) => t >= a && t < b);
const pairsWithin = (list: [number, number][], a: number, b: number) => list.filter(([x]) => x >= a && x < b).flat();

const INTRO = [0.604, 2.264];
const OPENING = [...within(SNARES_A, 4, 16.5), 10.286, 15.604];
const BUILD = [...pairsWithin(PAIRS_A, 16.5, 24.3), 20.596, BREAK_LAST];
const PEAK_END = 36.6;
const PEAK = within([...KICKS_A, ...SNARES_A], REENTRY, PEAK_END);
const EASE = [...pairsWithin(PAIRS_A, PEAK_END, 44), 41.924];
const FILL = [44.257, 44.594, 45.082, 45.592, 45.917, GROOVE_B];
const GROOVE_B_OPEN = [...within(SNARES_B, 48, LIFT), ...pairsWithin(PAIRS_B, 47.5, 48)];
const LIFT_HITS = [...within([...KICKS_B, ...SNARES_B], 56.9, 64), EXPOSED_WORDS_B[1], ...FILL_END];
const BREAKDOWN_HITS = [68.998, ...BASS_BARS, 88.654];
const LIGHT = [LIGHT_DRUMS, 90.581, 91.788, 92.915, 93.576, SWELL, 95.933];
const END = [...OUTRO_BASS, 104.861];

const WORDS = [...INTRO, 10.286, 15.604, 47.601, 58.259, 91.788];
const SOFT_WORDS = [68.998, 88.654, 104.861];
const BASS_NOTES = [...BASS_BARS, ...OUTRO_BASS, 23.591];
const PINNED = new Map<number, number>([[REENTRY, 0.9], [GROOVE_B, 0.85], [DRUMS_OUT, 0.95], [SWELL, 0.5]]);

const times = landings(INTRO, [DRUMS_IN], OPENING, BUILD, [REENTRY], PEAK, EASE, FILL, GROOVE_B_OPEN, LIFT_HITS,
  BREAKDOWN_HITS, LIGHT, END);
const strength = (t: number) =>
  PINNED.get(t) ??
  (WORDS.includes(t) ? word(t) : SOFT_WORDS.includes(t) ? voiceStrength(t) : BASS_NOTES.includes(t) ? bass(t) : drum(t));

export const bench = {
  stratum: "P6" as const,
  pattern: "long ride: the whole song as a story",
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
      { t: 0, v: 0.72, ease: "smooth" },
      { t: DRUMS_IN, v: 0.72, ease: "smooth" },
      { t: 16.5, v: 0.62, ease: "smooth" },
      { t: BREAK_LAST, v: 0.85, ease: "hold" },
      { t: REENTRY, v: 0.45, ease: "smooth" }, // the peak: low arcs
      { t: PEAK_END, v: 0.58, ease: "smooth" },
      { t: FILL_START, v: 0.6, ease: "smooth" },
      { t: GROOVE_B, v: 0.7, ease: "smooth" },
      { t: LIFT, v: 0.5, ease: "smooth" },
      { t: DRUMS_OUT, v: 0.92, ease: "smooth" }, // the calm: high floats
      { t: LIGHT_DRUMS, v: 0.8, ease: "smooth" },
      { t: OUTRO, v: 0.9, ease: "smooth" },
      { t: DURATION, v: 0.9 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.45, ease: "smooth" },
      { t: DRUMS_IN, v: 0.72, ease: "smooth" },
      { t: 16.5, v: 0.8, ease: "smooth" },
      { t: BREAK_START, v: 0.78, ease: "easeIn" },
      { t: REENTRY, v: 0.95, ease: "smooth" },
      { t: PEAK_END, v: 0.86, ease: "smooth" },
      { t: GROOVE_B, v: 0.8, ease: "smooth" },
      { t: LIFT, v: 0.92, ease: "smooth" },
      { t: DRUMS_OUT, v: 0.8, ease: "easeOut" },
      { t: 70, v: 0.4, ease: "smooth" },
      { t: LIGHT_DRUMS, v: 0.5, ease: "smooth" },
      { t: OUTRO, v: 0.42, ease: "smooth" },
      { t: FADE, v: 0.35, ease: "smooth" },
      { t: DURATION, v: 0.32 },
    ]),
  },
};

export default spec;
