/**
 * Amor na Praia, handcrafted: "The heavy kicks".
 *
 * Idea. The kicks are not all the same weight. In every bar the third kick is the heaviest in the mix and the fourth
 * nearly so (1.03 and 1.00 against 0.91 and 0.95 for the first two), and the bass figure comes in just before each of
 * them, like a breath before a blow. The emphasis is by weight: light, light, HEAVY, heavy, with the first bass
 * answer landed as the pickup into the heavy pair. This is the opposite reading of chord-bars, which accents the
 * first kick: the owner's ear decides which one the song wants.
 *
 * What lands, and how hard:
 * - Intro: the 808 alone (0.50), the chopped voice as touches (0.08).
 * - The burst is the heaviest passage of the clip and is treated as its peak: 4.46 at 1, its answer at 4.72 0.78, the rest 0.84–0.95,
 *   climbing as the kicks tighten.
 * - The drop and the re-drop: 0.92.
 * - Groove: kicks 0.54 / 0.60 / 0.82 / 0.76 through the bar (a step up after the re-drop); the bass pickup before
 *   the heavy kick 0.30.
 * - The fade: touches, the soft kick 0.30, a ride-out.
 * Air: a slightly longer flight into each heavy kick comes from the strengths themselves; the curve stays even.
 * Speed: the burst is the fastest passage; the groove a step below it.
 */
import { join } from "node:path";
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve, measuredSong } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
const { table } = measuredSong(join(import.meta.dirname, ".."));
type Row = [number, number];
const at = (times: number[], impact: number | ((t: number, i: number) => number)): Row[] =>
  times.map((t, i) => [t, typeof impact === "number" ? impact : impact(t, i)]);
/** The groove's kicks without the drop and the re-drop (both pinned), each with its place in its four-kick bar (0–3).
 *  A bar starts where the chord changes: 9.13, 11.33, 13.54 … every 2.2 s. */
const KICKS = m.GROOVE_KICKS.map((t, i) => ({ t, beat: i % 4, second: t > m.REDROP })).filter(k => k.t !== m.DROP && k.t !== m.REDROP);
const INTRO = m.INTRO_PHRASES.flat();
const ROWS: Row[] = [
  [m.BOOM, 0.50], ...at(INTRO, 0.08),
  ...at(m.BURST, (_, i) => [1.00, 0.78, 0.84, 0.86, 0.88, 0.90, 0.92, 0.95][i]),
  [m.BREATH_VOICE, 0.12],
  [m.DROP, 0.92], [m.REDROP, 0.92],
  ...KICKS.map(({ t, beat, second }): Row => [t, [0.54, 0.60, 0.82, 0.76][beat] + (second ? 0.03 : 0)]),
  ...at(m.ANSWER_1, 0.30),
  ...at(m.FADE_VOICE, (_, i) => [0.10, 0.12][i]), [m.SOFT_RETURN, 0.30],
];
const AIR = curve([[0, 0.60], [2.0, 0.78], [4.2, 0.70], [m.BURST_START, 0.50], [7.75, 0.52], [8.4, 0.80], [m.DROP, 0.50], [43.2, 0.50], [43.8, 0.42], [44.4, 0.30],
  [45.2, 0.15], [m.DURATION, 0.10]]);
const SPEED = curve([[0, 0.36], [4.2, 0.36], [m.BURST_START, 0.88], [7.75, 0.92], [8.4, 0.48], [m.DROP, 0.72], [26.2, 0.72], [m.REDROP, 0.76], [43.2, 0.76],
  [44.3, 0.46], [m.DURATION, 0.24]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  contacts: beats(table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
