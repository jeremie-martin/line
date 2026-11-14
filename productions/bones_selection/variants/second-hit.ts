/**
 * Bones, handcrafted: "The second hit".
 *
 * Idea. The two heavy hits of a chorus bar are not the same sound. The first is sharp; the second is as loud or
 * louder in the mix but softer in attack: the fat one, with a lighter stroke running into it ("ta-BOOM"). The
 * emphasis is the second hit. It lands near the top in every bar, the first hit a clear step below, and the stroke
 * before it is kept as its pickup. This is the candidate the data points to for "the sound this song wants felt";
 * turn.ts keeps the two hits equal for comparison.
 *
 * What lands, and how hard:
 * - The bridge: the clearly sung words as touches (0.08); the bass entries, the low register that the chorus will
 *   take up, 0.36.
 * - The pickup: words 0.18–0.36, strokes 0.46–0.62. The chorus entry: 0.92 (a first hit, but the turn of the clip).
 * - The chorus: first hit 0.62, pickup stroke 0.42, second hit 0.92 rising to 0.96 over the chorus. In a fill bar
 *   the three hits go 0.62, 0.78, 0.96. The song's 1 is the very last second hit, 49.73.
 * - The stroke before the next bar is not landed: the bar breathes after its fat hit.
 * - The release: two strokes, a ride-out.
 * Air: a longer flight after each second hit, from the 1.3 s the bar leaves there.
 * Speed: fast in the chorus, at its top in the last four bars.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
type Row = [number, number];
const at = (times: number[], impact: number | ((t: number, i: number) => number)): Row[] =>
  times.map((t, i) => [t, typeof impact === "number" ? impact : impact(t, i)]);
/** The chorus has sixteen bars; this is a bar's number (0–15) from a hit's place in its list. */
const fill = (i: number) => i % 4 === 3;
const ROWS: Row[] = [
  ...at(m.CLEAR_WORDS, 0.08), ...at(m.BASS_ENTRIES, 0.36),
  ...at(m.PICKUP_WORDS, (_, i) => 0.18 + 0.06 * i), ...at(m.PICKUP_DRUMS, (_, i) => 0.46 + 0.08 * i),
  ...at(m.FIRST, (_, i) => i === 0 ? 0.92 : 0.62),
  ...at(m.FILL, 0.78),
  ...at(m.SECOND, (_, i) => i === 15 ? 1.00 : fill(i) ? 0.96 : 0.92 + 0.01 * Math.floor(i / 4)),
  ...at(m.BEFORE_SECOND, 0.42),
  ...at(m.RELEASE_STROKES, (_, i) => [0.36, 0.40][i]),
];
const AIR = curve([[0, 0.48], [15.0, 0.48], [16.4, 0.44], [17.1, 0.64], [m.CHORUS, 0.56], [49.7, 0.56], [50.6, 0.40], [51.4, 0.18], [m.DURATION, 0.10]]);
const SPEED = curve([[0, 0.32], [14.9, 0.36], [16.3, 0.56], [m.CHORUS, 0.80], [40.5, 0.84], [42.6, 0.90], [49.7, 0.92], [50.6, 0.56], [52.0, 0.34],
  [m.DURATION, 0.22]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
