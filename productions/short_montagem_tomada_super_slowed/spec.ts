/**
 * Begin on the exposed call. The first held vowels have room for their small second attacks. At 6.23 the
 * voice leaves enough space for the high notes to form a line of their own. Answer the next sung call
 * with the low entries, carry the swell, then put the foot down on the drummer. Let the offbeat low
 * rebounds and the returning words cut across those quarters. The gap at 28.9 belongs to the voice.
 * After the last kick the high tail keeps ticking. The balance of bass and voice at 32–35 s is my
 * question.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "MONTAGEM TOMADA (Super Slowed)", "audio": "productions/short_montagem_tomada_super_slowed/audio.mp3", "beats": "productions/short_montagem_tomada_super_slowed/audio.json", "spectrogram": {"image": "productions/short_montagem_tomada_super_slowed/spectrogram.png", "metadata": "productions/short_montagem_tomada_super_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "MXZI", phases: [
  {"name": "Held call", "t0": 0, "t1": 6.23, "color": "#426582"},
  {"name": "Upper reply", "t0": 6.23, "t1": 9.46, "color": "#a45643"},
  {"name": "Voice over low entries", "t0": 9.46, "t1": 18.75, "color": "#448078"},
  {"name": "Low swell", "t0": 18.75, "t1": 20.09, "color": "#826488"},
  {"name": "Drums with low rebounds", "t0": 20.09, "t1": 39.81, "color": "#426582"},
  {"name": "Kick and lingering notes", "t0": 39.81, "t1": 41.361, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Held call
  [0.385, 0.69], [0.988, 0.32], [1.337, 0.51], [1.969, 0.42], [2.236, 0.6], [3.154, 0.42],
  [3.763, 0.32], [4.042, 0.51], [4.529, 0.32], [4.895, 0.42], [5.174, 0.51], [5.766, 0.32],
  // Upper reply
  [6.23, 0.6], [6.846, 0.42], [7.159, 0.51], [7.467, 0.32], [7.769, 0.42], [8.233, 0.6],
  [8.697, 0.51], [9.005, 0.32],
  // Voice over low entries
  [9.458, 0.6], [9.957, 0.42], [10.271, 0.51], [10.59, 0.69], [11.159, 0.78], [11.472, 0.51],
  [12.099, 0.42], [12.709, 0.6], [13.051, 0.51], [13.318, 0.42], [13.672, 0.32], [13.939, 0.6],
  [14.857, 0.51], [15.199, 0.6], [15.518, 0.42], [15.78, 0.51], [16.087, 0.69], [16.401, 0.6],
  [17.028, 0.42], [17.631, 0.6], [17.98, 0.42], [18.247, 0.51],
  // Low swell
  [18.752, 0.51], [19.483, 0.42],
  // Drums with low rebounds
  [20.093, 0.97], [20.563, 0.42], [21.045, 0.69], [21.323, 0.51], [21.939, 0.78], [22.252, 0.6],
  [22.554, 0.78], [22.914, 0.42], [23.169, 0.6], [23.483, 0.32], [23.785, 0.69], [24.104, 0.51],
  [24.412, 0.78], [24.713, 0.42], [25.021, 0.88], [25.491, 0.51], [25.956, 0.69], [26.252, 0.6],
  [26.571, 0.42], [26.867, 0.69], [27.18, 0.51], [27.482, 0.78], [27.842, 0.6], [28.098, 0.42],
  [28.411, 0.6], [28.893, 0.51], [29.52, 0.42], [29.949, 0.88], [30.414, 0.42], [30.872, 0.6],
  [31.18, 0.42], [31.801, 0.69], [32.109, 0.51], [32.411, 0.78], [32.881, 0.42], [33.34, 0.6],
  [33.641, 0.32], [33.961, 0.69], [34.263, 0.51], [34.57, 0.69], [35.023, 0.42], [35.342, 0.51],
  [35.801, 0.78], [36.109, 0.6], [36.422, 0.42], [36.736, 0.69], [37.037, 0.51], [37.339, 0.78],
  [37.804, 0.6], [38.268, 0.42], [38.57, 0.69], [38.883, 0.51], [39.191, 0.42], [39.499, 0.32],
  // Kick and lingering notes
  [39.806, 0.78], [40.12, 0.51], [40.427, 0.42], [40.735, 0.32], [41.043, 0.22],
];

const spec: Spec = {
  duration: 41.361, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.73], [6.23, 0.58], [9.46, 0.66], [18.75, 0.84], [20.09, 0.62], [39.81, 0.6]]),
    speed: curve([[0, 0.43], [6.23, 0.57], [9.46, 0.64], [18.75, 0.78], [20.09, 0.88], [39.81, 0.68]]),
  },
};
export default spec;
