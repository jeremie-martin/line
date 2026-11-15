/**
 * Trouble, handcrafted: "The singer".
 *
 * Idea. The voice never stops, and it is the most varied thing in the song: quick words, then a note held for a
 * second. The emphasis is the singer's phrasing. A word lands by how clearly it is sung; a held note is a firm landing
 * followed by a flight as long as the note; the kicks under her are kept plain so they carry the pace without
 * taking the picture. After the drop the heavy kicks do take over, but her four long high notes (30.0, 31.7, 37.1, 38.9)
 * still get their flights between them.
 *
 * What lands, and how hard:
 * - Intro: words 0.16, clearly sung ones 0.30–0.42 (3.51 and 10.70 are held over a second).
 * - Groove: kicks 0.50–0.54 flat, more where a held note starts on one (14.71, 17.83, 25.01); her strong
 *   words between kicks 0.22–0.40.
 * - The break, her alone: 0.30–0.46. The drop: 1.
 * - After the drop: heavy kicks 0.88–0.95; the snare that starts a held note 0.52–0.56; other words 0.36.
 * - The vocal break: five clear words, alone: 0.36–0.46. Then the last kicks with her words
 *   between, ending on 50.07.
 * Air: a flight after every held note that has room for one (the intro, the break, after the drop; in the groove a
 * kick comes every 0.45–0.67 s under her). Speed: follows her, unhurried, until the drop.
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
  [0.37, 0.50],
  // intro, by how clearly each word is sung
  ...at([0.85, 1.30, 1.73, 3.10, 3.95, 5.77, 6.21, 6.66, 7.11, 8.46, 9.82, 11.12], 0.16),
  [2.18, 0.30], [2.44, 0.30], [13.40, 0.32], [3.51, 0.42], [7.55, 0.34], [8.01, 0.38], [8.85, 0.40], [9.36, 0.30], [10.70, 0.42], [12.53, 0.40], [12.93, 0.32], [13.83, 0.36], [14.29, 0.40],
  // groove: plain kicks, more under a held note
  ...CYCLES.flatMap(c => at(c, (t, k) => ({14.71: 0.70, 17.83: 0.62, 25.01: 0.62})[t] ?? [0.54, 0.50, 0.50][k])),
  [LAST_GROOVE_KICK, 0.54],
  [16.78, 0.34], [17.44, 0.22], [20.53, 0.22], [22.34, 0.40], [22.79, 0.26], [23.45, 0.30], [24.11, 0.22],
  // the break
  [27.73, 0.34], [28.09, 0.46], [28.58, 0.30],
  [m.DROP_T, 1.00],
  ...at(HEAVY, t => ({36.19: 0.94, 35.07: 0.95, 42.24: 0.95})[t] ?? 0.90),
  ...at(BASS_IN, 0.34),
  ...at(AFTER, t => ({31.72: 0.56, 37.08: 0.52, 38.87: 0.56})[t] ?? 0.42),
  [33.77, 0.36], [40.94, 0.36],
  // the vocal break
  [43.77, 0.40], [44.23, 0.44], [44.91, 0.44], [45.62, 0.36], [46.02, 0.46],
  ...at(FINAL, (_, i) => [0.70, 0.68, 0.72, 0.70, 0.76, 0.88][i]),
  [47.40, 0.36], [47.86, 0.36], [49.03, 0.30],
];
const AIR = curve([[0, 0.52], [3.4, 0.52], [4.3, 0.80], [5.4, 0.55], [10.6, 0.55], [11.6, 0.82], [12.4, 0.55], [14.7, 0.48], [27.3, 0.48], [28.3, 0.72],
  [m.DROP_T, 0.52], [29.95, 0.55], [30.25, 0.78], [30.55, 0.55], [31.7, 0.55], [32.1, 0.78], [32.5, 0.55], [37.0, 0.55], [37.5, 0.80], [37.9, 0.55], [38.8, 0.55], [39.2, 0.78], [39.7, 0.55],
  [42.5, 0.55], [44.5, 0.62], [46.95, 0.50], [m.DURATION, 0.50]]);
const SPEED = curve([[0, 0.38], [14.3, 0.42], [14.7, 0.58], [27.2, 0.60], [28.2, 0.40], [28.9, 0.56], [m.DROP_T, 0.80], [42.3, 0.82], [43.6, 0.42], [46.6, 0.46],
  [46.95, 0.76], [m.DURATION, 0.84]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
