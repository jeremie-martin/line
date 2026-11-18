/**
 * Hear the quiet middle as the continuation of the bright phrase-end answer. Keep its seven-note contour
 * intact at each break and give the uncovered articulations light touches. Leave the bass pumping
 * beneath the full drum bars in flight. The question is whether the faint centre can hold attention on
 * its own.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';

const music = {"title": "LUA NA PRAÇA", "audio": "productions/short_lua_na_praca/audio.mp3", "beats": "productions/short_lua_na_praca/audio.json", "spectrogram": {"image": "productions/short_lua_na_praca/spectrogram.png", "metadata": "productions/short_lua_na_praca/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "dj Samir, DJ Zarek, DJ DUDA & LUNxdiE", phases: [
  {"name": "Cut into bare drums", "t0": 0, "t1": 3.25, "color": "#426582"},
  {"name": "Voice pickup", "t0": 3.25, "t1": 5.52, "color": "#a45643"},
  {"name": "Bass body", "t0": 5.52, "t1": 10.98, "color": "#448078"},
  {"name": "Seven-note contour", "t0": 10.98, "t1": 12.79, "color": "#826488"},
  {"name": "Second body", "t0": 12.79, "t1": 18.25, "color": "#426582"},
  {"name": "Seven-note answer", "t0": 18.25, "t1": 19.85, "color": "#a45643"},
  {"name": "Uncovered upper phrases", "t0": 19.85, "t1": 27.34, "color": "#448078"},
  {"name": "Drums alone", "t0": 27.34, "t1": 34.61, "color": "#826488"},
  {"name": "Bass re-entry", "t0": 34.61, "t1": 47.57, "color": "#426582"},
  {"name": "Last exposed answer", "t0": 47.57, "t1": 49.691, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Cut into bare drums
  [0.518, 0.78], [0.982, 0.69], [1.429, 0.6], [1.882, 0.78], [2.231, 0.51], [2.567, 0.69],
  [3.02, 0.42],
  // Voice pickup
  [3.391, 0.51], [3.815, 0.32], [4.047, 0.42], [4.622, 0.51], [4.965, 0.42], [5.191, 0.32],
  // Bass body
  [5.522, 0.88], [5.975, 0.6], [6.428, 0.69], [6.88, 0.51], [7.339, 0.69], [7.792, 0.51],
  [8.244, 0.6], [8.703, 0.69], [9.156, 0.51], [9.609, 0.69], [10.067, 0.51], [10.52, 0.69],
  // Seven-note contour
  [10.979, 0.6], [11.205, 0.32], [11.321, 0.51], [11.658, 0.42], [12.111, 0.69], [12.343, 0.6],
  [12.569, 0.32],
  // Second body
  [12.79, 0.78], [13.248, 0.6], [13.701, 0.69], [14.154, 0.51], [14.607, 0.69], [15.06, 0.51],
  [15.518, 0.6], [15.977, 0.51], [16.43, 0.69], [16.882, 0.51], [17.335, 0.69], [17.788, 0.6],
  // Seven-note answer
  [18.252, 0.6], [18.479, 0.32], [18.589, 0.51], [18.931, 0.42], [19.384, 0.69], [19.622, 0.6],
  [19.843, 0.32],
  // Uncovered upper phrases
  [21.213, 0.22], [21.439, 0.32], [21.892, 0.32], [22.234, 0.42], [22.577, 0.22], [23.03, 0.32],
  [23.256, 0.32], [23.709, 0.22], [24.388, 0.32], [24.847, 0.42], [25.073, 0.22], [25.532, 0.32],
  [25.868, 0.42], [26.205, 0.22],
  // Drums alone
  [27.337, 0.88], [27.801, 0.69], [28.248, 0.69], [28.701, 0.6], [29.16, 0.78], [29.613, 0.51],
  [30.071, 0.69], [30.518, 0.6], [30.977, 0.78], [31.43, 0.51], [31.882, 0.69], [32.341, 0.51],
  [32.788, 0.69], [33.142, 0.6], [33.479, 0.42], [33.81, 0.51], [34.164, 0.32],
  // Bass re-entry
  [34.611, 0.97], [35.064, 0.69], [35.522, 0.6], [35.975, 0.78], [36.428, 0.51], [36.88, 0.69],
  [37.339, 0.51], [37.792, 0.69], [38.245, 0.6], [38.703, 0.78], [39.162, 0.51], [39.609, 0.69],
  [40.062, 0.69], [40.404, 0.6], [40.752, 0.51], [41.095, 0.42], [41.432, 0.32], [41.879, 0.78],
  [42.337, 0.51], [42.79, 0.69], [43.249, 0.51], [43.701, 0.6], [44.154, 0.69], [44.613, 0.6],
  [45.066, 0.51], [45.518, 0.69], [45.971, 0.51], [46.43, 0.69], [46.882, 0.69], [47.335, 0.51],
  // Last exposed answer
  [47.567, 0.51], [47.713, 0.32], [48.032, 0.42], [48.479, 0.22], [48.705, 0.42], [48.932, 0.32],
];

const spec: Spec = {
  duration: 49.691, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.48], [3.25, 0.66], [5.52, 0.59], [10.98, 0.59], [12.79, 0.59], [18.25, 0.64], [19.85, 0.76], [27.34, 0.58], [34.61, 0.68], [47.57, 0.57]]),
    speed: curve([[0, 0.74], [3.25, 0.6], [5.52, 0.88], [10.98, 0.77], [12.79, 0.84], [18.25, 0.74], [19.85, 0.56], [27.34, 0.8], [34.61, 0.91], [47.57, 0.56]]),
  },
};
export default spec;
