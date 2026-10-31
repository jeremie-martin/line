/**
 * bench-intense (benchmark stratum P4: an intense dense section at speed).
 *
 * What it lands. Every kick and snare from the re-entry after the break (25.252) to
 * the snare at 36.583: 26 landings in 11.3 s, mostly 0.325–0.348 s apart (runs of 3–7
 * hits) with the groove's own rests of 0.66–1.0 s between runs, at the highest speed
 * of the spec and low air. That stretch is the loudest of the cut (mean mix over
 * 10 s: 0.578, against 0.50 at the start), with the drums leading and the voice
 * quieter. Strength is each hit's measured loudness (kicks 0.60–0.72, snares
 * 0.37–0.40); the re-entry is pinned 0.85.
 *
 * The rest builds towards it and winds down after: two intro words (0.604, 2.264) as
 * light hits, the drums' three-kick entry (3.251–3.924), then the backbeat snares
 * (4.586–15.267), then from 16.591 the snare → kick pairs (music.ts PAIRS), the
 * bass pickup pair into 23.905, the last kick before the break (24.242), the break,
 * and after the window the pairs again to the fill's snare (44.257).
 *
 * Why. P4 tests sustained quick re-landings at speed where the music is at its most
 * intense: every audible hit, nothing added. The rests are the music's; nothing is
 * landed in them because nothing is heard there (hi-hats only, drum rise ≤ 0.05).
 *
 * Left out on purpose:
 *   - outside the window, the run kicks (they are the window's material; leaving them
 *     elsewhere makes the window the spec's peak, as it is the music's);
 *   - the exposed words: this reading follows the drums throughout;
 *   - inside the window, the sung C♯4 at 33.924 (0.011 s after the 33.913 snare: the
 *     same landing) and 35.434 (B3, salience 0.28, a weak word between hits).
 *
 * Window: 25.20–36.65.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BASS_PICKUP, BREAK_LAST, DRUM_HITS, DURATION, ENTRY_CLUSTER, FILL, PAIRS, REENTRY, SNARES, bass, camera, drum,
  landings, music, preroll, start, word,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const W0 = 25.2, W1 = 36.65;
const INTRO_TOUCHES = [0.604, 2.264];
const BACKBEAT = SNARES.filter((t) => t > 4 && t < 16);
const PAIRS_BEFORE = PAIRS.filter(([a]) => a > 16.5 && a < W0).flat();
const PAIRS_AFTER = PAIRS.filter(([a]) => a > W1).flat();
const LONE_SNARES = [20.596, 41.912];
const DENSE = DRUM_HITS.filter((t) => t >= W0 && t <= W1);

const times = landings(INTRO_TOUCHES, ENTRY_CLUSTER, BACKBEAT, PAIRS_BEFORE, LONE_SNARES, [BREAK_LAST], DENSE,
  PAIRS_AFTER, [FILL]);
const strength = (t: number) =>
  t === REENTRY ? 0.85 : t === BASS_PICKUP ? bass(t) : INTRO_TOUCHES.includes(t) ? word(t) : drum(t);

export const bench = {
  stratum: "P4" as const,
  pattern: "every hit of the loudest stretch, at speed",
  windows: [[W0, W1]] as [number, number][],
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
      { t: 3.25, v: 0.72, ease: "smooth" },
      { t: 16.5, v: 0.6, ease: "smooth" },
      { t: BREAK_LAST, v: 0.8, ease: "hold" },
      { t: REENTRY, v: 0.45, ease: "smooth" }, // dense: low arcs
      { t: W1, v: 0.5, ease: "smooth" },
      { t: DURATION, v: 0.6 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.45, ease: "smooth" },
      { t: 3.25, v: 0.7, ease: "smooth" },
      { t: 16.5, v: 0.8, ease: "smooth" },
      { t: BREAK_LAST, v: 0.8, ease: "easeIn" },
      { t: REENTRY, v: 0.95, ease: "hold" }, // the intense stretch: fastest
      { t: W1, v: 0.88, ease: "smooth" },
      { t: DURATION, v: 0.8 },
    ]),
  },
};

export default spec;
