/**
 * Two F-sharps flick upward out of a C-sharp pickup. Follow the sung turns until the drummer answers at
 * 8.616. The short offbeats above the drums have their own three-against-four spacing. In the break keep
 * the high repeated figure until the words come through again at 30.8. Let the last word hang over the
 * swell. The second drum entrance is the heavier one. The upper notes continue after the final low beat.
 * Whether the high figure or a chopped voice carries 23–30 s is uncertain.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "MONTAGEM TOMADA (Extended)", "audio": "productions/short_montagem_tomada_extended/audio.mp3", "beats": "productions/short_montagem_tomada_extended/audio.json", "spectrogram": {"image": "productions/short_montagem_tomada_extended/spectrogram.png", "metadata": "productions/short_montagem_tomada_extended/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "MXZI", phases: [
  {"name": "Pickup and sung pairs", "t0": 0, "t1": 6.77, "color": "#426582"},
  {"name": "Swelling last line", "t0": 6.77, "t1": 8.616, "color": "#a45643"},
  {"name": "Drum and upper answer", "t0": 8.616, "t1": 23.15, "color": "#448078"},
  {"name": "Upper figure alone", "t0": 23.15, "t1": 30.8, "color": "#826488"},
  {"name": "Second verse", "t0": 30.8, "t1": 38.152, "color": "#426582"},
  {"name": "Low return", "t0": 38.152, "t1": 52.92, "color": "#a45643"},
  {"name": "Low punctuation and treble tail", "t0": 52.92, "t1": 53.773, "color": "#448078"},
]};

const strikes: [number, number][] = [
  // Pickup and sung pairs
  [0.408, 0.22], [0.651, 0.51], [0.895, 0.6], [1.273, 0.42], [1.72, 0.32], [2.161, 0.42],
  [3.345, 0.51], [3.548, 0.42], [4.013, 0.6], [5.197, 0.32], [5.388, 0.42], [5.853, 0.51],
  // Swelling last line
  [6.77, 0.51], [7.043, 0.42], [7.501, 0.6], [8.047, 0.51], [8.302, 0.32],
  // Drum and upper answer
  [8.622, 0.97], [8.964, 0.32], [9.312, 0.6], [9.783, 0.42], [10.462, 0.69], [10.81, 0.51],
  [11.158, 0.42], [11.623, 0.6], [12.081, 0.42], [12.308, 0.69], [13.004, 0.78], [13.469, 0.42],
  [13.701, 0.69], [14.154, 0.42], [14.502, 0.69], [14.85, 0.6], [15.541, 0.32], [16, 0.88],
  [16.348, 0.32], [16.696, 0.6], [17.172, 0.42], [17.852, 0.69], [18.194, 0.51], [18.542, 0.42],
  [19.013, 0.6], [19.465, 0.42], [19.692, 0.69], [20.04, 0.51], [20.383, 0.42], [20.853, 0.6],
  [21.311, 0.42], [21.538, 0.69], [21.886, 0.6], [22.461, 0.6], [22.693, 0.42], [22.931, 0.51],
  // Upper figure alone
  [23.152, 0.6], [23.378, 0.32], [24.08, 0.51], [24.313, 0.42], [25.578, 0.6], [25.926, 0.69],
  [26.849, 0.42], [27.076, 0.32], [27.424, 0.51], [27.772, 0.6], [28.231, 0.42], [28.463, 0.32],
  [28.928, 0.51], [29.27, 0.42], [29.618, 0.6], [30.187, 0.42], [30.541, 0.32],
  // Second verse
  [30.803, 0.6], [31.035, 0.32], [31.697, 0.42], [32.649, 0.51], [32.881, 0.6], [33.078, 0.32],
  [33.542, 0.6], [34.477, 0.51], [34.733, 0.42], [34.93, 0.51], [35.388, 0.6], [36.311, 0.32],
  [36.578, 0.42], [36.77, 0.51], [37.037, 0.51],
  // Low return
  [38.152, 0.97], [38.5, 0.42], [38.848, 0.6], [39.313, 0.42], [39.998, 0.69], [40.352, 0.51],
  [40.921, 0.51], [41.159, 0.6], [41.617, 0.42], [41.849, 0.69], [42.308, 0.78], [42.54, 0.51],
  [43.01, 0.6], [43.463, 0.42], [44.038, 0.51], [44.613, 0.69], [45.222, 0.51], [45.541, 0.88],
  [45.884, 0.32], [46.232, 0.6], [46.697, 0.42], [47.382, 0.69], [47.73, 0.51], [48.078, 0.51],
  [48.543, 0.6], [49.001, 0.42], [49.228, 0.69], [49.692, 0.78], [49.924, 0.51], [50.389, 0.6],
  [50.847, 0.42], [51.422, 0.51], [52.002, 0.69], [52.461, 0.6],
  // Low punctuation and treble tail
  [52.92, 0.78], [53.39, 0.42], [53.616, 0.22],
];

const spec: Spec = {
  duration: 53.773, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.51], [6.77, 0.69], [8.616, 0.55], [23.15, 0.72], [30.8, 0.62], [38.152, 0.64], [52.92, 0.57]]),
    speed: curve([[0, 0.49], [6.77, 0.76], [8.616, 0.86], [23.15, 0.54], [30.8, 0.58], [38.152, 0.94], [52.92, 0.75]]),
  },
};
export default spec;
