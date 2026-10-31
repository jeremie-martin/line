/**
 * Tiki Tiki, bench-calm (stratum P3: calm floats, a soft opening, floats into a
 * slam).
 *
 * Tiki has two genuinely quiet stretches that each end on the strongest kind of
 * hit, and both are read as floats:
 * - The intro (mix 0.04–0.30 until 10.4, against 0.45–0.65 in the groove): soft
 *   touches on the voice by phrases (0.406, 1.277, 2.705, 3.320, 4.423; asks
 *   0.08–0.13), a 2.58 s float over the two seconds of near-silence to the return
 *   of sound at 7.001, two more touches (7.872, 8.243), then a 2.23 s float, the
 *   highest air of the song, over the drum swell and the drum cut into the drop
 *   10.472 (kick + snare, mix rise 0.84), pinned 1.0.
 * - The reset: the 808 boom 24.381 (0.55) launches a 3.48 s float over its decay
 *   and the quiet bar after it (mix 0.59 → 0.16) into the re-entry 27.864 (the
 *   drum swell lands, mix 0.97, rise 0.60), pinned 1.0.
 *
 * The rest: the groove and the run by their kick pulse (every kick, 0.87 s, bar
 * downbeats accented), and a calm outro with four soft touches on the voice.
 *
 * Deliberately left out:
 * - the voice inside the two final floats (9.102, 9.660, 9.961 before the drop;
 *   26.482, 26.796, 27.040 in the reset; vocals 0.08–0.26): quiet, and a float
 *   over them is the reading; 9.961 is the intro's loudest note, so this is a
 *   choice, not an omission;
 * - the snares, pickups and hooks in the groove and run, so the floats are this
 *   spec's difficulty (pairs and dense runs belong to other strata);
 * - the faint intro tail 4.853 and the drum tick 8.731 (drums 0.12, the swell's
 *   start).
 * Risk, kept on purpose: a 3.48 s float can pick up unrequested knocks.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BOOM, BUILD, DROP, DURATION, KICKS, LAST_DRUM, REENTRY, SILENCE_T0,
  kf, kickStrength, landings, music, overlayMeta, voiceStrength, zoom,
} from "../music.ts";

const SOFT_INTRO = [0.406, 1.277, 2.705, 3.32, 4.423, BUILD, 7.872, 8.243];
const SOFT_OUTRO = [42.655, 43.537, 45.012, 46.103];
const FLOAT_FROM = 8.243;
const PINNED: Record<string, number> = { [DROP]: 1.0, [REENTRY]: 1.0, [BOOM]: 0.55 };

const times = landings(SOFT_INTRO, KICKS, [BOOM], SOFT_OUTRO);
const soft = (t: number) => Number(voiceStrength(t, 0.06, 0.4).toFixed(3));
const strength = (t: number) =>
  PINNED[t] ?? (SOFT_INTRO.includes(t) || SOFT_OUTRO.includes(t) ? soft(t) : kickStrength(t, 0.6, 0.2));

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.78, amp: 0.15, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: {
      smoothingFrames: 8,
      keyframes: [{ t: 0.0, zoom: 2.9 }, { t: FLOAT_FROM, zoom: 2.75 }, ...zoom.filter((k) => k.t >= DROP)],
    },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  jitter: 0,
  axes: {
    air: keyframes(kf([
      [0.0, 0.85], [SILENCE_T0, 0.92], [BUILD, 0.86], [FLOAT_FROM, 0.95], [DROP, 0.95],
      [DROP + 0.4, 0.7], [23.6, 0.7], [BOOM, 0.95], [REENTRY, 0.95], [REENTRY + 0.4, 0.7],
      [LAST_DRUM, 0.75], [42.6, 0.88], [DURATION, 0.9],
    ])),
    speed: keyframes(kf([
      [0.0, 0.3], [BUILD, 0.32], [FLOAT_FROM, 0.38], [DROP, 0.7], [DROP + 0.6, 0.8], [23.6, 0.8],
      [BOOM, 0.6], [26.5, 0.5], [REENTRY, 0.74], [REENTRY + 0.6, 0.84], [38.4, 0.82],
      [LAST_DRUM, 0.6], [43.0, 0.38], [DURATION, 0.32],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P3" as const,
  pattern: "calm floats into a slam",
  windows: [[0.35, 10.52], [24.33, 27.91]] as Array<[number, number]>,
};
