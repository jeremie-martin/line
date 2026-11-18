/**
 * The opening voice comes into focus gradually. The drum at 6.71 stops the murmur. The exposed two-part
 * sentence that follows lands very softly, including the restart after its breath. The upper figure then
 * becomes the pulse: three more widely spaced attacks, a longer step and a short answer. Follow the
 * shortened bar near 23 s and the stronger low responses after 32.89. Omit the beat that bisects the
 * long step. I am least sure how much of the closing treble the listener follows once the bass falls
 * out.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LUNA BALA (Slowed)", "audio": "productions/short_luna_bala_slowed/audio.mp3", "beats": "productions/short_luna_bala_slowed/audio.json", "spectrogram": {"image": "productions/short_luna_bala_slowed/spectrogram.png", "metadata": "productions/short_luna_bala_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Yb Wasg'ood & Ariis", phases: [
  {"name": "Distant words", "t0": 0, "t1": 6.71, "color": "#426582"},
  {"name": "Bare voice", "t0": 6.71, "t1": 15.44, "color": "#a45643"},
  {"name": "Five upper strokes", "t0": 15.44, "t1": 30.7, "color": "#448078"},
  {"name": "Exposed strokes and returning low replies", "t0": 30.7, "t1": 48.14, "color": "#826488"},
  {"name": "Bass falls away", "t0": 48.14, "t1": 50.291, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Distant words
  [0.595, 0.32], [1.001, 0.42], [1.82, 0.32], [2.366, 0.42], [2.778, 0.51], [3.26, 0.42],
  [3.73, 0.51], [4.055, 0.42], [4.542, 0.32], [4.955, 0.51], [5.361, 0.42], [5.64, 0.6],
  [6.052, 0.51], [6.452, 0.42],
  // Bare voice
  [6.713, 0.6], [7.004, 0.22], [7.259, 0.12], [7.851, 0.22], [8.217, 0.12], [8.397, 0.22],
  [8.896, 0.12], [9.227, 0.32], [9.477, 0.12], [10.034, 0.22], [10.295, 0.12], [11.323, 0.12],
  [11.578, 0.22], [11.781, 0.12], [12.199, 0.22], [12.577, 0.12], [12.756, 0.22], [13.262, 0.12],
  [13.476, 0.32], [13.836, 0.12], [14.347, 0.22], [14.62, 0.12], [14.899, 0.22], [15.166, 0.12],
  // Five upper strokes
  [15.438, 0.88], [15.862, 0.69], [16.257, 0.6], [16.803, 0.69], [17.081, 0.32], [17.627, 0.88],
  [18.033, 0.78], [18.44, 0.51], [18.979, 0.69], [19.258, 0.32], [19.798, 0.97], [20.216, 0.51],
  [20.622, 0.6], [21.168, 0.69], [21.447, 0.32], [21.986, 0.88], [22.393, 0.78], [22.799, 0.69],
  [23.078, 0.51], [23.49, 0.42], [23.89, 0.69], [24.157, 0.42], [24.57, 0.51], [24.982, 0.69],
  [25.522, 0.32], [25.8, 0.32], [26.346, 0.88], [26.758, 0.69], [27.159, 0.42], [27.704, 0.69],
  [27.977, 0.32], [28.529, 0.88], [28.935, 0.78], [29.341, 0.51], [29.887, 0.6], [30.154, 0.32],
  // Exposed strokes and returning low replies
  [30.7, 0.51], [31.118, 0.69], [31.518, 0.6], [32.07, 0.78], [32.348, 0.32], [32.888, 0.88],
  [33.3, 0.69], [33.701, 0.51], [34.252, 0.69], [34.519, 0.32], [35.071, 0.88], [35.477, 0.78],
  [35.884, 0.6], [36.435, 0.69], [36.702, 0.42], [37.248, 0.88], [37.66, 0.78], [38.06, 0.51],
  [38.606, 0.69], [38.879, 0.32], [39.43, 0.88], [39.837, 0.69], [40.243, 0.51], [40.777, 0.69],
  [41.067, 0.6], [41.613, 0.88], [42.014, 0.6], [42.426, 0.51], [42.971, 0.69], [43.238, 0.32],
  [43.79, 0.88], [44.196, 0.42], [44.603, 0.51], [45.148, 0.69], [45.444, 0.32], [45.967, 0.88],
  [46.367, 0.42], [46.785, 0.51], [47.331, 0.69], [47.598, 0.32],
  // Bass falls away
  [48.149, 0.6], [48.562, 0.51], [48.962, 0.42], [49.508, 0.69], [49.937, 0.42], [50.135, 0.51],
];

const spec: Spec = {
  duration: 50.291, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.58], [6.71, 0.71], [15.44, 0.62], [30.7, 0.68], [48.14, 0.53]]),
    speed: curve([[0, 0.48], [6.71, 0.48], [15.44, 0.84], [30.7, 0.91], [48.14, 0.7]]),
  },
};
export default spec;
