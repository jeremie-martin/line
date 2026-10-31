/**
 * Tiki Tiki, bench-words (stratum P2: voice-led close words, long rides on held
 * notes). A bench spec (swapped with Luna's, whose legato voice has few close words).
 *
 * The voice leads wherever the drums are absent, and there it is followed word by
 * word (sung.json notes, clear light hits 0.19–0.37 by how sharply each enters):
 * - the intro: five words (0.406–2.705, a held C5 at 1.277), then the F♯4 hook
 *   motif, five words 0.26–0.30 s apart (3.320–4.423);
 * - the build and the drum cut: 7.001 7.372 7.872 8.243 9.102, 9.660 9.961;
 * - the reset: three murmured syllables 0.24–0.31 s apart (26.482 26.796 27.040)
 *   after the boom has decayed;
 * - the outro: 42.655, a held C5 43.003, A♯4 43.537, 44.408, then the hook motif
 *   again, 0.23–0.30 s apart (45.012–46.103).
 * Air is low on the words so the rider rides close to the line between them, and
 * rises on the held notes and the silence.
 *
 * Under the drums the drums lead: every kick (drop and re-entry pinned), plus the
 * three G5 vocal hooks that stand out of the groove (13.526, 30.917, 37.872;
 * vocals 0.25–0.46, mix rise 0.20–0.39).
 *
 * Deliberately left out: snares and pickups (other strata); the other vocal
 * fragments under the drums (12.875, 16.184, 16.358, 30.279, 33.762 and the E4
 * syllables), which fall 0.19–0.21 s before a drum hit and would read off the
 * music under the kick; the faint intro tail 4.853 (vocals 0.08) and the faint
 * outro note 46.916 (mix 0.09).
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BOOM, BUILD_WORDS, CUT_WORDS, DROP, DURATION, HOOKS, INTRO_RUN, INTRO_WORDS, KICKS, LAST_DRUM,
  OUTRO_RUN, OUTRO_WORDS, REENTRY, RESET_WORDS, SILENCE_T0,
  kf, kickStrength, landings, music, overlayMeta, wordStrength, zoom,
} from "../music.ts";

const WORDS = [...INTRO_WORDS, ...INTRO_RUN, ...BUILD_WORDS, ...CUT_WORDS, ...RESET_WORDS, ...OUTRO_WORDS, ...OUTRO_RUN];
const PINNED: Record<string, number> = { [DROP]: 1.0, [REENTRY]: 0.95, [BOOM]: 0.55 };

const times = landings(WORDS, KICKS, HOOKS, [BOOM]);
const strength = (t: number) =>
  PINNED[t] ?? (WORDS.includes(t) || HOOKS.includes(t) ? wordStrength(t) : kickStrength(t, 0.56, 0.2));

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.75, amp: 0.12, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: { smoothingFrames: 8, keyframes: zoom },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  jitter: 0,
  axes: {
    air: keyframes(kf([
      [0.0, 0.5], [1.2, 0.62], [2.0, 0.5], [3.2, 0.42], [4.5, 0.6], [SILENCE_T0, 0.85], [6.9, 0.55],
      [9.9, 0.5], [DROP, 0.66], [23.6, 0.66], [BOOM, 0.85], [26.4, 0.5], [27.1, 0.5], [REENTRY, 0.66],
      [LAST_DRUM, 0.66], [42.6, 0.5], [43.0, 0.62], [44.6, 0.55], [45.0, 0.42], [46.2, 0.6], [DURATION, 0.75],
    ])),
    speed: keyframes(kf([
      [0.0, 0.42], [SILENCE_T0, 0.38], [6.9, 0.44], [9.9, 0.6], [DROP, 0.8], [23.6, 0.8], [BOOM, 0.6],
      [26.4, 0.5], [REENTRY, 0.84], [38.4, 0.82], [LAST_DRUM, 0.6], [42.6, 0.46], [DURATION, 0.4],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P2" as const,
  pattern: "voice-led close words",
  windows: [[0.35, 4.48], [6.95, 10.0], [26.43, 27.09], [42.6, 46.15]] as Array<[number, number]>,
};
