/**
 * Finish the quiet word and let the distant drums approach two exposed C calls. The chorus lands on its
 * heavy drum sentence, with the softer answers and intervening words on lighter catches. At 24.462
 * abandon that motor. Stay with the held G, then C5 and its rearticulation; the continuing drummer alone
 * is never a reason to cut a held note short. Three late drum answers bring the singer down to the
 * closing words. I am least certain of the little breath before the last G.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LET THE WORLD BURN (Remix)", "audio": "productions/short_let_the_world_burn/audio.mp3", "beats": "productions/short_let_the_world_burn/audio.json", "spectrogram": {"image": "productions/short_let_the_world_burn/spectrogram.png", "metadata": "productions/short_let_the_world_burn/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Chris Grey, G-Eazy & Ari Abdul", phases: [
  {"name": "Distant approach", "t0": 0, "t1": 3.204, "color": "#426582"},
  {"name": "Naked C calls", "t0": 3.204, "t1": 4.481, "color": "#a45643"},
  {"name": "Drums and lighter replies", "t0": 4.481, "t1": 24.462, "color": "#448078"},
  {"name": "G held over the drummer", "t0": 24.462, "t1": 34.145, "color": "#826488"},
  {"name": "High C held across the bar", "t0": 34.145, "t1": 43.514, "color": "#426582"},
  {"name": "Last drum answers and bare words", "t0": 43.514, "t1": 46.98, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Distant approach
  [0.302, 0.32], [1.022, 0.22], [1.921, 0.42], [2.252, 0.32],
  // Naked C calls
  [3.204, 0.6], [3.646, 0.42],
  // Drums and lighter replies
  [4.481, 0.97], [4.818, 0.69], [5.137, 0.51], [5.462, 0.42], [5.776, 0.6], [6.153, 0.78],
  [6.751, 0.78], [7.07, 0.69], [7.39, 0.42], [7.692, 0.51], [8.028, 0.69], [8.348, 0.6],
  [8.934, 0.42], [9.329, 0.6], [9.648, 0.78], [10.617, 0.69], [10.942, 0.32], [11.442, 0.51],
  [11.807, 0.42], [12.225, 0.78], [12.55, 0.69], [12.957, 0.6], [13.201, 0.78], [13.514, 0.51],
  [14.164, 0.69], [14.356, 0.42], [14.809, 0.6], [15.128, 0.78], [15.778, 0.69], [16.097, 0.42],
  [16.515, 0.51], [16.776, 0.6], [17.067, 0.32], [17.392, 0.78], [17.711, 0.69], [18.361, 0.51],
  [18.68, 0.42], [18.977, 0.6], [19.371, 0.42], [19.824, 0.6], [19.969, 0.78], [20.701, 0.69],
  [20.939, 0.32], [21.258, 0.51], [21.879, 0.42], [22.227, 0.51], [22.552, 0.78], [22.877, 0.69],
  [23.249, 0.6], [23.522, 0.42], [23.841, 0.51], [24.172, 0.42],
  // G held over the drummer
  [24.462, 0.51], [25.321, 0.6], [28.758, 0.42], [29.466, 0.51], [30.383, 0.51], [30.848, 0.6],
  [33.123, 0.42],
  // High C held across the bar
  [34.145, 0.6], [34.865, 0.42], [35.48, 0.51], [39.091, 0.51], [40.31, 0.42], [42.028, 0.6],
  // Last drum answers and bare words
  [43.514, 0.69], [44.164, 0.6], [44.524, 0.42], [44.745, 0.32], [44.942, 0.51], [45.906, 0.42],
  [46.469, 0.32],
];

const spec: Spec = {
  duration: 46.98, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.66], [3.204, 0.76], [4.481, 0.7], [24.462, 0.9], [34.145, 0.94], [43.514, 0.63]]),
    speed: curve([[0, 0.43], [3.204, 0.75], [4.481, 0.9], [24.462, 0.94], [34.145, 0.96], [43.514, 0.63]]),
  },
};
export default spec;
