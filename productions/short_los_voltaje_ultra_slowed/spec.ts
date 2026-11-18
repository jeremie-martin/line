/**
 * Land the soft exposed calls in pairs and let the answering bass strokes travel between them. The
 * accelerating phrase becomes bare before the broad drum at 16.29. Use the low notes and their short
 * drum answers through the first return. At 27 s the F refrain answers the huge low beat. Keep both
 * subjects, including the split low turn at 31.88–32.21. In the last wave the wider gaps carry offbeat
 * words; the middle instrument stays out. The tail leaves four small vocal attacks. The balance of
 * weight on the F and its following drum is the open question.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LOS VOLTAJE (Ultra Slowed)", "audio": "productions/short_los_voltaje_ultra_slowed/audio.mp3", "beats": "productions/short_los_voltaje_ultra_slowed/audio.json", "spectrogram": {"image": "productions/short_los_voltaje_ultra_slowed/spectrogram.png", "metadata": "productions/short_los_voltaje_ultra_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Sayfalse, Yb Wasg'ood & Ariis", phases: [
  {"name": "Soft calls", "t0": 0, "t1": 5.69, "color": "#426582"},
  {"name": "Longer sentence", "t0": 5.69, "t1": 11.18, "color": "#a45643"},
  {"name": "Exposed quickening", "t0": 11.18, "t1": 16.29, "color": "#448078"},
  {"name": "Broad drum and short answers", "t0": 16.29, "t1": 27.028, "color": "#826488"},
  {"name": "F against low drum", "t0": 27.028, "t1": 37.51, "color": "#426582"},
  {"name": "Heavy downbeats and words", "t0": 37.51, "t1": 58.34, "color": "#a45643"},
  {"name": "Four exposed syllables", "t0": 58.34, "t1": 60.0, "color": "#448078"},
]};

const strikes: [number, number][] = [
  // Soft calls
  [0.377, 0.51], [0.865, 0.32], [1.074, 0.42], [1.428, 0.32], [2.02, 0.32], [2.473, 0.42],
  [3.03, 0.51], [3.274, 0.42], [3.721, 0.32], [4.354, 0.51], [4.673, 0.32], [5.132, 0.42],
  // Longer sentence
  [5.689, 0.6], [6.031, 0.42], [6.339, 0.51], [7.047, 0.32], [7.512, 0.51], [7.767, 0.42],
  [8.342, 0.6], [8.58, 0.42], [9.027, 0.51], [9.665, 0.32], [9.979, 0.69], [10.327, 0.6],
  [10.768, 0.51], [10.989, 0.42],
  // Exposed quickening
  [11.18, 0.42], [11.482, 0.32], [11.674, 0.51], [12.011, 0.42], [12.318, 0.6], [12.632, 0.51],
  [12.98, 0.32], [13.322, 0.6], [13.63, 0.42], [14.129, 0.51], [14.559, 0.42], [15.25, 0.32],
  [15.697, 0.51],
  // Broad drum and short answers
  [16.289, 0.97], [16.788, 0.69], [17.293, 0.51], [17.955, 0.78], [18.28, 0.42], [18.942, 0.6],
  [19.447, 0.69], [19.946, 0.78], [20.271, 0.69], [20.608, 0.42], [20.933, 0.6], [21.264, 0.78],
  [21.6, 0.51], [22.1, 0.78], [22.599, 0.69], [23.261, 0.6], [23.684, 0.42], [24.247, 0.78],
  [24.915, 0.51], [25.252, 0.69], [25.577, 0.42], [25.913, 0.6], [26.239, 0.32], [26.511, 0.78],
  [26.9, 0.51],
  // F against low drum
  [27.028, 0.51], [27.574, 0.78], [28.235, 0.69], [28.897, 0.6], [29.176, 0.42], [29.559, 0.69],
  [29.907, 0.42], [30.221, 0.78], [30.883, 0.51], [31.045, 0.69], [31.544, 0.42], [31.869, 0.6],
  [32.206, 0.78], [32.879, 0.51], [33.541, 0.69], [34.011, 0.42], [34.203, 0.78], [34.679, 0.32],
  [34.865, 0.78], [35.527, 0.69], [36.188, 0.78], [36.478, 0.42], [36.85, 0.69], [37.14, 0.42],
  // Heavy downbeats and words
  [37.512, 0.97], [38.023, 0.78], [38.51, 0.69], [38.94, 0.42], [39.178, 0.78], [39.578, 0.51],
  [40.159, 0.78], [40.455, 0.42], [41.169, 0.78], [41.587, 0.42], [41.831, 0.69], [42.272, 0.51],
  [42.487, 0.78], [42.818, 0.69], [43.323, 0.78], [43.822, 0.69], [44.246, 0.42], [44.484, 0.78],
  [44.925, 0.32], [45.47, 0.78], [45.709, 0.42], [45.981, 0.69], [46.411, 0.42], [46.881, 0.42],
  [47.09, 0.42], [47.462, 0.78], [48.123, 0.69], [48.71, 0.51], [49.128, 0.78], [49.563, 0.42],
  [49.789, 0.78], [50.387, 0.42], [50.782, 0.69], [51.101, 0.42], [51.444, 0.97], [51.78, 0.51],
  [52.198, 0.78], [52.57, 0.51], [53.104, 0.69], [53.435, 0.6], [53.934, 0.78], [54.19, 0.42],
  [54.433, 0.69], [54.851, 0.42], [55.089, 0.78], [55.496, 0.51], [56.082, 0.69], [56.32, 0.42],
  [56.587, 0.78], [56.842, 0.51], [57.092, 0.69], [57.702, 0.42], [58.073, 0.78],
  // Four exposed syllables
  [58.34, 0.51], [58.77, 0.42], [59.24, 0.32], [59.431, 0.32],
];

const spec: Spec = {
  duration: 60.0, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.68], [5.69, 0.65], [11.18, 0.54], [16.29, 0.74], [27.028, 0.69], [37.51, 0.73], [58.34, 0.61]]),
    speed: curve([[0, 0.44], [5.69, 0.59], [11.18, 0.78], [16.29, 0.91], [27.028, 0.88], [37.51, 0.95], [58.34, 0.63]]),
  },
};
export default spec;
