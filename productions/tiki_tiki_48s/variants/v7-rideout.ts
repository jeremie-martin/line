/**
 * Tiki Tiki, v7-rideout (stratum P7: ride-outs, long riding on geometry at low
 * air).
 *
 * Three passages where nothing in the music asks for a hit for 2–6 s and the
 * sound is held, decaying or near-silent. There the rider RIDES: air about 0.2
 * over the gap (four-fifths of it on the line), at a moderate speed, and lands the
 * next impact. The lengths make a ladder:
 * - 2.10 s, THE BOOM'S DECAY, 24.381 → 26.482. The 808 boom (pinned 0.55) holds
 *   and decays while bass and chords stop (mix 0.62 → 0.31 by 25.6, 0.20 by 26.4);
 *   the ride follows the decaying sound and lands on the first murmured syllable
 *   26.482 (soft). Then 27.040 and the re-entry 27.864 (pinned 1.0).
 * - 3.23 s, THE LAST 808, 41.784 → 45.012. The soft last kick (by its peak, drums
 *   0.40) starts an 808 that holds and decays until about 44.3; the ride lasts as
 *   long as it sounds and lands on the outro's hook motif, whose first word 45.012
 *   is the outro's clearest attack (mix rise 0.12). Then 45.534, 46.103.
 * - 5.54 s, THE HELD BREATH, 4.423 → 9.961. After the intro's hook motif ends, two
 *   seconds of near-silence (mix 0.04–0.06), then breaths, two faint drum ticks
 *   and a drum swell rising to the cut (mix ≤ 0.32): a long suspended stretch
 *   with no statement in it. The ride crosses it and lands on the held C5 9.961,
 *   the intro's loudest note (vocals 0.26, rise 0.24), then the drop 10.472
 *   (pinned 1.0) 0.51 s later.
 * bench-calm floats over the near-silence and over the whole reset; this spec
 * asks the opposite physical demand on different gaps (low air, long contact).
 *
 * Ordinary riding around them: the intro's voice by phrases (0.406 1.277 1.846
 * 2.705 3.320 3.855 4.423, light by how sharply each enters), the groove and the
 * run by their kick pulse (0.87 s, downbeats accented), the run end's kicks.
 *
 * Deliberately left out:
 * - inside the 5.54 s ride: the faint tail 4.853 (vocals 0.08), the build's
 *   breaths and ticks 7.001 7.372 7.872 8.243 9.102 (vocals 0.09–0.19, drums
 *   0.05–0.08, mix ≤ 0.25) and the swell's start 8.731: texture under a held
 *   breath, not statements; 7.872 (mix rise 0.18) is the clearest of them, so this
 *   is a choice. And the cut's 9.660, a syllable 0.30 s before the C5 it leads to;
 * - inside the 3.23 s ride: the outro words 42.655, 43.003 (held C5), 43.537,
 *   44.408 (vocals 0.08–0.15, mix rise 0.01–0.06): under the 808's decay, which
 *   is the loudest layer until 44.3;
 * - the murmur 26.796 (between 26.482 and 27.040), the snares, pickups and hooks
 *   (other strata), and the outro motif's 45.256 and 45.836 (every other word).
 * Risk, kept on purpose: the last landing of the long ride is a light word, so
 * the ride has to arrive gently, not slam.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BOOM, DROP, DURATION, KICKS, LAST_DRUM, REENTRY,
  kf, kickStrength, landings, music, overlayMeta, wordStrength, zoom,
} from "../music.ts";

/** The three ride-outs, [start landing, end landing]. */
const RIDES: Array<[number, number]> = [[4.423, 9.961], [BOOM, 26.482], [LAST_DRUM, 45.012]];
const LOW = 0.2;

const VOICE = [
  0.406, 1.277, 1.846, 2.705, 3.32, 3.855, 4.423, // intro by phrases
  9.961, // the held C5 that ends the long ride
  26.482, 27.04, // reset murmurs
  45.012, 45.534, 46.103, // outro hook motif, every other word
];
const PINNED: Record<string, number> = { [DROP]: 1.0, [REENTRY]: 1.0, [BOOM]: 0.55 };

const times = landings(VOICE, KICKS, [BOOM]);
const strength = (t: number) =>
  PINNED[t] ?? (VOICE.includes(t) ? wordStrength(t) : kickStrength(t, 0.56, 0.2));

/** Air: ordinary riding, then a flat low plateau inside each ride-out gap. */
const rideAir = RIDES.flatMap(([a, b]): Array<[number, number]> => [[a + 0.03, LOW], [b - 0.03, LOW]]);

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.78, amp: 0.13, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: { smoothingFrames: 8, keyframes: zoom },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  jitter: 0,
  axes: {
    air: keyframes(kf(([
      [0.0, 0.6], [4.4, 0.6], ...rideAir, [10.0, 0.6], [DROP, 0.64], [23.6, 0.64], [BOOM, 0.64],
      [26.5, 0.6], [REENTRY, 0.64], [LAST_DRUM, 0.64], [45.04, 0.6], [DURATION, 0.7],
    ] as Array<[number, number]>).sort((x, y) => x[0] - y[0]))),
    speed: keyframes(kf([
      [0.0, 0.4], [4.4, 0.42], [9.9, 0.5], [DROP, 0.76], [23.6, 0.78], [BOOM, 0.6], [26.4, 0.52],
      [REENTRY, 0.8], [38.4, 0.8], [LAST_DRUM, 0.6], [45.0, 0.45], [DURATION, 0.4],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P7" as const,
  pattern: "ride-outs (2.1, 3.2, 5.5 s at low air)",
  windows: RIDES.map(([a, b]) => [Number((a - 0.05).toFixed(3)), Number((b + 0.05).toFixed(3))]) as Array<[number, number]>,
};
