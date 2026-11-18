/**
 * Keep the boom and the eight 808 strokes under the chopped voice. In the band, ride the displaced upper
 * calls across the low bar accents. The three-note group and its shorter answering group trade places in
 * successive bars. The last high reply before the hey swells above the drummer. Leave the kicks under a
 * held upper note in flight. The issue for review is whether these responses carry enough low weight.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';

const music = {"title": "Amor Na Praia (Slowed)", "audio": "productions/short_amor_na_praia_46s/audio.mp3", "beats": "productions/short_amor_na_praia_46s/audio.json", "spectrogram": {"image": "productions/short_amor_na_praia_46s/spectrogram.png", "metadata": "productions/short_amor_na_praia_46s/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Flame Runner", phases: [
  {"name": "Boom and chopped replies", "t0": 0, "t1": 4.458, "color": "#426582"},
  {"name": "Dry 808 burst", "t0": 4.458, "t1": 9.13, "color": "#a45643"},
  {"name": "Upper calls over bass", "t0": 9.13, "t1": 26.73, "color": "#448078"},
  {"name": "The calls return", "t0": 26.73, "t1": 43.24, "color": "#826488"},
  {"name": "Last words and soft echoes", "t0": 43.24, "t1": 46.0, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Boom and chopped replies
  [0.337, 0.88], [0.865, 0.32], [1.132, 0.42], [1.672, 0.32], [2.038, 0.42], [2.548, 0.51],
  [3.082, 0.42], [3.611, 0.32], [3.913, 0.42],
  // Dry 808 burst
  [4.458, 0.97], [4.731, 0.69], [5.277, 0.88], [5.555, 0.32], [5.828, 0.78], [6.38, 0.69],
  [6.658, 0.32], [6.931, 0.69], [7.343, 0.78], [7.755, 0.69], [8.04, 0.51], [8.684, 0.32],
  // Upper calls over bass
  [9.131, 0.97], [9.543, 0.42], [9.961, 0.51], [10.507, 0.78], [10.931, 0.51], [11.331, 0.78],
  [11.61, 0.6], [11.883, 0.42], [12.161, 0.6], [12.574, 0.51], [13.125, 0.42], [13.531, 0.69],
  [13.944, 0.42], [14.362, 0.6], [14.913, 0.78], [15.319, 0.69], [15.732, 0.88], [16.01, 0.51],
  [16.562, 0.69], [16.968, 0.6], [17.525, 0.42], [17.665, 0.51], [17.932, 0.78], [18.35, 0.42],
  [18.762, 0.51], [19.313, 0.69], [19.72, 0.69], [20.132, 0.88], [20.41, 0.51], [20.962, 0.69],
  [21.374, 0.6], [21.78, 0.51], [21.92, 0.42], [22.332, 0.69], [22.75, 0.42], [23.156, 0.6],
  [23.708, 0.78], [24.12, 0.69], [24.532, 0.88], [24.811, 0.51], [25.362, 0.69], [25.768, 0.6],
  [26.18, 0.42], [26.285, 0.32],
  // The calls return
  [26.732, 0.97], [27.15, 0.42], [27.562, 0.51], [28.108, 0.51], [28.52, 0.6], [28.932, 0.78],
  [29.211, 0.51], [29.762, 0.69], [30.174, 0.51], [30.569, 0.51], [30.72, 0.42], [31.132, 0.69],
  [31.55, 0.42], [31.962, 0.51], [32.508, 0.6], [32.932, 0.51], [33.309, 0.88], [33.611, 0.51],
  [34.162, 0.69], [34.575, 0.51], [34.987, 0.51], [35.132, 0.42], [35.532, 0.78], [35.95, 0.42],
  [36.362, 0.51], [36.914, 0.51], [37.32, 0.6], [37.732, 0.78], [38.011, 0.51], [38.563, 0.69],
  [38.98, 0.51], [39.381, 0.51], [39.52, 0.42], [39.933, 0.69], [40.35, 0.42], [40.763, 0.51],
  [41.308, 0.6], [41.726, 0.51], [42.121, 0.78], [42.423, 0.51], [42.963, 0.69],
  // Last words and soft echoes
  [43.241, 0.69], [43.514, 0.32], [43.892, 0.42], [44.339, 0.51], [44.931, 0.32], [45.72, 0.22],
];

const spec: Spec = {
  duration: 46.0, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.66], [4.458, 0.62], [9.13, 0.67], [26.73, 0.61], [43.24, 0.52]]),
    speed: curve([[0, 0.53], [4.458, 0.86], [9.13, 0.8], [26.73, 0.87], [43.24, 0.48]]),
  },
};
export default spec;
