/**
 * Tiki Tiki, sealed-restart (stratum P5: breaks, drops and re-entries). SEALED:
 * frozen for confirmation; do not compile it during development.
 *
 * Tiki stops and restarts four times; each stop is ridden and each re-entry
 * pinned (strength set by its role):
 * - the silence: the last intro word 4.423, a 2.58 s ride over two seconds of
 *   near-silence (mix 0.04–0.06), and the return of sound at 7.001 (a faint drum
 *   tick with the voice), pinned 0.3;
 * - the drum cut: the swell stops dead at 9.6; the first note after it (9.660,
 *   pinned 0.3) and 9.961, then the drop 10.472 (pinned 1.0);
 * - the reset: the last groove kick 23.510, the 808 boom 24.381 (pinned 0.75)
 *   and its decay, one murmured syllable in the quiet (26.482, 0.12), and the
 *   re-entry 27.864 (pinned 1.0);
 * - the run end: the bar breaks on the weak snare 39.172 where a downbeat should
 *   be (pinned 0.3, a stumble), three kicks off the old grid (39.602, 40.472,
 *   40.902), and the last, soft kick 41.784 (pinned 0.5) into the voice outro.
 * Speed drops into each stop and comes back hard on each re-entry.
 *
 * The rest: the voice by phrases, and the groove and run by their kick pulse
 * (downbeats accented).
 *
 * Deliberately left out: snares, pickups and hooks (other strata), the faint
 * drum tick 8.731 at the swell's start (drums 0.12) and the other reset murmurs
 * (26.796, 27.040), so the reset reads as a stop.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BOOM, BUILD, DRUM_CUT_T0, DROP, DURATION, KICKS, LAST_DRUM, REENTRY, RUN_END, SILENCE_T0,
  kf, kickStrength, landings, music, overlayMeta, wordStrength, zoom,
} from "../music.ts";

const VOICE = [
  0.406, 1.277, 2.705, 3.32, 4.423, // intro by phrases
  BUILD, 7.872, 8.243, 9.102, 9.66, 9.961, // build and cut
  26.482, // the reset's first murmur
  42.655, 43.537, 45.012, 45.534, 46.103, // outro by phrases
];
const PINNED: Record<string, number> = {
  [BUILD]: 0.3, 9.66: 0.3, [DROP]: 1.0, [BOOM]: 0.75, 26.482: 0.12, [REENTRY]: 1.0, [RUN_END]: 0.3, [LAST_DRUM]: 0.5,
};

const times = landings(VOICE, KICKS, [BOOM, RUN_END]);
const strength = (t: number) => PINNED[t] ?? (VOICE.includes(t) ? wordStrength(t) : kickStrength(t, 0.58, 0.2));

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.75, amp: 0.15, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: { smoothingFrames: 8, keyframes: zoom },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  axes: {
    air: keyframes(kf([
      [0.0, 0.62], [4.4, 0.62], [SILENCE_T0, 0.9], [6.9, 0.9], [BUILD, 0.62], [DRUM_CUT_T0, 0.66],
      [DROP, 0.64], [23.5, 0.64], [BOOM, 0.88], [27.6, 0.88], [REENTRY, 0.64], [RUN_END, 0.66],
      [LAST_DRUM, 0.8], [DURATION, 0.85],
    ])),
    speed: keyframes(kf([
      [0.0, 0.4], [4.4, 0.4], [SILENCE_T0, 0.3], [BUILD, 0.38], [9.0, 0.5], [DRUM_CUT_T0, 0.42],
      [DROP, 0.86], [23.5, 0.84], [BOOM, 0.6], [26.6, 0.42], [REENTRY, 0.9], [38.4, 0.86],
      [RUN_END, 0.66], [40.5, 0.72], [LAST_DRUM, 0.55], [43.0, 0.4], [DURATION, 0.36],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P5" as const,
  pattern: "stops and re-entries",
  windows: [[4.38, 7.05], [9.05, 10.52], [23.46, 27.91], [39.12, 42.7]] as Array<[number, number]>,
};
