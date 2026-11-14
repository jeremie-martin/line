/**
 * Amor na Praia, handcrafted: "Where the chord changes".
 *
 * Idea. The groove is one kick every 0.55 s for thirty-four seconds, all nearly as loud. What does change is the
 * chord, every four kicks, and the kick under a chord change is the sharpest attack of its bar. The emphasis is that
 * kick: it lands clearly harder than the three after it, so the ride moves in bars of four, not in single beats.
 *
 * What lands, and how hard:
 * - Intro: the 808 alone at 0.34 (0.45), then the chopped voice as touches (0.08).
 * - The burst, the 808 alone and the loudest thing in the clip: 4.46 is the song's 1; the kicks after it tighten
 *   and climb (0.78 to 0.90).
 * - The breath: one touch. The drop and the re-drop: 0.95.
 * - Groove: the chord-change kick 0.78, the others 0.58 / 0.64 / 0.62; all a step up after the re-drop.
 * - The fade: two sung notes as touches, the soft kick 0.30, then a ride-out.
 * Air: floats in the intro's quiet and in the breath; an even bounce in the groove. Speed: fast in the burst and the
 * groove, slow under the voice, dying with the fade.
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
  [m.BOOM, 0.45], ...at(INTRO, 0.08),
  ...at(m.BURST, (_, i) => [1.00, 0.70, 0.78, 0.78, 0.80, 0.82, 0.86, 0.90][i]),
  [m.BREATH_VOICE, 0.12],
  [m.DROP, 0.95], [m.REDROP, 0.95],
  ...KICKS.map(({ t, beat, second }): Row => [t, [0.78, 0.58, 0.64, 0.62][beat] + (second ? 0.04 : 0)]),
  ...at(m.FADE_VOICE, (_, i) => [0.10, 0.12][i]), [m.SOFT_RETURN, 0.30],
];
const AIR = curve([[0, 0.60], [2.0, 0.78], [4.2, 0.70], [m.BURST_START, 0.50], [7.75, 0.52], [8.4, 0.80], [m.DROP, 0.50], [43.2, 0.50], [43.8, 0.42], [44.4, 0.30],
  [45.2, 0.15], [m.DURATION, 0.10]]);
const SPEED = curve([[0, 0.36], [4.2, 0.36], [m.BURST_START, 0.80], [7.75, 0.84], [8.4, 0.48], [m.DROP, 0.72], [26.2, 0.72], [m.REDROP, 0.78], [43.2, 0.78],
  [44.3, 0.46], [m.DURATION, 0.24]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: m.camera,
  contacts: beats(table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
