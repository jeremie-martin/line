/**
 * Tiki Tiki, bench-pairs (stratum P1: short audible pairs at speed).
 *
 * Lands the song's signature figure, the pickup snare 0.209–0.221 s before each
 * bar's downbeat kick ("ta-BOOM"), all seven times it occurs: 11.122/11.343,
 * 14.605/14.826, 18.088/18.297, 21.560/21.780 in the groove and
 * 28.514/28.735, 31.997/32.218, 35.468/35.689 in the run. Both sounds are clear:
 * the snare (drums 0.27–0.29, mix rise 0.21–0.31) falls in a gap where the mix
 * sits at 0.24–0.30, and the downbeat kick is the loudest hit of the bar. The
 * pickup lands as a lighter upper hit (0.38–0.41, from its loudness), the
 * downbeat as the bar's heaviest (0.78–0.80), at the groove's full speed.
 *
 * Around the pairs: every kick at the 0.87 s pulse (the drop 10.472 and the
 * re-entry 27.864 pinned), the vocal hooks and the chord stab that fill the slot
 * after beat 3 (13.526, 20.480, 30.917, 37.872), and the voice by phrases in the
 * intro, the reset and the outro.
 *
 * Deliberately left out:
 * - the backbeat snares (0.43 s after a kick): as loud as the pickups, but landing
 *   them would make the whole groove a 0.43 s run and bury the pairs, which are
 *   the pattern;
 * - the E4 syllable 0.21 s before some pickups (14.396, 17.868, 35.260) and the
 *   vocal pickups 0.19–0.20 s before beat 3 (12.875, 16.358, 30.279, 33.762):
 *   with them a pair becomes a 3-hit run, or a pair under 0.2 s; the voice is under
 *   the drums there;
 * - the hook-motif runs (3.32–4.42, 45.01–46.10) are read by every other word, and
 *   the reset by two of its murmurs, so this spec's difficulty stays in the pairs.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BOOM, DROP, DURATION, HOOKS, KICKS, LAST_DRUM, PAIRS, PICKUPS, REENTRY, STAB,
  kf, kickStrength, landings, music, overlayMeta, snareStrength, wordStrength, zoom,
} from "../music.ts";

const VOICE = [
  0.406, 1.277, 1.846, 2.705, 3.32, 3.855, 4.423, // intro by phrases (every other hook word)
  7.001, 7.872, 9.102, 9.961, // build and cut
  26.482, 27.04, // reset murmurs
  42.655, 43.003, 43.537, 44.408, 45.012, 45.534, 46.103, // outro by phrases
];
const PINNED: Record<string, number> = { [DROP]: 1.0, [REENTRY]: 0.95, [BOOM]: 0.6 };

const times = landings(VOICE, KICKS, PICKUPS, HOOKS, [STAB, BOOM]);
const strength = (t: number) => {
  if (PINNED[t] !== undefined) return PINNED[t];
  if (VOICE.includes(t) || HOOKS.includes(t)) return wordStrength(t);
  if (PICKUPS.includes(t)) return snareStrength(t);
  if (t === STAB) return 0.4;
  return kickStrength(t);
};

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.75, amp: 0.13, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: { smoothingFrames: 8, keyframes: zoom },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  axes: {
    air: keyframes(kf([
      [0.0, 0.62], [4.5, 0.8], [6.9, 0.66], [9.9, 0.6], [DROP, 0.62], [23.6, 0.62],
      [BOOM, 0.85], [27.0, 0.75], [REENTRY, 0.62], [LAST_DRUM, 0.66], [42.5, 0.7], [DURATION, 0.8],
    ])),
    speed: keyframes(kf([
      [0.0, 0.38], [6.9, 0.42], [9.9, 0.6], [DROP, 0.86], [23.6, 0.88], [BOOM, 0.62],
      [26.8, 0.66], [REENTRY, 0.9], [38.4, 0.88], [LAST_DRUM, 0.66], [43.0, 0.46], [DURATION, 0.4],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P1" as const,
  pattern: "pickup snare to downbeat kick (ta-BOOM)",
  windows: PAIRS.map(([p, k]) => [Number((p - 0.05).toFixed(3)), Number((k + 0.05).toFixed(3))]) as Array<[number, number]>,
};
