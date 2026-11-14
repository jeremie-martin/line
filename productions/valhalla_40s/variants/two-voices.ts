/**
 * Valhalla, handcrafted: "Two voices".
 *
 * Idea. Two voices share the song: a high one (C♯4–E4) that carries most phrases, and a low male one (E2, E3) that
 * answers at 15.2, 21.0–22.3 and 23.9–24.9. The emphasis is by register: the high voice barely touches the line and
 * rides high above it; the low voice comes down and lands heavy. The drums, when they arrive, are the low voice's
 * side of the song taken to its end: kicks and bass heavy, snares and high syllables light.
 *
 * What lands, and how hard:
 * - High voice: every word 0.06–0.14, the leaned-on word of a phrase 0.18–0.30.
 * - Low voice: 0.44–0.72, its strongest words (21.63, 24.24) the peaks of the voice part.
 * - The two lone drum hits: 0.70. The drop: 1.
 * - Groove: kicks 0.86–0.95, bass entries 0.52 (the low register again), snares 0.40, the high syllables over the
 *   drums back to touches (0.14).
 * Air: high under the high voice, down near the line when the low voice sings. Speed: even under the voice, so that
 * the register and not the pace makes the contrast; fast in the groove.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
const ROWS: Array<[number, number]> = [
  // opening: the high voice alone
  [1.463, 0.06], [4.156, 0.12], [6.745, 0.12], [8.580, 0.08],
  [9.323, 0.70], // lone kick and snare
  // high voice
  [10.298, 0.08], [10.612, 0.10], [10.913, 0.12], [11.262, 0.24], [11.923, 0.08],
  [12.562, 0.12], [12.887, 0.10], [13.201, 0.12], [13.851, 0.14], [14.501, 0.26],
  // low voice answers
  [15.174, 0.62], [15.488, 0.50], [15.894, 0.46],
  // high voice
  [16.138, 0.16], [16.393, 0.26], [17.090, 0.18], [17.752, 0.10], [18.077, 0.10], [18.402, 0.28], [19.029, 0.18],
  [19.691, 0.70], // lone kick
  [20.364, 0.10], [20.677, 0.12],
  // low voice: its long answer
  [21.002, 0.44], [21.304, 0.56], [21.629, 0.68], [21.966, 0.64], [22.280, 0.52],
  [23.905, 0.50], [24.242, 0.72], [24.892, 0.46],
  // the held note, and the syllable before the drop
  [26.482, 0.14], [26.645, 0.30], [29.373, 0.30],
  // the drop and the groove
  [30.058, 1.00], [30.708, 0.40], [31.022, 0.52], [31.370, 0.14],
  [31.672, 0.90], [31.997, 0.40], [32.345, 0.52], [32.647, 0.86], [33.297, 0.40], [33.634, 0.52], [33.971, 0.14],
  [34.273, 0.95], [34.598, 0.40], [34.923, 0.14], [35.236, 0.88], [35.886, 0.40], [36.223, 0.52],
  [36.862, 0.92], [37.175, 0.40], [37.523, 0.52], [37.837, 0.86], [38.475, 0.40], [38.812, 0.52], [39.160, 0.14],
  [39.451, 0.44], [39.787, 0.14],
];
const AIR = curve([[0, 0.66], [4.1, 0.66], [5.1, 0.86], [6.6, 0.68], [7.7, 0.86], [9.2, 0.62], [10.0, 0.68], [14.6, 0.68], [15.1, 0.32], [15.9, 0.32],
  [16.3, 0.68], [20.7, 0.68], [21.1, 0.32], [22.3, 0.32], [22.9, 0.66], [23.7, 0.60], [24.0, 0.32], [24.9, 0.34], [25.6, 0.66], [26.6, 0.68],
  [28.0, 0.90], [29.3, 0.66], [m.DROP_T, 0.50], [m.DURATION, 0.50]]);
const SPEED = curve([[0, 0.40], [9.9, 0.46], [26.6, 0.50], [28.2, 0.38], [29.6, 0.54], [m.DROP_T, 0.88], [m.DURATION, 0.90]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
