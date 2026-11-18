/**
 * The cut starts inside the light upper figure. The singer answers over isolated drum accents before the
 * first full burst. Separate the hard doubles from their soft pickups. At the hole around 16.5 s let the
 * rapid words continue the rhythm across the missing drums. The next long passage follows the
 * B/A/G-sharp vocal descent, with one short drum reply in the withdrawal. Return to percussion for the
 * last burst, breaking for the little vocal bridge. Let the last bass and word answer the final stroke.
 * The quick words around 29 s may want more space.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "MONTAGEM COMA", "audio": "productions/short_montagem_coma/audio.mp3", "beats": "productions/short_montagem_coma/audio.json", "spectrogram": {"image": "productions/short_montagem_coma/spectrogram.png", "metadata": "productions/short_montagem_coma/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Andromeda", phases: [
  {"name": "Light upper figure", "t0": 0, "t1": 4.1, "color": "#426582"},
  {"name": "Sung answers", "t0": 4.1, "t1": 8.09, "color": "#a45643"},
  {"name": "Heavy drum bursts", "t0": 8.09, "t1": 16.47, "color": "#448078"},
  {"name": "Rap in the gap", "t0": 16.47, "t1": 22.59, "color": "#826488"},
  {"name": "Long descending voice", "t0": 22.59, "t1": 32.09, "color": "#426582"},
  {"name": "Final burst and short vocal bridge", "t0": 32.09, "t1": 48.019, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Light upper figure
  [0.339, 0.32], [0.85, 0.51], [1.349, 0.42], [1.848, 0.6], [2.138, 0.32], [2.475, 0.51],
  [2.846, 0.42], [3.352, 0.32], [3.601, 0.32], [3.851, 0.42],
  // Sung answers
  [4.1, 0.69], [4.472, 0.51], [4.849, 0.6], [5.093, 0.42], [5.343, 0.51], [5.592, 0.69],
  [6.091, 0.6], [6.597, 0.42], [6.84, 0.51], [7.102, 0.32], [7.595, 0.6],
  // Heavy drum bursts
  [8.094, 0.97], [8.466, 0.78], [8.843, 0.51], [9.093, 0.69], [9.342, 0.6], [9.841, 0.32],
  [10.091, 0.88], [10.468, 0.51], [10.84, 0.69], [11.351, 0.6], [11.85, 0.78], [12.094, 0.42],
  [12.465, 0.51], [12.848, 0.78], [13.092, 0.42], [13.342, 0.6], [13.841, 0.69], [14.091, 0.88],
  [14.468, 0.51], [14.84, 0.78], [15.35, 0.42], [15.844, 0.6], [16.093, 0.69], [16.471, 0.88],
  // Rap in the gap
  [16.732, 0.51], [16.97, 0.42], [17.098, 0.32], [17.353, 0.6], [17.852, 0.51], [18.09, 0.88],
  [18.462, 0.78], [18.845, 0.51], [19.089, 0.42], [19.344, 0.69], [19.588, 0.6], [19.838, 0.51],
  [20.093, 0.88], [20.465, 0.51], [20.848, 0.69], [21.092, 0.6], [21.341, 0.78], [21.852, 0.42],
  [22.09, 0.78], [22.467, 0.42],
  // Long descending voice
  [22.972, 0.51], [23.094, 0.32], [23.582, 0.42], [24.348, 0.6], [24.592, 0.51], [24.894, 0.42],
  [25.138, 0.6], [26.09, 0.51], [26.31, 0.42], [26.612, 0.32], [26.972, 0.6], [27.349, 0.42],
  [27.582, 0.51], [27.843, 0.32], [28.092, 0.69], [28.348, 0.42], [28.597, 0.51], [29.108, 0.42],
  [29.578, 0.6], [30.089, 0.32], [30.472, 0.51], [30.838, 0.42], [31.308, 0.42], [31.633, 0.6],
  [31.813, 0.51],
  // Final burst and short vocal bridge
  [32.092, 0.97], [32.464, 0.78], [32.841, 0.51], [33.34, 0.69], [33.845, 0.6], [34.089, 0.42],
  [34.495, 0.88], [34.844, 0.51], [35.343, 0.69], [35.842, 0.6], [36.092, 0.78], [36.463, 0.42],
  [36.84, 0.69], [37.09, 0.51], [37.34, 0.78], [37.839, 0.6], [38.089, 0.42], [38.489, 0.69],
  [38.843, 0.6], [39.099, 0.42], [39.348, 0.51], [39.598, 0.32], [39.847, 0.69], [40.091, 0.42],
  [40.463, 0.78], [40.84, 0.51], [41.339, 0.69], [41.844, 0.6], [42.088, 0.42], [42.471, 0.78],
  [42.843, 0.51], [43.342, 0.78], [43.598, 0.42], [43.841, 0.6], [44.091, 0.69], [44.462, 0.88],
  [44.84, 0.51], [45.339, 0.78], [45.844, 0.42], [46.094, 0.6], [46.465, 0.69], [46.842, 0.88],
  [47.342, 0.78], [47.591, 0.51], [47.847, 0.32],
];

const spec: Spec = {
  duration: 48.019, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.68], [4.1, 0.58], [8.09, 0.62], [16.47, 0.52], [22.59, 0.72], [32.09, 0.61]]),
    speed: curve([[0, 0.53], [4.1, 0.72], [8.09, 0.93], [16.47, 0.79], [22.59, 0.66], [32.09, 0.94]]),
  },
};
export default spec;
