/**
 * Bones, handcrafted: "The turn".
 *
 * Idea. The clip turns once, at 17.36: seventeen seconds of a voice almost whispering, then the full chorus. The
 * emphasis is the turn. Before it everything is held near nothing, so the three bass entries and the pickup are the
 * only things that grow; after it the drums are landed in full, every stroke, and the four fills are the peaks.
 *
 * What lands, and how hard:
 * - The bridge: only the clearly sung words, as touches (0.08). The bass entries, each alone in the quiet, 0.30.
 * - The pickup: four words climbing 0.18 to 0.36, three drum strokes 0.50, 0.60, 0.70, the chorus entry 1.
 * - The chorus: the two heavy hits of a bar equal (0.82 and 0.84), the lighter strokes 0.40. A fill bar climbs
 *   through its three hits (0.84, 0.90, 0.95); the last fill ends the song's drums at 0.97.
 * - The release: two strokes (0.36, 0.40), then nothing: the rider stays on the line while the tail rings.
 * Air: a hang before the chorus entry; an even bounce in the chorus; a ride-out for the tail.
 * Speed: slow, then gathering through the pickup, fast in the chorus, dying in the tail.
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
  ...at(m.CLEAR_WORDS, 0.08), ...at(m.BASS_ENTRIES, 0.30),
  ...at(m.PICKUP_WORDS, (_, i) => 0.18 + 0.06 * i), ...at(m.PICKUP_DRUMS, (_, i) => 0.50 + 0.10 * i),
  ...at(m.FIRST, (_, i) => i === 0 ? 1.00 : fill(i) ? 0.84 : 0.82),
  ...at(m.FILL, 0.90),
  ...at(m.SECOND, (_, i) => i === 15 ? 0.97 : fill(i) ? 0.95 : 0.84),
  ...at(m.BEFORE_SECOND, 0.40), ...at(m.BEFORE_BAR, 0.40),
  ...at(m.RELEASE_STROKES, (_, i) => [0.36, 0.40][i]),
];
const AIR = curve([[0, 0.48], [15.0, 0.48], [16.4, 0.44], [17.1, 0.66], [m.CHORUS, 0.52], [49.7, 0.52], [50.6, 0.40], [51.4, 0.18], [m.DURATION, 0.10]]);
const SPEED = curve([[0, 0.32], [14.9, 0.36], [16.3, 0.56], [m.CHORUS, 0.82], [49.7, 0.86], [50.6, 0.56], [52.0, 0.34], [m.DURATION, 0.22]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
