/**
 * Amor na Praia, handcrafted: "Kick and answer".
 *
 * Idea. Between the kicks the song is not empty: after the second and the third kick of every bar the bass and the
 * synth swell back in, half a beat late, like an answer. The emphasis is that pair. The kicks are kept even and the
 * answers land as softer second steps, so each bar goes: kick, kick-and, kick-and, kick. The first answer of a bar,
 * the clearer one, is a little firmer than the second.
 *
 * What lands, and how hard:
 * - Intro: the 808 alone (0.45), the chopped voice as touches (0.08).
 * - The burst: 4.46 at 1, the kicks after it 0.74 climbing to 0.88.
 * - The drop and the re-drop: 0.95.
 * - Groove: every kick 0.66 (0.70 after the re-drop); the answers 0.34 and 0.28. A landing about every 0.28 s
 *   in the middle of each bar, every 0.55 s at its ends.
 * - The fade: touches, the soft kick 0.30, a ride-out.
 * Air: lower in the groove than a kick-only reading, the steps are short. Speed as the music: burst and groove fast.
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
  ...at(m.BURST, (_, i) => [1.00, 0.68, 0.74, 0.76, 0.78, 0.80, 0.84, 0.88][i]),
  [m.BREATH_VOICE, 0.12],
  [m.DROP, 0.95], [m.REDROP, 0.95],
  ...KICKS.map(({ t, second }): Row => [t, second ? 0.70 : 0.66]),
  ...at(m.ANSWER_1, 0.34), ...at(m.ANSWER_2, 0.28),
  ...at(m.FADE_VOICE, (_, i) => [0.10, 0.12][i]), [m.SOFT_RETURN, 0.30],
];
const AIR = curve([[0, 0.60], [2.0, 0.78], [4.2, 0.70], [m.BURST_START, 0.50], [7.75, 0.52], [8.4, 0.80], [m.DROP, 0.44], [43.2, 0.44], [43.8, 0.40], [44.4, 0.30],
  [45.2, 0.15], [m.DURATION, 0.10]]);
const SPEED = curve([[0, 0.36], [4.2, 0.36], [m.BURST_START, 0.80], [7.75, 0.84], [8.4, 0.48], [m.DROP, 0.70], [26.2, 0.70], [m.REDROP, 0.76], [43.2, 0.76],
  [44.3, 0.46], [m.DURATION, 0.24]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: m.camera,
  contacts: beats(table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
