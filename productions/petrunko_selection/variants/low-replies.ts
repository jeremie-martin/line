/**
 * Petrunko, handcrafted: "The low replies".
 *
 * Idea. After the return, the heaviest sounds are not the drums but nine bass notes that answer them: as loud as a
 * drum hit in the mix, sharply attacked in the bass, each arriving 0.12–0.19 s after a drum. Too close to land both, so the
 * choice is which half of the pair is felt. Here it is the bass: the rider lands on the low reply, at the top of the
 * range, and the drum just before it is left out. Everything high in the clip is kept light to match: the upper
 * figure is touches. This is the data's candidate for the sound to emphasise; figure.ts lands the drums instead.
 *
 * What lands, and how hard:
 * - The opening hit 0.60. The figure's notes: 0.08–0.14.
 * - The build hits 0.46 rising to 0.66; doubled 0.60–0.70; the roll as its three sharpest strokes 0.62–0.74.
 * - The suspended note: a touch. The return: 0.95.
 * - The replies: the low replies 0.90–1 (26.98, 33.13, 44.05 and 54.96, the four heaviest, at 0.95, 0.98, 1 and 0.98); the drum
 *   hits that stand without one 0.62; the stroke that opens a bar 0.36.
 * - The decay: five strokes and a ride-out.
 * Air: high under the figure, lower once the bass leads. Speed: as figure.ts, a little faster in the replies.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
type Row = [number, number];
const at = (times: number[], impact: number | ((t: number, i: number) => number)): Row[] =>
  times.map((t, i) => [t, typeof impact === "number" ? impact : impact(t, i)]);
/** The drum hit up to 0.2 s before a low reply gives way to it; a hit after it stays. */
const DRUMS = m.REPLY_DRUMS.filter(t => !m.LOW_REPLIES.some(b => b - t > 0 && b - t < 0.2));
const ROWS: Row[] = [
  [m.OPENING_HIT, 0.60],
  ...m.FIGURE.map(([t, attack]): Row => [t, Number((0.06 + 0.15 * attack).toFixed(2))]),
  ...at(m.BUILD_DRUMS, (_, i) => 0.46 + 0.025 * i),
  ...at(m.DOUBLED, (_, i) => 0.60 + 0.014 * i),
  [20.19, 0.62], [20.54, 0.68], [20.88, 0.74],
  [m.SUSPENDED_NOTE, 0.08],
  [m.RETURN, 0.95],
  ...at(m.BAR_STROKES, 0.36), ...at(DRUMS, 0.62),
  ...at(m.LOW_REPLIES, t => ({26.98: 0.95, 33.13: 0.98, 44.05: 1.00, 54.96: 0.98})[t] ?? 0.90),
  ...at(m.DECAY_STROKES, (_, i) => [0.40, 0.36, 0.30, 0.20, 0.16][i]),
];
const AIR = curve([[0, 0.55], [2.0, 0.70], [11.4, 0.66], [17.0, 0.46], [19.7, 0.36], [20.9, 0.30], [21.6, 0.90], [m.RETURN, 0.50], [55.3, 0.50], [56.4, 0.40],
  [58.0, 0.22], [m.DURATION, 0.12]]);
const SPEED = curve([[0, 0.50], [2.0, 0.42], [11.4, 0.46], [17.0, 0.64], [19.7, 0.78], [20.9, 0.86], [21.6, 0.40], [22.2, 0.56], [m.RETURN, 0.86], [55.3, 0.86],
  [56.5, 0.50], [m.DURATION, 0.24]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
