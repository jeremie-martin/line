/**
 * Petrunko, handcrafted: "The long build".
 *
 * Idea. From 1.3 s to 21 s the clip does one thing: a pulse that starts as a tick you barely hear, becomes a drum
 * hit, doubles, and ends in a roll. The emphasis is that single twenty-second acceleration, made with density as
 * much as with force: a touch on every tick, then a hit on every tick, then every half tick, then every stroke of
 * the roll the rider can take (0.16–0.19 s apart). Then nothing at all for 1.4 s, and the return.
 *
 * What lands, and how hard:
 * - Every tick from 1.26, with or without a figure note on it: 0.10 rising evenly to 0.30 at 10.81. The two figure
 *   notes off the pulse (2.31, 5.12) as touches.
 * - The build hits 0.40 rising to 0.64; the doubled hits 0.66 to 0.80; the roll 0.74 to 0.92, seven strokes.
 * - The suspension: nothing lands. The note at 21.71 is left to the ear; the rider hangs.
 * - The return: 1. The replies are kept a step lower than in the other variants (0.76, bar strokes 0.40): the build
 *   was the event, the replies are its aftermath.
 * - The decay: five strokes and a ride-out.
 * Air: falls steadily through the build to almost none in the roll, then the longest flight of the clip.
 * Speed: rises steadily from 0.34 to 0.95 at the end of the roll.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
type Row = [number, number];
const at = (times: number[], impact: number | ((t: number, i: number) => number)): Row[] =>
  times.map((t, i) => [t, typeof impact === "number" ? impact : impact(t, i)]);
const PULSE = [...m.BARE_TICKS, ...m.FIGURE.map(f => f[0]).filter(t => t !== 2.31 && t !== 5.12)].sort((a, b) => a - b);
const ROWS: Row[] = [
  [m.OPENING_HIT, 0.56],
  ...at(PULSE, t => Number((0.10 + 0.20 * (t - 1.26) / (10.81 - 1.26)).toFixed(2))), [2.31, 0.08], [5.12, 0.12],
  ...at(m.BUILD_DRUMS, (_, i) => 0.40 + 0.03 * i),
  ...at(m.DOUBLED, (_, i) => 0.66 + 0.02 * i),
  ...at(m.ROLL_STROKES, (_, i) => 0.74 + 0.03 * i),
  [m.RETURN, 1.00],
  ...at(m.BAR_STROKES, 0.40), ...at(m.REPLY_DRUMS, 0.76),
  ...at(m.DECAY_STROKES, (_, i) => [0.40, 0.36, 0.30, 0.20, 0.16][i]),
];
const AIR = curve([[0, 0.55], [1.3, 0.62], [11.4, 0.54], [17.0, 0.42], [19.7, 0.30], [20.9, 0.22], [21.6, 0.92], [m.RETURN, 0.55], [55.3, 0.55], [56.4, 0.40],
  [58.0, 0.22], [m.DURATION, 0.12]]);
const SPEED = curve([[0, 0.40], [1.3, 0.34], [11.4, 0.50], [17.0, 0.68], [19.7, 0.84], [20.9, 0.95], [21.6, 0.36], [22.2, 0.54], [m.RETURN, 0.78], [55.3, 0.78],
  [56.5, 0.50], [m.DURATION, 0.24]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
