/**
 * The opening boom leaves space for three clipped vocal groups. The dry 808 takes the sentence away mid-
 * word. Keep its uneven last three strokes, with a small vocal answer in each preceding gap. When the
 * band comes in, ride the four kicks of each bar and the bass replies after kicks two and three. Some of
 * those replies swell as clearly as the kick. Let the isolated hey interrupt the pattern once, then
 * resume through the last soft words and echoes. The weight on the second answer of a bar is the main
 * uncertainty.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "Amor Na Praia (Slowed)", "audio": "productions/short_amor_na_praia_46s/audio.mp3", "beats": "productions/short_amor_na_praia_46s/audio.json", "spectrogram": {"image": "productions/short_amor_na_praia_46s/spectrogram.png", "metadata": "productions/short_amor_na_praia_46s/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Flame Runner", phases: [
  {"name": "Boom and chopped replies", "t0": 0, "t1": 4.458, "color": "#426582"},
  {"name": "Dry 808 burst", "t0": 4.458, "t1": 9.13, "color": "#a45643"},
  {"name": "Kick and paired answers", "t0": 9.13, "t1": 26.73, "color": "#448078"},
  {"name": "The kick resumes", "t0": 26.73, "t1": 43.24, "color": "#826488"},
  {"name": "Last words and soft echoes", "t0": 43.24, "t1": 46.0, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Boom and chopped replies
  [0.337, 0.88], [0.865, 0.32], [1.132, 0.42], [1.672, 0.32], [2.038, 0.42], [2.548, 0.51],
  [3.082, 0.42], [3.611, 0.32], [3.913, 0.42],
  // Dry 808 burst
  [4.458, 0.97], [4.731, 0.69], [5.277, 0.88], [5.555, 0.32], [5.828, 0.78], [6.38, 0.69],
  [6.658, 0.32], [6.931, 0.69], [7.343, 0.78], [7.755, 0.69], [8.04, 0.51], [8.684, 0.32],
  // Kick and paired answers
  [9.131, 0.97], [9.683, 0.69], [9.967, 0.6], [10.228, 0.69], [10.519, 0.6], [10.78, 0.78],
  [11.331, 0.78], [11.883, 0.69], [12.161, 0.51], [12.434, 0.6], [12.713, 0.42], [12.98, 0.69],
  [13.531, 0.69], [14.083, 0.69], [14.362, 0.6], [14.629, 0.69], [14.913, 0.6], [15.18, 0.78],
  [15.732, 0.88], [16.283, 0.69], [16.562, 0.6], [16.834, 0.69], [17.113, 0.51], [17.38, 0.69],
  [17.932, 0.78], [18.483, 0.69], [18.762, 0.6], [19.04, 0.69], [19.313, 0.6], [19.58, 0.78],
  [20.132, 0.88], [20.683, 0.69], [20.962, 0.6], [21.235, 0.69], [21.513, 0.42], [21.78, 0.69],
  [22.332, 0.69], [22.883, 0.69], [23.156, 0.6], [23.429, 0.69], [23.708, 0.6], [23.98, 0.78],
  [24.532, 0.88], [25.083, 0.69], [25.362, 0.6], [25.641, 0.69], [25.908, 0.51], [26.18, 0.69],
  [26.285, 0.32],
  // The kick resumes
  [26.732, 0.97], [27.283, 0.69], [27.562, 0.6], [27.835, 0.69], [28.108, 0.51], [28.386, 0.69],
  [28.932, 0.78], [29.484, 0.69], [29.762, 0.6], [30.035, 0.69], [30.319, 0.51], [30.569, 0.78],
  [31.132, 0.69], [31.684, 0.69], [31.962, 0.51], [32.229, 0.69], [32.508, 0.6], [32.781, 0.69],
  [33.309, 0.88], [33.884, 0.69], [34.162, 0.6], [34.441, 0.69], [34.714, 0.42], [34.987, 0.69],
  [35.532, 0.78], [36.084, 0.69], [36.362, 0.51], [36.635, 0.69], [36.914, 0.51], [37.181, 0.69],
  [37.732, 0.78], [38.284, 0.69], [38.563, 0.6], [38.841, 0.69], [39.114, 0.51], [39.381, 0.78],
  [39.933, 0.69], [40.484, 0.69], [40.763, 0.51], [41.03, 0.69], [41.308, 0.6], [41.587, 0.69],
  [42.121, 0.78], [42.684, 0.69], [42.963, 0.6],
  // Last words and soft echoes
  [43.241, 0.69], [43.514, 0.32], [43.892, 0.42], [44.339, 0.51], [44.931, 0.32], [45.72, 0.22],
];

const spec: Spec = {
  duration: 46.0, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.66], [4.458, 0.62], [9.13, 0.58], [26.73, 0.63], [43.24, 0.52]]),
    speed: curve([[0, 0.53], [4.458, 0.86], [9.13, 0.85], [26.73, 0.89], [43.24, 0.48]]),
  },
};
export default spec;
