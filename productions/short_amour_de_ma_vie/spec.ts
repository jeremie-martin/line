/**
 * Follow the A to A-sharp and the repeated D syllables before letting the drums lead. The singer still
 * answers in the long gaps in the syncopated beat. Let the snare flam land as one stroke. Lean on the
 * bass pickup before the one-bar breath; the single returning backbeat is the deepest catch. After 36.58
 * keep the syncopations gentle right up to the cut. The weight of the quieter snare against the
 * answering words is uncertain.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "L’AMOUR DE MA VIE", "audio": "productions/short_amour_de_ma_vie/audio.mp3", "beats": "productions/short_amour_de_ma_vie/audio.json", "spectrogram": {"image": "productions/short_amour_de_ma_vie/spectrogram.png", "metadata": "productions/short_amour_de_ma_vie/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Billie Eilish", phases: [
  {"name": "The opening singer", "t0": 0, "t1": 4.59, "color": "#426582"},
  {"name": "Syncopated kick and sung answers", "t0": 4.59, "t1": 23.59, "color": "#a45643"},
  {"name": "Bass pickup and breath", "t0": 23.59, "t1": 25.25, "color": "#448078"},
  {"name": "Backbeat return", "t0": 25.25, "t1": 36.58, "color": "#826488"},
  {"name": "Groove eases", "t0": 36.58, "t1": 44.187, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // The opening singer
  [0.232, 0.22], [0.615, 0.32], [0.894, 0.42], [1.625, 0.42], [1.974, 0.32], [2.276, 0.51],
  [2.868, 0.32], [3.077, 0.42], [3.378, 0.22], [3.75, 0.42], [4.017, 0.32],
  // Syncopated kick and sung answers
  [4.586, 0.69], [5.236, 0.42], [5.584, 0.6], [5.909, 0.32], [6.24, 0.51], [6.583, 0.42],
  [6.995, 0.6], [7.25, 0.32], [7.581, 0.42], [7.912, 0.51], [8.26, 0.6], [8.58, 0.42],
  [8.911, 0.6], [9.247, 0.32], [9.572, 0.51], [9.915, 0.69], [10.513, 0.42], [10.919, 0.6],
  [11.256, 0.51], [11.581, 0.32], [11.877, 0.42], [12.591, 0.69], [12.922, 0.42], [13.247, 0.6],
  [13.572, 0.51], [13.915, 0.32], [14.251, 0.42], [14.588, 0.69], [15.209, 0.32], [15.598, 0.42],
  [15.923, 0.51], [16.248, 0.69], [16.591, 0.6], [16.904, 0.42], [17.589, 0.32], [17.92, 0.6],
  [18.251, 0.51], [18.884, 0.42], [19.249, 0.69], [19.58, 0.42], [19.923, 0.6], [20.59, 0.32],
  [20.915, 0.51], [21.252, 0.6], [21.583, 0.51], [21.92, 0.32], [22.251, 0.42], [22.75, 0.69],
  [23.255, 0.42],
  // Bass pickup and breath
  [23.591, 0.42], [24.242, 0.6], [24.694, 0.32],
  // Backbeat return
  [25.252, 0.88], [25.931, 0.6], [26.256, 0.42], [26.587, 0.69], [26.924, 0.32], [27.249, 0.51],
  [27.591, 0.6], [28.253, 0.42], [28.578, 0.32], [28.926, 0.69], [29.257, 0.42], [29.588, 0.6],
  [29.919, 0.51], [30.592, 0.69], [31.254, 0.42], [31.922, 0.6], [32.253, 0.32], [32.589, 0.51],
  [32.92, 0.6], [33.553, 0.42], [33.907, 0.51], [34.261, 0.69], [34.9, 0.32], [35.248, 0.42],
  [35.579, 0.51], [35.921, 0.6], [36.426, 0.42],
  // Groove eases
  [36.577, 0.6], [37.256, 0.32], [37.581, 0.42], [37.912, 0.51], [38.243, 0.6], [39.259, 0.32],
  [39.584, 0.51], [39.909, 0.42], [40.252, 0.6], [40.583, 0.32], [40.908, 0.51], [41.244, 0.42],
  [41.918, 0.6], [42.295, 0.32], [42.591, 0.51], [43.241, 0.42], [43.578, 0.6], [43.915, 0.32],
  [44.077, 0.22],
];

const spec: Spec = {
  duration: 44.187, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.64], [4.59, 0.51], [23.59, 0.73], [25.25, 0.56], [36.58, 0.49]]),
    speed: curve([[0, 0.47], [4.59, 0.68], [23.59, 0.66], [25.25, 0.79], [36.58, 0.65]]),
  },
};
export default spec;
