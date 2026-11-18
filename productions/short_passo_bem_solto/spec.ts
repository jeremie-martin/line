/**
 * The first phrase begins mid-word. Catch the short renewals around the long G-sharp, with the broken
 * drums answering between words. The high voice at nine seconds starts a second sentence. Give the
 * syncopated treble answer the next eight bars, reserving the largest catches for the two drum
 * entrances. Voice alone bridges the gap into the final broken drum pattern. Keep its last uneven
 * strokes. The distinction between the voice and its doubled treble note is least clear at 18–22 s.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "PASSO BEM SOLTO", "audio": "productions/short_passo_bem_solto/audio.mp3", "beats": "productions/short_passo_bem_solto/audio.json", "spectrogram": {"image": "productions/short_passo_bem_solto/spectrogram.png", "metadata": "productions/short_passo_bem_solto/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "ATLXS", phases: [
  {"name": "Broken drum under the held sentence", "t0": 0, "t1": 9.04, "color": "#426582"},
  {"name": "High answer", "t0": 9.04, "t1": 14.59, "color": "#a45643"},
  {"name": "Upper dance", "t0": 14.59, "t1": 27.3, "color": "#448078"},
  {"name": "Naked call", "t0": 27.3, "t1": 29.35, "color": "#826488"},
  {"name": "Drum return", "t0": 29.35, "t1": 45.05, "color": "#426582"},
  {"name": "Fraying drum figure", "t0": 45.05, "t1": 46.501, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Broken drum under the held sentence
  [0.3, 0.42], [0.52, 0.69], [0.758, 0.6], [1.194, 0.32], [1.443, 0.42], [1.67, 0.51],
  [2.012, 0.51], [2.361, 0.78], [2.819, 0.42], [3.249, 0.32], [3.701, 0.6], [3.858, 0.32],
  [4.212, 0.69], [4.416, 0.42], [4.874, 0.6], [5.13, 0.42], [5.362, 0.32], [5.71, 0.69],
  [6.053, 0.6], [6.494, 0.51], [6.743, 0.42], [7.202, 0.69], [7.893, 0.51], [8.369, 0.32],
  // High answer
  [9.048, 0.78], [9.408, 0.6], [9.75, 0.51], [10.209, 0.42], [10.447, 0.32], [10.923, 0.51],
  [11.242, 0.69], [11.579, 0.51], [11.829, 0.42], [12.281, 0.6], [12.537, 0.32], [12.978, 0.51],
  [13.419, 0.42], [13.901, 0.69], [14.348, 0.42],
  // Upper dance
  [14.586, 0.97], [14.934, 0.42], [15.282, 0.6], [15.973, 0.32], [16.2, 0.6], [16.786, 0.42],
  [17.128, 0.69], [17.819, 0.78], [18.051, 0.42], [18.626, 0.51], [18.974, 0.32], [19.201, 0.6],
  [19.671, 0.42], [20.118, 0.69], [20.478, 0.6], [20.826, 0.42], [21.517, 0.51], [21.738, 0.32],
  [22.324, 0.6], [22.672, 0.42], [23.357, 0.69], [23.584, 0.42], [24.17, 0.51], [24.512, 0.69],
  [25.209, 0.32], [25.435, 0.6], [26.022, 0.42], [26.358, 0.69], [26.585, 0.78], [27.049, 0.32],
  // Naked call
  [27.746, 0.6], [27.99, 0.51], [28.245, 0.42], [28.454, 0.32], [28.889, 0.51],
  // Drum return
  [29.348, 0.88], [29.708, 0.69], [30.277, 0.6], [30.521, 0.32], [30.741, 0.78], [31.2, 0.51],
  [31.554, 0.69], [31.902, 0.42], [32.123, 0.32], [32.587, 0.78], [33.052, 0.51], [33.748, 0.69],
  [33.969, 0.42], [34.433, 0.78], [34.892, 0.6], [35.257, 0.51], [35.815, 0.69], [36.279, 0.32],
  [36.738, 0.6], [37.121, 0.42], [37.44, 0.51], [37.661, 0.78], [38.125, 0.69], [38.584, 0.6],
  [38.938, 0.42], [39.507, 0.69], [39.971, 0.42], [40.203, 0.78], [40.43, 0.51], [40.784, 0.69],
  [41.353, 0.6], [41.817, 0.78], [42.281, 0.51], [42.775, 0.69], [43.199, 0.6], [43.663, 0.42],
  [44.122, 0.69], [44.476, 0.51], [44.818, 0.69], [45.045, 0.6],
  // Fraying drum figure
  [45.288, 0.42], [45.509, 0.51], [45.973, 0.32], [46.322, 0.22],
];

const spec: Spec = {
  duration: 46.501, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.56], [9.04, 0.64], [14.59, 0.48], [27.3, 0.78], [29.35, 0.59], [45.05, 0.46]]),
    speed: curve([[0, 0.65], [9.04, 0.76], [14.59, 0.84], [27.3, 0.6], [29.35, 0.91], [45.05, 0.75]]),
  },
};
export default spec;
