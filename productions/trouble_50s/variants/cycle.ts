/**
 * Trouble, handcrafted: "Three, three, two".
 *
 * Idea. The kick never sits on an even grid: it goes long, long, short (0.67, 0.67, 0.45 s), again and again. The
 * emphasis is that limp. In every cycle the kick after the short step lands hardest, the middle one lightest, the
 * third pushes into the next cycle. From 18.5 s a faint percussion fills the gaps (the owner marked it as beats in
 * October): it lands as small steps, so the groove thickens by density, not by force.
 *
 * What lands, and how hard:
 * - Intro: the voice alone on its 0.45 s pulse, every word a touch (0.08), the last four rising a little into the
 *   groove. The opening crash, alone: 0.55.
 * - Groove: cycle kicks 0.70 / 0.58 / 0.62, a little more in the last three cycles; the percussion steps 0.14.
 * - The break: three touches. The drop: 1.
 * - After the drop the kicks are a different weight in the song (half again as loud): 0.86–0.98, the two triples
 *   (34.40, 41.56) rising kick by kick, the very last triple the peak after the drop. Bass pickups 0.40, the snare
 *   after 0.46.
 * - The vocal break: touches. The last kicks climb to 50.07 (0.90), which the owner asked for.
 * Air and speed: low and slow under the voice; an even bounce in the groove; a hang in the break; fast after the drop.
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
const TICKS = [18.52, 18.75, 19.19, 19.41, 19.86, 20.53, 20.99, 22.34, 22.79, 23.00, 23.45, 23.91, 24.11, 24.79, 25.24, 25.69, 25.90, 26.36,
  26.57, 27.03];
const ROWS: Row[] = [
  [0.37, 0.55],
  ...at([0.85, 1.30, 1.73, 2.18, 3.10, 3.51, 3.95, 5.77, 6.21, 6.66, 7.11, 7.55, 8.01, 8.46, 8.85, 9.36, 9.82, 10.70, 11.12], 0.08),
  [12.53, 0.10], [12.93, 0.12], [13.40, 0.12], [13.83, 0.14], [14.29, 0.16],
  ...CYCLES.flatMap((c, i) => at(c, (_, k) => (i === 0 && k === 0 ? 0.78 : [0.70, 0.58, 0.62][k]) + (i >= 4 ? 0.04 : 0))),
  [LAST_GROOVE_KICK, 0.74],
  ...at(TICKS, 0.14),
  [27.73, 0.10], [28.09, 0.14], [28.58, 0.10],
  [m.DROP_T, 1.00],
  ...at(HEAVY, t => ({30.82: 0.90, 31.50: 0.86, 32.61: 0.92, 34.40: 0.88, 34.74: 0.92, 35.07: 0.96, 36.19: 0.94, 37.99: 0.90, 38.66: 0.92, 39.78: 0.94,
    41.56: 0.90, 41.90: 0.94, 42.24: 0.98})[t]!),
  ...at(BASS_IN, 0.40), ...at(AFTER, 0.46),
  ...at([43.77, 44.23, 44.91, 45.62, 46.02], 0.10),
  ...at(FINAL, (_, i) => [0.72, 0.70, 0.76, 0.74, 0.80, 0.90][i]),
];
const AIR = curve([[0, 0.45], [14.3, 0.45], [14.7, 0.50], [27.3, 0.50], [28.2, 0.80], [m.DROP_T, 0.55], [42.5, 0.55], [44.5, 0.70], [46.6, 0.62], [46.95, 0.50],
  [m.DURATION, 0.50]]);
const SPEED = curve([[0, 0.34], [13.5, 0.36], [14.7, 0.62], [27.2, 0.68], [28.2, 0.42], [28.9, 0.60], [m.DROP_T, 0.84], [42.3, 0.88], [43.6, 0.46], [46.6, 0.50],
  [46.95, 0.78], [m.DURATION, 0.88]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
