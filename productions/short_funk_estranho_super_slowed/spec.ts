/**
 * Begin in the hollow left by the missing bass. The high clock keeps counting, softly at first. Calls
 * and echoes tighten into the upper melody. The short drum fill turns it over to a word-and-drum
 * exchange, then the low motor arrives on its own. Keep its dip near 26.81. The later upper offbeats
 * stay behind the bass, even where their sound is sharper. The last low pulse is still active at the
 * cut. Whether to feel the earliest ticks as touches or as suspended time is open.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "FUNK ESTRANHO (Super Slowed)", "audio": "productions/short_funk_estranho_super_slowed/audio.mp3", "beats": "productions/short_funk_estranho_super_slowed/audio.json", "spectrogram": {"image": "productions/short_funk_estranho_super_slowed/spectrogram.png", "metadata": "productions/short_funk_estranho_super_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Astora", phases: [
  {"name": "Faint upper clock", "t0": 0, "t1": 4.18, "color": "#426582"},
  {"name": "Calls and echoes", "t0": 4.18, "t1": 8.71, "color": "#a45643"},
  {"name": "Upper notes and fill", "t0": 8.71, "t1": 13.26, "color": "#448078"},
  {"name": "Words and drum replies", "t0": 13.26, "t1": 17.77, "color": "#826488"},
  {"name": "Low motor", "t0": 17.77, "t1": 45.434, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Faint upper clock
  [0.228, 0.12], [0.802, 0.22], [1.36, 0.12], [1.923, 0.22], [2.486, 0.12], [3.055, 0.22],
  [3.618, 0.12],
  // Calls and echoes
  [4.181, 0.42], [4.663, 0.32], [5.313, 0.51], [5.882, 0.32], [6.445, 0.6], [7.014, 0.42],
  [7.577, 0.51], [7.861, 0.42], [8.151, 0.32], [8.43, 0.42], [8.709, 0.51],
  // Upper notes and fill
  [8.999, 0.6], [9.132, 0.42], [9.585, 0.51], [9.841, 0.69], [10.119, 0.6], [10.404, 0.32],
  [10.973, 0.6], [11.257, 0.51], [11.402, 0.42], [11.826, 0.69], [12.105, 0.6], [12.383, 0.51],
  [12.668, 0.51], [12.813, 0.42], [12.958, 0.6],
  // Words and drum replies
  [13.26, 0.6], [13.66, 0.42], [14.38, 0.51], [14.647, 0.32], [14.937, 0.51], [15.228, 0.42],
  [15.518, 0.69], [15.918, 0.51], [16.226, 0.32], [16.638, 0.6], [16.911, 0.42], [17.19, 0.51],
  // Low motor
  [17.77, 0.97], [18.328, 0.78], [18.902, 0.69], [19.471, 0.78], [20.028, 0.69], [20.591, 0.78],
  [21.166, 0.69], [21.718, 0.78], [22.298, 0.78], [22.861, 0.78], [23.419, 0.69], [23.982, 0.78],
  [24.55, 0.69], [25.131, 0.78], [25.688, 0.69], [26.251, 0.78], [26.809, 0.32], [27.378, 0.69],
  [27.946, 0.78], [28.515, 0.69], [29.09, 0.78], [29.653, 0.69], [30.222, 0.78], [30.779, 0.69],
  [31.354, 0.78], [31.917, 0.69], [32.468, 0.78], [33.037, 0.69], [33.612, 0.78], [34.169, 0.69],
  [34.738, 0.78], [35.307, 0.69], [35.876, 0.78], [36.445, 0.69], [37.002, 0.78], [37.571, 0.69],
  [38.128, 0.78], [38.697, 0.69], [39.266, 0.78], [39.829, 0.69], [40.404, 0.78], [40.95, 0.69],
  [41.518, 0.78], [42.093, 0.69], [42.662, 0.78], [43.219, 0.69], [43.794, 0.78], [44.357, 0.69],
  [44.92, 0.78], [45.193, 0.69],
];

const spec: Spec = {
  duration: 45.434, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.48], [4.18, 0.58], [8.71, 0.55], [13.26, 0.63], [17.77, 0.76]]),
    speed: curve([[0, 0.37], [4.18, 0.57], [8.71, 0.73], [13.26, 0.72], [17.77, 0.95]]),
  },
};
export default spec;
