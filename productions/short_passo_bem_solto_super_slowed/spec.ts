/**
 * Let the long low vowel travel before the little climbing reply. The F-sharp high answer at six and a
 * half seconds reaches across the drum, then the insistent repeated C takes over. Land each new call and
 * its tucked-in answer over the middle drums. The low holes between them are deliberate. At the
 * unaccompanied phrase keep the quieter restatement. The late drummer plays a displaced pickup and a
 * two-stroke answer. Allow the last syllables to interrupt him. I am least sure of the weight on the
 * high answer.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "PASSO BEM SOLTO (Super Slowed)", "audio": "productions/short_passo_bem_solto_super_slowed/audio.mp3", "beats": "productions/short_passo_bem_solto_super_slowed/audio.json", "spectrogram": {"image": "productions/short_passo_bem_solto_super_slowed/spectrogram.png", "metadata": "productions/short_passo_bem_solto_super_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "ATLXS", phases: [
  {"name": "Low vowel and climbing reply", "t0": 0, "t1": 6.45, "color": "#426582"},
  {"name": "High answer over bass", "t0": 6.45, "t1": 13.04, "color": "#a45643"},
  {"name": "Recurring C", "t0": 13.04, "t1": 28.68, "color": "#448078"},
  {"name": "Five calls", "t0": 28.68, "t1": 30.6, "color": "#826488"},
  {"name": "Pickup and drum pair", "t0": 30.6, "t1": 48.16, "color": "#426582"},
  {"name": "Last syllables on the drummer", "t0": 48.16, "t1": 49.778, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Low vowel and climbing reply
  [0.279, 0.42], [0.941, 0.6], [1.516, 0.32], [1.789, 0.51], [2.015, 0.6], [2.479, 0.42],
  [2.88, 0.6], [3.06, 0.42], [3.414, 0.51], [3.716, 0.32], [4.261, 0.51], [4.674, 0.42],
  [5.068, 0.6], [5.254, 0.32], [5.637, 0.42], [5.91, 0.51],
  // High answer over bass
  [6.456, 0.78], [6.868, 0.6], [7.286, 0.51], [7.837, 0.42], [8.11, 0.32], [8.644, 0.69],
  [9.062, 0.69], [9.463, 0.51], [9.759, 0.42], [10.299, 0.6], [10.821, 0.32], [11.262, 0.6],
  [11.657, 0.51], [12.22, 0.32], [12.748, 0.42],
  // Recurring C
  [13.039, 0.88], [13.451, 0.42], [13.869, 0.6], [14.687, 0.42], [14.954, 0.69], [15.784, 0.32],
  [16.057, 0.69], [16.887, 0.32], [17.259, 0.42], [17.979, 0.69], [18.257, 0.32], [19.082, 0.69],
  [19.354, 0.32], [20.173, 0.78], [20.452, 0.32], [21.282, 0.69], [21.543, 0.32], [22.367, 0.69],
  [22.64, 0.32], [23.464, 0.69], [23.731, 0.32], [24.567, 0.69], [24.834, 0.32], [25.67, 0.69],
  [25.937, 0.32], [26.762, 0.69], [27.034, 0.32], [27.859, 0.69], [28.132, 0.32],
  // Five calls
  [28.683, 0.6], [28.979, 0.42], [29.531, 0.51], [30.041, 0.32], [30.343, 0.51],
  // Pickup and drum pair
  [30.599, 0.97], [30.877, 0.32], [31.15, 0.6], [31.429, 0.42], [31.702, 0.69], [31.98, 0.51],
  [32.247, 0.78], [32.799, 0.69], [33.217, 0.42], [33.896, 0.6], [34.169, 0.32], [34.442, 0.78],
  [34.72, 0.51], [34.993, 0.69], [35.411, 0.51], [35.823, 0.6], [36.09, 0.78], [36.642, 0.69],
  [37.187, 0.42], [37.599, 0.6], [38.284, 0.78], [38.569, 0.32], [38.842, 0.69], [39.382, 0.42],
  [39.8, 0.51], [40.479, 0.78], [40.763, 0.32], [41.03, 0.69], [41.582, 0.42], [42.673, 0.69],
  [42.94, 0.51], [43.23, 0.78], [43.503, 0.32], [43.782, 0.69], [44.194, 0.42], [44.612, 0.51],
  [44.873, 0.78], [45.419, 0.69], [45.97, 0.51], [46.388, 0.69], [46.8, 0.6], [47.067, 0.42],
  [47.352, 0.42], [47.613, 0.78], [48.025, 0.51],
  // Last syllables on the drummer
  [48.165, 0.6], [48.443, 0.42], [48.751, 0.51], [49.262, 0.32], [49.546, 0.22],
];

const spec: Spec = {
  duration: 49.778, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.68], [6.45, 0.62], [13.04, 0.56], [28.68, 0.81], [30.6, 0.6], [48.16, 0.51]]),
    speed: curve([[0, 0.52], [6.45, 0.72], [13.04, 0.78], [28.68, 0.6], [30.6, 0.9], [48.16, 0.73]]),
  },
};
export default spec;
