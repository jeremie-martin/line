/**
 * sealed-intense (benchmark stratum P4, SEALED: not compiled until a candidate is
 * adopted). A SUBSTITUTE: the P4 sibling was planned on amor_na_praia_46s, but that
 * song has no dense stretch (its loudest music is one 808 kick every 0.55 s with
 * nothing audible in between; see amor_na_praia_46s/music.ts). This one uses the
 * Amour cut's other intense stretch, the hook, which bench-intense reads sparsely.
 *
 * What it lands. Every kick and snare from 13.920 to 24.242 (the hook: the voice at
 * its busiest, mean mix 0.56, the second-loudest 10 s of the cut after 25–36 s),
 * plus the two sounds that sit in its rests and are plainly heard alone: the word
 * 15.604 (C♯4, salience 0.96; 0.337 s after a snare, 0.313 s before a kick) and the
 * bass pickup 23.591 in the 23.4 s drop-out. 25 landings in 10.3 s, 18 of the 24
 * gaps 0.31–0.35 s, the rest the groove's own rests (0.66–1.0 s), at the spec's
 * highest speed and low air; strength is measured loudness.
 *
 * Around it: all six intro words into the drums' three-kick entry; then the backbeat
 * snares and the words alone in the rests (4.795, 10.275) as a light build; after the
 * break (a float over the held word, re-entry 25.252 pinned 0.85) the snare → kick
 * pairs to the fill's snare (44.257).
 *
 * Left out on purpose:
 *   - inside the window, 23.766 (a word 0.175 s after the bass pickup and 0.139 s
 *     before the kick) and the flam's second stroke 17.926 (0.058 s after 17.868);
 *   - before the window, the run kicks (the window is the spec's peak);
 *   - after the break, the run kicks (bench-intense's material).
 *
 * Window: 13.87–24.30.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BASS_PICKUP, BREAK_LAST, DRUM_HITS, DURATION, ENTRY_CLUSTER, FILL, INTRO_WORDS, PAIRS, REENTRY, SNARES, bass,
  camera, drum, landings, music, preroll, start, word,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const W0 = 13.87, W1 = 24.3;
const BUILD = [...SNARES.filter((t) => t > 4 && t < 13), 4.795, 10.275];
const DENSE = [...DRUM_HITS.filter((t) => t >= W0 && t <= W1), 15.604, BASS_PICKUP];
const AFTER = [...PAIRS.filter(([a]) => a > 25).flat(), 25.925, 31.254, 36.583, 41.912, FILL];
const WORDS = [...INTRO_WORDS, 4.795, 10.275, 15.604];

const times = landings(INTRO_WORDS, ENTRY_CLUSTER, BUILD, DENSE, [REENTRY], AFTER);
const strength = (t: number) =>
  t === REENTRY ? 0.85 : t === BASS_PICKUP ? bass(t) : WORDS.includes(t) ? word(t) : drum(t);

export const bench = {
  stratum: "P4" as const,
  pattern: "every hit of the hook, at speed",
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
      { t: 0, v: 0.6, ease: "smooth" },
      { t: 3.25, v: 0.72, ease: "smooth" },
      { t: W0, v: 0.45, ease: "smooth" }, // dense: low arcs
      { t: BREAK_LAST, v: 0.82, ease: "hold" },
      { t: REENTRY, v: 0.58, ease: "smooth" },
      { t: DURATION, v: 0.6 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.48, ease: "smooth" },
      { t: 3.25, v: 0.74, ease: "smooth" },
      { t: W0, v: 0.95, ease: "hold" }, // the hook: fastest
      { t: BREAK_LAST, v: 0.8, ease: "smooth" },
      { t: REENTRY, v: 0.86, ease: "smooth" },
      { t: DURATION, v: 0.8 },
    ]),
  },
};

export default spec;
