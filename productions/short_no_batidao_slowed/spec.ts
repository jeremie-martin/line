/**
 * Take the bare drum and the quiet intervening words. The high signal arrives before the low pulse. Let
 * the rhythmic treble offbeats sit between drum strokes while the low recovery stays in the same landing
 * as its kick. At 22.55 the low D/F/G singer takes over and the unchanged upper loop recedes. Keep the
 * words over the return of full drums. This cut ends in the short roll itself. How audible the first
 * words are against the bare drum remains open.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "NO BATIDÃO (Slowed)", "audio": "productions/short_no_batidao_slowed/audio.mp3", "beats": "productions/short_no_batidao_slowed/audio.json", "spectrogram": {"image": "productions/short_no_batidao_slowed/spectrogram.png", "metadata": "productions/short_no_batidao_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "ZXKAI & slxughter", phases: [
  {"name": "Bare drummer and words", "t0": 0, "t1": 4.78, "color": "#426582"},
  {"name": "Bright signal and low pulse", "t0": 4.78, "t1": 22.55, "color": "#a45643"},
  {"name": "Lower singer", "t0": 22.55, "t1": 31.43, "color": "#448078"},
  {"name": "Lower voice over returning drums", "t0": 31.43, "t1": 39.75, "color": "#826488"},
  {"name": "Roll into the cut", "t0": 39.75, "t1": 40.783, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Bare drummer and words
  [0.343, 0.69], [0.581, 0.51], [0.901, 0.42], [1.272, 0.6], [1.452, 0.51], [2.004, 0.69],
  [2.184, 0.32], [2.561, 0.6], [3.112, 0.42], [3.542, 0.69], [3.948, 0.51], [4.064, 0.42],
  // Bright signal and low pulse
  [4.784, 0.78], [5.336, 0.88], [5.759, 0.6], [6.177, 0.42], [6.439, 0.51], [6.729, 0.69],
  [7.002, 0.78], [7.559, 0.42], [7.983, 0.6], [8.395, 0.32], [8.668, 0.69], [8.952, 0.51],
  [9.225, 0.69], [9.509, 0.42], [9.782, 0.6], [10.2, 0.32], [10.618, 0.78], [10.885, 0.51],
  [11.17, 0.69], [11.443, 0.42], [11.727, 0.51], [12, 0.78], [12.418, 0.32], [12.836, 0.69],
  [13.109, 0.78], [13.672, 0.42], [13.945, 0.6], [14.217, 0.32], [14.641, 0.69], [15.059, 0.51],
  [15.332, 0.69], [15.611, 0.42], [15.883, 0.6], [16.429, 0.32], [16.859, 0.78], [16.998, 0.51],
  [17.282, 0.69], [17.549, 0.42], [17.828, 0.51], [18.112, 0.78], [18.391, 0.32], [18.67, 0.69],
  [19.082, 0.69], [19.5, 0.42], [19.767, 0.6], [20.051, 0.32], [20.324, 0.78], [20.881, 0.51],
  [21.299, 0.51], [21.717, 0.69], [21.99, 0.42], [22.269, 0.6],
  // Lower singer
  [22.547, 0.6], [22.832, 0.69], [23.111, 0.51], [23.558, 0.42], [24.08, 0.32], [24.498, 0.51],
  [24.829, 0.42], [25.322, 0.69], [25.618, 0.51], [26.228, 0.32], [26.71, 0.42], [26.988, 0.6],
  [27.54, 0.69], [27.952, 0.51], [28.132, 0.32], [28.643, 0.42], [29.13, 0.6], [29.763, 0.51],
  [30.332, 0.42], [30.738, 0.32],
  // Lower voice over returning drums
  [31.429, 0.88], [31.981, 0.78], [32.538, 0.51], [32.817, 0.42], [33.223, 0.6], [33.652, 0.32],
  [33.954, 0.69], [34.198, 0.51], [34.477, 0.42], [34.755, 0.6], [35.237, 0.32], [35.597, 0.51],
  [35.87, 0.69], [36.114, 0.42], [36.433, 0.51], [36.979, 0.6], [37.223, 0.32], [37.542, 0.69],
  [37.815, 0.51], [38.087, 0.42], [38.633, 0.69], [39.202, 0.6], [39.469, 0.51],
  // Roll into the cut
  [39.753, 0.6], [40.038, 0.51], [40.177, 0.42], [40.317, 0.6], [40.589, 0.69],
];

const spec: Spec = {
  duration: 40.783, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.48], [4.78, 0.62], [22.55, 0.73], [31.43, 0.59], [39.75, 0.47]]),
    speed: curve([[0, 0.65], [4.78, 0.82], [22.55, 0.67], [31.43, 0.86], [39.75, 0.94]]),
  },
};
export default spec;
