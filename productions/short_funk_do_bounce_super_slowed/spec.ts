/**
 * Start on the remaining syllables, then let the roll rattle low across the ground. The restart is all
 * bass, with a little double in its second phrase. Three exposed calls break the low pulse before the
 * drummer arrives. His even stride acquires a high offbeat answer and then it is the upper line that
 * leads, with the low double tucked under it. The treble is still articulating when the cut ends. The
 * boundary between the high answer and a second attack of the drum is least clear in the first two
 * answering bars.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "FUNK DO BOUNCE (Super Slowed)", "audio": "productions/short_funk_do_bounce_super_slowed/audio.mp3", "beats": "productions/short_funk_do_bounce_super_slowed/audio.json", "spectrogram": {"image": "productions/short_funk_do_bounce_super_slowed/spectrogram.png", "metadata": "productions/short_funk_do_bounce_super_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Ariis", phases: [
  {"name": "Last words", "t0": 0, "t1": 1.28, "color": "#426582"},
  {"name": "Roll", "t0": 1.28, "t1": 3.73, "color": "#a45643"},
  {"name": "Bass restart", "t0": 3.73, "t1": 11.96, "color": "#448078"},
  {"name": "Exposed little calls", "t0": 11.96, "t1": 13.47, "color": "#826488"},
  {"name": "Broad drum stride", "t0": 13.47, "t1": 22.01, "color": "#426582"},
  {"name": "High offbeats enter", "t0": 22.01, "t1": 32.37, "color": "#a45643"},
  {"name": "Upper phrase and low double", "t0": 32.37, "t1": 43.27, "color": "#448078"},
  {"name": "Treble still ticking", "t0": 43.27, "t1": 45.979, "color": "#826488"},
]};

const strikes: [number, number][] = [
  // Last words
  [0.331, 0.42], [0.946, 0.51],
  // Roll
  [1.283, 0.51], [1.439, 0.6], [1.741, 0.42], [1.892, 0.32], [2.2, 0.51], [2.513, 0.42],
  [2.809, 0.51], [2.966, 0.42], [3.117, 0.6], [3.419, 0.51],
  // Bass restart
  [3.726, 0.88], [4.342, 0.69], [4.951, 0.51], [5.288, 0.69], [5.555, 0.6], [6.17, 0.32],
  [6.333, 0.51], [6.786, 0.69], [7.389, 0.42], [7.703, 0.6], [7.999, 0.32], [8.603, 0.69],
  [8.922, 0.51], [9.526, 0.6], [9.822, 0.42], [10.431, 0.69], [10.739, 0.32], [11.041, 0.6],
  // Exposed little calls
  [11.958, 0.32], [12.26, 0.42], [12.567, 0.51],
  // Broad drum stride
  [13.473, 0.97], [13.932, 0.78], [14.088, 0.42], [14.698, 0.69], [15.307, 0.51], [15.917, 0.69],
  [16.37, 0.78], [16.526, 0.42], [17.136, 0.69], [17.745, 0.51], [18.355, 0.69], [18.808, 0.78],
  [18.965, 0.42], [19.568, 0.69], [20.184, 0.51], [20.793, 0.69], [21.403, 0.6],
  // High offbeats enter
  [22.012, 0.78], [22.192, 0.42], [22.622, 0.6], [22.802, 0.32], [23.231, 0.69], [23.411, 0.42],
  [23.841, 0.78], [24.021, 0.42], [24.45, 0.6], [24.63, 0.32], [25.06, 0.69], [25.246, 0.42],
  [25.501, 0.69], [25.658, 0.51], [26.105, 0.78], [26.279, 0.42], [26.586, 0.69], [26.888, 0.32],
  [27.202, 0.6], [27.498, 0.42], [27.8, 0.69], [28.107, 0.32], [28.293, 0.78], [28.717, 0.42],
  [29.03, 0.69], [29.326, 0.42], [29.518, 0.6], [29.936, 0.32], [30.249, 0.69], [30.534, 0.51],
  [30.992, 0.78], [31.155, 0.42], [31.463, 0.69], [31.765, 0.32], [31.95, 0.51],
  // Upper phrase and low double
  [32.374, 0.6], [32.989, 0.42], [33.5, 0.69], [33.907, 0.51], [34.208, 0.6], [34.719, 0.32],
  [35.126, 0.6], [35.416, 0.42], [35.747, 0.69], [36.049, 0.51], [36.345, 0.32], [36.647, 0.6],
  [37.099, 0.51], [37.262, 0.78], [37.57, 0.6], [37.866, 0.42], [38.318, 0.69], [38.783, 0.51],
  [39.085, 0.6], [39.595, 0.42], [40.008, 0.51], [40.292, 0.32], [40.756, 0.6], [41.221, 0.42],
  [41.529, 0.51], [42.063, 0.32], [42.434, 0.6], [42.591, 0.42],
  // Treble still ticking
  [43.27, 0.51], [43.7, 0.32], [44.007, 0.42], [44.297, 0.6], [44.611, 0.51], [44.901, 0.42],
  [45.255, 0.32], [45.673, 0.22],
];

const spec: Spec = {
  duration: 45.979, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.62], [1.28, 0.33], [3.73, 0.72], [11.96, 0.75], [13.47, 0.65], [22.01, 0.56], [32.37, 0.69], [43.27, 0.57]]),
    speed: curve([[0, 0.48], [1.28, 0.78], [3.73, 0.79], [11.96, 0.54], [13.47, 0.88], [22.01, 0.83], [32.37, 0.76], [43.27, 0.65]]),
  },
};
export default spec;
