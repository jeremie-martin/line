/**
 * Trouble, handcrafted: "Stop and go".
 *
 * Idea. After the drop the band keeps stopping: a burst of heavy kicks, then nothing but the voice, then the bass
 * creeps back and the kicks hit again. The emphasis is that stop-and-go, and the whole spec is built to set it up.
 * The first half is held down (touches, a modest groove) so that the second half is another song: every heavy kick
 * near the top, the rider fast and low in each burst, slow and high in each stop.
 *
 * What lands, and how hard:
 * - Intro: only the words that are clearly sung, one in two on purpose, all at 0.10. The opening crash: 0.60.
 * - Groove: kicks 0.52 / 0.46 / 0.48 by their place in the long-long-short cycle. Nothing else.
 * - The break: one touch on her held note. The drop: 1.
 * - After the drop: heavy kicks 0.92–0.98; the bass creeping back before a burst 0.52 (it announces the hit); the
 *   snare after 0.44.
 * - The vocal break: near nothing (0.06), a long float. The last kicks 0.80 rising to 0.95 at 50.07.
 * Speed and air after the drop alternate with the music: bursts at 0.90 and low air, stops at 0.55 and high air.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
type Row = [number, number];
/** Rows for a list of times: one strength for all, or one per time. */
const at = (times: number[], impact: number | ((t: number, i: number) => number)): Row[] =>
  times.map((t, i) => [t, typeof impact === "number" ? impact : impact(t, i)]);

/** The groove's kicks, in cycles of three (0.67, 0.67, 0.45 s): first, second, third. */
const CYCLES = [[14.71, 15.38, 16.05], [16.50, 17.16, 17.83], [18.29, 18.96, 19.63], [20.09, 20.75, 21.42], [21.87, 22.55, 23.21],
  [23.66, 24.34, 25.01], [25.45, 26.12, 26.80]];
const LAST_GROOVE_KICK = 27.25;
/** The heavy kicks after the drop: half again as loud in the mix as the groove's (1.0 against 0.7). */
const HEAVY = [30.82, 31.50, 32.61, 34.40, 34.74, 35.07, 36.19, 37.99, 38.66, 39.78, 41.56, 41.90, 42.24];
/** The bass coming back in, 0.22 s before a heavy kick. */
const BASS_IN = [30.59, 32.39, 34.18, 37.76, 39.55, 41.34];
/** The snare or tom after a heavy kick. */
const AFTER = [29.94, 31.72, 33.49, 35.29, 37.08, 38.87, 40.67, 42.47];
/** The last kicks, the 3-3-2 again. */
const FINAL = [46.95, 47.61, 48.29, 48.74, 49.41, 50.07];
const ROWS: Row[] = [
  [0.37, 0.60],
  ...at([2.18, 3.51, 5.77, 7.55, 8.01, 8.85, 9.36, 10.70, 12.53, 12.93, 13.83, 14.29], 0.10),
  ...CYCLES.flatMap((c, i) => at(c, (_, k) => i === 0 && k === 0 ? 0.60 : [0.52, 0.46, 0.48][k])),
  [LAST_GROOVE_KICK, 0.52],
  [28.09, 0.10],
  [m.DROP_T, 1.00],
  ...at(HEAVY, t => ({30.82: 0.94, 31.50: 0.92, 32.61: 0.95, 34.40: 0.92, 34.74: 0.94, 35.07: 0.97, 36.19: 0.96, 37.99: 0.93, 38.66: 0.95, 39.78: 0.96,
    41.56: 0.93, 41.90: 0.95, 42.24: 0.98})[t]!),
  ...at(BASS_IN, 0.52), ...at(AFTER, 0.44),
  ...at([43.77, 44.23, 44.91, 45.62, 46.02], 0.06),
  ...at(FINAL, (_, i) => [0.80, 0.78, 0.84, 0.82, 0.88, 0.95][i]),
];
const AIR = curve([[0, 0.50], [14.7, 0.48], [27.3, 0.48], [28.2, 0.82], [m.DROP_T, 0.45], [29.7, 0.78], [30.5, 0.45], [31.6, 0.45], [32.1, 0.78], [32.4, 0.45],
  [32.8, 0.50], [33.5, 0.80], [34.1, 0.45], [35.2, 0.45], [35.7, 0.78], [36.1, 0.45], [36.4, 0.50], [37.0, 0.80], [37.7, 0.45], [38.8, 0.45],
  [39.2, 0.78], [39.6, 0.45], [40.0, 0.50], [40.7, 0.80], [41.3, 0.45], [42.4, 0.45], [43.4, 0.70], [45.0, 0.88], [46.6, 0.66], [46.95, 0.48],
  [m.DURATION, 0.48]]);
const SPEED = curve([[0, 0.36], [14.3, 0.38], [14.7, 0.56], [27.2, 0.58], [28.2, 0.34], [28.9, 0.60], [m.DROP_T, 0.90], [29.7, 0.55], [30.6, 0.90], [31.6, 0.90],
  [32.0, 0.56], [32.4, 0.92], [33.3, 0.55], [34.2, 0.94], [35.2, 0.94], [35.7, 0.58], [36.1, 0.92], [36.9, 0.55], [37.7, 0.92], [38.8, 0.92],
  [39.2, 0.58], [39.6, 0.92], [40.5, 0.55], [41.3, 0.96], [42.4, 0.96], [43.2, 0.44], [46.4, 0.40], [46.95, 0.84], [m.DURATION, 0.94]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
