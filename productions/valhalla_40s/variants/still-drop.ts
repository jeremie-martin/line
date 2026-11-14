/**
 * Valhalla, handcrafted: "Stillness, then the drop".
 *
 * Idea. The song is thirty seconds of voice and ten of drums. The emphasis is the contrast itself: the voice part is
 * kept deliberately almost still, so that the three loud events before the groove (the kick and snare at 9.32, the hit at 19.69 that comes
 * with the voice, the drop) are the only things that hit.
 *
 * What lands, and how hard:
 * - Every word of the voice, as a touch (0.06–0.14). The last word of each phrase, the one the phrase leans on, a
 *   little more (0.20–0.30), growing slowly over the song so the stillness is not flat.
 * - The two loud hits before the drop (mix 0.6 against 0.3–0.45 around them): 0.70. They should startle.
 * - The drop: 1. The groove's kicks follow their loudness (0.84–0.95, the loudest at 34.27), snares about half, the
 *   bass entries a third (two of them carry a syllable). No other voice in the groove: the drums have taken over.
 * Air: the long held notes (4.16, 6.75, 26.65) are flights; words are steps close to the line.
 * Speed: slow under the voice, held back before the drop, then fast to the end.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
const ROWS: Array<[number, number]> = [
  // opening: the voice alone
  [1.463, 0.06], [4.156, 0.10], [6.745, 0.10], [8.580, 0.08],
  [9.323, 0.70], // lone kick and snare
  // phrase 1
  [9.973, 0.06], [10.298, 0.06], [10.612, 0.07], [10.913, 0.08], [11.262, 0.20], [11.923, 0.06],
  // phrase 2
  [12.562, 0.08], [12.887, 0.07], [13.201, 0.08], [13.851, 0.10], [14.501, 0.22],
  // phrase 3
  [15.174, 0.08], [15.488, 0.07], [15.894, 0.08], [16.138, 0.12], [16.393, 0.22], [17.090, 0.12], [17.752, 0.08], [18.077, 0.08], [18.402, 0.24], [19.029, 0.14],
  [19.691, 0.70], // the loud hit with the voice
  // phrase 4
  [20.364, 0.08], [20.677, 0.08], [21.002, 0.09], [21.304, 0.11], [21.629, 0.24], [21.966, 0.12], [22.280, 0.10],
  [23.266, 0.06], [23.591, 0.07], [23.905, 0.10], [24.242, 0.26], [24.892, 0.12],
  [26.192, 0.08], [26.645, 0.30], // the long held note: the flight before the drop starts here
  [29.373, 0.14],
  // the drop and the groove: kick, snare, bass entry
  [30.058, 1.00], [30.708, 0.46], [31.022, 0.30],
  [31.672, 0.90], [31.997, 0.48], [32.345, 0.30], [32.647, 0.84], [33.297, 0.46], [33.634, 0.32],
  [34.273, 0.95], [34.598, 0.50], [35.236, 0.86], [35.886, 0.48], [36.223, 0.28],
  [36.862, 0.92], [37.175, 0.46], [37.523, 0.28], [37.837, 0.84], [38.475, 0.44], [38.812, 0.30],
  [39.451, 0.40], // the last, soft kick
];
const AIR = curve([[0, 0.55], [4.1, 0.55], [5.1, 0.86], [6.6, 0.60], [7.7, 0.86], [9.2, 0.55], [10.0, 0.40], [26.4, 0.40], [27.9, 0.90], [29.3, 0.70],
  [m.DROP_T, 0.55], [m.DURATION, 0.55]]);
const SPEED = curve([[0, 0.30], [9.9, 0.32], [19.7, 0.40], [26.6, 0.42], [28.2, 0.30], [29.6, 0.50], [m.DROP_T, 0.90], [m.DURATION, 0.88]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
