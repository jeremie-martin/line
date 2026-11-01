/**
 * Tiki Tiki, v7-intense (stratum P4: an intense dense section at speed).
 *
 * The run (27.86–39.60) is the loudest stretch of the song (8 s mean mix 0.545 at
 * 29.5–37.5, against the groove's same bar without hats) and it is read as the
 * drums play it: kick AND snare, every drum hit of the bar, at the song's highest
 * speed. The bar is K(1) s K(2) s K(3) x K(4) . p | K(1), so the landings run at
 * the 0.43 s eighth pulse, with one 0.65 s hole (K4 → pickup, where nothing but a
 * soft E4 syllable plays) and one 0.21–0.22 s "ta-BOOM" per bar:
 * - every kick: 27.864 (the re-entry, pinned 1.0) … 38.301, the extra kick 34.377
 *   in the x slot included; downbeats accented (0.82), other kicks 0.64, from the
 *   measured drum peak (kickStrength; drums 0.67–0.74);
 * - every snare: the backbeats 29.176 30.035 32.647 33.518 36.130 37.001 and the
 *   pickups 28.514 31.997 35.468 (drums 0.29–0.31, mix rise 0.21–0.31: clearly
 *   audible over the gap), lighter at 0.41–0.43 by their loudness;
 * - the x slot where the voice fills it: the G5 hooks 30.917 and 37.872 (vocals
 *   0.46 and 0.25, mix rise 0.37 and 0.15), by how sharply they enter;
 * - the bar's break keeps the pulse to the next kick: the unpitched vocal shout
 *   38.731 (vocals 0.29, rise 0.24, salience 0.85) in the backbeat slot, the weak
 *   snare 39.172 where the downbeat should be (drums 0.19), then the kick 39.602.
 *
 * The rest is an ordinary reading at a lower speed, so the run stands out: the
 * voice intro by phrases (gentle), the drop 10.472 pinned 1.0, the groove by its
 * kick pulse (0.87 s, downbeats accented, no snares), the 808 boom 24.381 and two
 * reset murmurs, the run end's last kicks 40.472 40.902 41.784, and the voice
 * outro by phrases.
 *
 * Deliberately left out:
 * - the snares, pickups and hooks of the GROOVE (10.47–24.38): the same bar, but
 *   quieter and without hats; the run is the one dense stretch, and the groove's
 *   pickups are bench-pairs' pattern;
 * - inside the run, the vocal fragments 0.19–0.21 s before a drum hit (28.317,
 *   30.279, 31.788, 33.762, 35.260) and the notes that coincide with a snare or
 *   kick (29.722, 30.093, 37.059): they would make 0.2 s triples or double a hit
 *   already landed, under the drums;
 * - the faint unclassified drum ghost 37.222 (drums 0.19, no ADTOF class) and
 *   the mix-only kick clicks 50–90 ms before a kick (see music.ts).
 *
 * The run contains three pickup pairs (0.21 s), so a P4 failure can also be a P1
 * failure; per-window results tell which landing it stopped at.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BACKBEATS, BOOM, DROP, DURATION, HOOKS, KICKS, LAST_DRUM, PICKUPS, REENTRY, RUN_END,
  kf, kickStrength, landings, music, overlayMeta, snareStrength, wordStrength, zoom,
} from "../music.ts";

const RUN: [number, number] = [REENTRY - 0.05, 39.602 + 0.05];
const inRun = (t: number) => t >= RUN[0] && t <= RUN[1];

const SHOUT = 38.731;
const runSnares = [...BACKBEATS, ...PICKUPS].filter(inRun); // RUN_END 39.172 included
const runHooks = HOOKS.filter(inRun);
const VOICE = [
  0.406, 1.277, 1.846, 2.705, 3.32, 3.855, 4.423, // intro by phrases
  7.001, 7.872, 9.102, 9.961, // build and cut
  26.482, 27.04, // reset murmurs
  42.655, 43.003, 43.537, 45.012, 45.534, 46.103, // outro by phrases
];
const PINNED: Record<string, number> = { [DROP]: 1.0, [REENTRY]: 1.0, [BOOM]: 0.55 };

const times = landings(VOICE, KICKS, [BOOM], runSnares, runHooks, [SHOUT]);
const strength = (t: number) => {
  if (PINNED[t] !== undefined) return PINNED[t];
  if (VOICE.includes(t)) return wordStrength(t);
  if (runHooks.includes(t) || t === SHOUT) return wordStrength(t);
  if (runSnares.includes(t)) return snareStrength(t);
  return inRun(t) ? kickStrength(t, 0.64, 0.18) : kickStrength(t, 0.56, 0.18);
};

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.75, amp: 0.12, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: {
      smoothingFrames: 8,
      keyframes: zoom.map((k) => (k.t >= REENTRY && k.t <= 38.4 ? { ...k, zoom: k.zoom - 0.15 } : k)),
    },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  axes: {
    air: keyframes(kf([
      [0.0, 0.62], [4.5, 0.8], [6.9, 0.66], [9.9, 0.6], [DROP, 0.64], [23.6, 0.64],
      [BOOM, 0.85], [27.0, 0.72], [REENTRY, 0.55], [28.4, 0.5], [RUN_END, 0.5], [39.7, 0.62],
      [LAST_DRUM, 0.66], [42.5, 0.7], [DURATION, 0.8],
    ])),
    speed: keyframes(kf([
      [0.0, 0.38], [6.9, 0.42], [9.9, 0.6], [DROP, 0.76], [23.6, 0.78], [BOOM, 0.6],
      [26.8, 0.66], [REENTRY, 0.88], [28.4, 0.93], [RUN_END, 0.92], [39.7, 0.8],
      [LAST_DRUM, 0.64], [43.0, 0.46], [DURATION, 0.4],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P4" as const,
  pattern: "intense dense section at speed (kick and snare)",
  windows: [RUN] as Array<[number, number]>,
};
