/**
 * bench-pairs (benchmark stratum P1: short audible pairs at speed).
 *
 * What it lands. The groove read as its pairs: on every backbeat snare, the snare
 * and the kick right after it ("TAK-BOOM", 0.31–0.35 s); where a sung word or a bass
 * note takes the pickup slot, that sound and its kick ("ta-BOOM", 0.30–0.31 s); and
 * the snare → word at 4.586 → 4.795 (0.209 s). 24 pairs (music.ts PAIRS), each a
 * lighter hit then a heavier one, both at measured loudness, at high speed. The drums
 * enter as a three-kick cluster (3.251, 3.587, 3.924), landed whole. Around the pairs:
 * the two salient intro words (0.604, 2.264) as light hits, a backbeat snare where no
 * kick follows it within 0.35 s (20.596, 25.925, 31.254, 36.583, 41.912), the last kick
 * before the break (24.242), the re-entry (25.252, pinned 0.85) and the fill's snare
 * (44.257).
 *
 * Why. Seen as an upper hit then a bottom hit, a pair reads as two beats. The owner
 * named these the strongest moments, and the compiler's weakest: quick re-landings
 * at speed. Here they occur every 1.3 s for 40 s, from the music itself.
 *
 * Left out on purpose:
 *   - the run kicks after each pair (e.g. 3.924's runs, 5.236, 5.584, 8.255, 9.253,
 *     13.247, 13.572, 14.582 …): audible and strong, but landing them turns pairs into
 *     runs (that is bench-intense); leaving them gives each pair room (0.66–1.3 s)
 *     before the next one;
 *   - snares directly before a word or bass pickup (9.915, 15.267, 23.255): the pickup
 *     starts the pair instead;
 *   - the other intro words (1.625–3.053): this spec floats the intro into the drums;
 *   - the exposed word 23.766 (0.139 s before the 23.905 kick) and the break's held
 *     word 24.300 (0.058 s after the 24.242 kick).
 *
 * Windows: each pair and the entry cluster, ±0.05 s.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BASS_PICKUP, BREAK_LAST, BREAK_START, DRUMS_IN, DURATION, ENTRY_CLUSTER, EXPOSED_WORDS, FILL, PAIRS, REENTRY,
  bass, camera, drum, landings, music, preroll, start, word,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const INTRO_TOUCHES = [0.604, 2.264];
const LONE_SNARES = [20.596, 25.925, 31.254, 36.583, 41.912];
const WORDS = [...INTRO_TOUCHES, ...EXPOSED_WORDS];

const times = landings(INTRO_TOUCHES, ENTRY_CLUSTER, PAIRS.flat(), LONE_SNARES, [BREAK_LAST, REENTRY, FILL]);
const strength = (t: number) =>
  t === REENTRY ? 0.85 : t === BASS_PICKUP ? bass(t) : WORDS.includes(t) ? word(t) : drum(t);

const pad = (a: number, b: number): [number, number] => [Number((a - 0.05).toFixed(3)), Number((b + 0.05).toFixed(3))];
export const bench = {
  stratum: "P1" as const,
  pattern: "short audible pairs at speed",
  windows: [pad(ENTRY_CLUSTER[0], ENTRY_CLUSTER[2]), ...PAIRS.map(([a, b]) => pad(a, b))],
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
      { t: 0, v: 0.7, ease: "smooth" },
      { t: DRUMS_IN, v: 0.55, ease: "smooth" },
      { t: BREAK_LAST, v: 0.8, ease: "hold" }, // the break
      { t: REENTRY, v: 0.58, ease: "smooth" },
      { t: DURATION, v: 0.55 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.5, ease: "smooth" },
      { t: DRUMS_IN, v: 0.85, ease: "smooth" },
      { t: BREAK_START, v: 0.8, ease: "smooth" },
      { t: REENTRY, v: 0.9, ease: "smooth" },
      { t: DURATION, v: 0.85 },
    ]),
  },
};

export default spec;
