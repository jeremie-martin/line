/**
 * Petrunko, handcrafted: "The figure and the replies".
 *
 * Idea. Two instruments tell the clip: the upper figure, alone for ten seconds, and the drums that answer it after
 * the return. The emphasis is to give each its own way of landing. A figure note lands by how sharply it is played
 * (it is the melody: its accents are heard); a drum reply lands hard and plain. The build is the handover: drum
 * hits growing under the figure until the figure is gone.
 *
 * What lands, and how hard:
 * - The opening hit, closing the low phrase: 0.60.
 * - The figure: each note 0.20–0.48 by its attack (4.68 the sharpest). The faint ticks under it are not landed.
 * - The build: drum hits 0.50 rising to 0.74; the figure notes that fall between two hits 0.34.
 * - The doubled drums 0.62–0.76; the roll as its three sharpest strokes, 0.64–0.78.
 * - The suspended note, alone in silence: a touch. The return: 1.
 * - The replies: the stroke that opens a bar 0.44, the first full hit of a bar 0.84, the others 0.80.
 * - The decay: five strokes, 0.40 down to 0.16, and a ride-out.
 * Air: floats where the held note swells between bars (38.1, 41.2, 49.0, 52.1) and in the suspension.
 * Speed: gathers through the build to the roll, hangs, then fast.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
type Row = [number, number];
const at = (times: number[], impact: number | ((t: number, i: number) => number)): Row[] =>
  times.map((t, i) => [t, typeof impact === "number" ? impact : impact(t, i)]);
const firstOfBar = [24.78, 26.83, 29.56, 32.29, 35.69, 37.74, 40.47, 43.19, 46.60, 48.65, 51.37, 54.10];
const ROWS: Row[] = [
  [m.OPENING_HIT, 0.60],
  ...m.FIGURE.map(([t, attack]): Row => [t, Number((0.14 + 0.62 * attack).toFixed(2))]),
  ...at(m.BUILD_DRUMS, (_, i) => 0.50 + 0.03 * i), ...at(m.BUILD_FIGURE, 0.34),
  ...at(m.DOUBLED, (_, i) => 0.62 + 0.02 * i),
  [20.19, 0.64], [20.54, 0.70], [20.88, 0.78],
  [m.SUSPENDED_NOTE, 0.10],
  [m.RETURN, 1.00],
  ...at(m.BAR_STROKES, 0.44),
  ...at(m.REPLY_DRUMS, t => firstOfBar.includes(t) ? 0.84 : 0.80),
  ...at(m.DECAY_STROKES, (_, i) => [0.40, 0.36, 0.30, 0.20, 0.16][i]),
];
const AIR = curve([[0, 0.55], [2.0, 0.60], [11.4, 0.60], [17.0, 0.46], [19.7, 0.36], [20.9, 0.30], [21.6, 0.90], [m.RETURN, 0.55], [37.9, 0.55], [38.15, 0.74],
  [38.4, 0.55], [40.6, 0.55], [41.1, 0.74], [41.45, 0.55], [48.8, 0.55], [49.05, 0.74], [49.3, 0.55], [51.5, 0.55], [52.0, 0.74], [52.4, 0.55],
  [55.3, 0.55], [56.4, 0.40], [58.0, 0.22], [m.DURATION, 0.12]]);
const SPEED = curve([[0, 0.50], [2.0, 0.44], [11.4, 0.46], [17.0, 0.64], [19.7, 0.78], [20.9, 0.86], [21.6, 0.40], [22.2, 0.56], [m.RETURN, 0.82], [55.3, 0.82],
  [56.5, 0.50], [m.DURATION, 0.24]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
