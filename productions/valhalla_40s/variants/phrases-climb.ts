/**
 * Valhalla, handcrafted: "Each phrase a climb".
 *
 * Idea. The voice sings in runs of quick words that end on one leaned-on word. The emphasis is that shape: inside a
 * phrase every word lands a little harder than the one before, and the phrase's last word is its peak. The peaks
 * themselves grow from phrase to phrase (0.50 at 11.26 to 0.66 at 26.65), so the whole voice part climbs to the drop.
 *
 * What lands, and how hard:
 * - Every heard word, from 0.14 at the start of a run to 0.36–0.50 before its peak; the peaks 0.50–0.66.
 * - The opening's held notes, alone in silence, count for more than they measure: 0.40 and 0.44.
 * - The two lone drum hits: 0.80.
 * - The drop: 1. In the groove the voice goes on over the drums, so both land: kicks 0.86–0.95, snares 0.46,
 *   syllables and bass entries between them 0.26–0.44. A landing about every third of a second.
 * Air: low inside a run (quick steps), a flight after each peak, the longest after the held note at 26.65.
 * Speed: gathers phrase by phrase, hangs before the drop, fast in the groove.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
const ROWS: Array<[number, number]> = [
  // opening
  [1.463, 0.16], [4.156, 0.40], [6.745, 0.44], [8.580, 0.22],
  [9.323, 0.80], // lone kick and snare
  // phrase 1: the run, its peak, the "ho" after it
  [9.973, 0.14], [10.298, 0.18], [10.612, 0.22], [10.913, 0.28], [11.262, 0.50], [11.923, 0.16],
  // phrase 2
  [12.562, 0.20], [12.887, 0.24], [13.201, 0.28], [13.851, 0.36], [14.501, 0.54],
  // phrase 3: two short climbs, then "oh-oh-oh"
  [15.174, 0.22], [15.488, 0.22], [15.894, 0.28], [16.138, 0.40], [16.393, 0.56],
  [17.090, 0.34], [17.752, 0.26], [18.077, 0.30], [18.402, 0.58], [19.029, 0.42],
  [19.691, 0.80], // lone kick
  // phrase 4: the longest run, falling off its peak
  [20.364, 0.24], [20.677, 0.28], [21.002, 0.32], [21.304, 0.38], [21.629, 0.46], [21.966, 0.50], [22.280, 0.40],
  [23.266, 0.14], [23.591, 0.18], [23.905, 0.32], [24.242, 0.62], [24.892, 0.34],
  [26.192, 0.14], [26.482, 0.34], [26.645, 0.66], // the held note
  [29.373, 0.46],
  // the drop and the groove: drums and voice together
  [30.058, 1.00], [30.708, 0.46], [31.022, 0.44], [31.370, 0.34],
  [31.672, 0.90], [31.997, 0.46], [32.345, 0.30], [32.647, 0.86], [33.297, 0.46], [33.634, 0.42], [33.971, 0.34],
  [34.273, 0.95], [34.598, 0.48], [34.923, 0.40], [35.236, 0.88], [35.886, 0.46], [36.223, 0.26],
  [36.862, 0.92], [37.175, 0.46], [37.523, 0.26], [37.837, 0.86], [38.475, 0.44], [38.766, 0.36], [39.160, 0.34],
  [39.451, 0.44], [39.787, 0.30],
];
const AIR = curve([[0, 0.60], [4.1, 0.60], [5.1, 0.82], [6.6, 0.62], [7.7, 0.82], [9.2, 0.55], [10.0, 0.42], [11.2, 0.44], [11.7, 0.62], [12.5, 0.42],
  [14.4, 0.44], [14.85, 0.62], [15.2, 0.44], [22.2, 0.44], [22.8, 0.66], [23.3, 0.44], [24.8, 0.46], [25.5, 0.70], [26.2, 0.48], [28.0, 0.90],
  [29.3, 0.66], [m.DROP_T, 0.50], [m.DURATION, 0.50]]);
const SPEED = curve([[0, 0.34], [9.9, 0.40], [14.5, 0.48], [19.7, 0.54], [24.3, 0.62], [26.7, 0.58], [28.2, 0.40], [29.6, 0.56], [m.DROP_T, 0.88], [m.DURATION, 0.90]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
