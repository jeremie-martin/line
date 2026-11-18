/**
 * Start over a single drum crash. Keep the words almost level and quiet, then make the three uneven
 * kicks a repeating strong, light and pushing accent. Small percussion steps slip between them. The
 * heavy second half retains the bass anticipation and the two climbing triples. Leave the opening vocal
 * ornaments in flight. The test is whether the subdued words let the uneven cycle read more clearly.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "I Knew You Were Trouble (Taylor's Version)", "audio": "productions/short_trouble/audio.mp3", "beats": "productions/short_trouble/audio.json", "spectrogram": {"image": "productions/short_trouble/spectrogram.png", "metadata": "productions/short_trouble/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Taylor Swift", phases: [
  {"name": "Words under the crash", "t0": 0, "t1": 12.539, "color": "#426582"},
  {"name": "Five gathering words", "t0": 12.539, "t1": 14.7, "color": "#a45643"},
  {"name": "Three stresses", "t0": 14.7, "t1": 27.725, "color": "#448078"},
  {"name": "Exposed E and G", "t0": 27.725, "t1": 29.03, "color": "#826488"},
  {"name": "Anticipation and release", "t0": 29.03, "t1": 43.781, "color": "#426582"},
  {"name": "Two exposed words", "t0": 43.781, "t1": 44.646, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Words under the crash
  [0.372, 0.6], [0.848, 0.12], [1.3, 0.12], [1.742, 0.12], [2.183, 0.22], [3.518, 0.12],
  [5.793, 0.22], [6.223, 0.12], [6.676, 0.22], [7.128, 0.12], [7.558, 0.12], [8.023, 0.22],
  [8.475, 0.12], [8.928, 0.22], [9.369, 0.12], [9.834, 0.12], [10.704, 0.22], [11.122, 0.12],
  // Five gathering words
  [12.539, 0.12], [12.945, 0.12], [13.433, 0.22], [13.851, 0.22], [14.292, 0.32],
  // Three stresses
  [14.704, 0.78], [15.383, 0.51], [16.045, 0.69], [16.492, 0.78], [17.171, 0.51], [17.839, 0.69],
  [18.286, 0.78], [18.518, 0.22], [18.750, 0.13], [18.959, 0.51], [19.191, 0.12], [19.412, 0.14], [19.632, 0.69], [19.853, 0.12],
  [20.074, 0.78], [20.526, 0.15], [20.747, 0.51], [20.991, 0.22], [21.211, 0.13], [21.42, 0.69], [21.664, 0.11], [21.867, 0.78], [22.094, 0.12], [22.32, 0.12],
  [22.541, 0.51], [22.79, 0.22], [22.999, 0.13], [23.208, 0.69], [23.452, 0.12], [23.661, 0.78], [23.905, 0.14], [24.114, 0.17], [24.329, 0.51],
  [24.787, 0.22], [25.002, 0.69], [25.24, 0.12], [25.449, 0.78], [25.693, 0.12], [25.902, 0.16], [26.122, 0.51], [26.355, 0.22], [26.575, 0.14],
  [26.796, 0.69], [27.028, 0.12], [27.243, 0.78],
  // Exposed E and G
  [27.725, 0.14], [27.934, 0.08], [28.096, 0.34], [28.595, 0.13], [28.746, 0.07],
  // Anticipation and release
  [29.031, 0.97], [29.931, 0.6], [30.604, 0.42], [30.824, 0.88], [31.492, 0.78], [31.718, 0.42],
  [32.392, 0.42], [32.612, 0.88], [33.506, 0.51], [34.18, 0.42], [34.412, 0.78], [34.743, 0.88],
  [35.08, 0.97], [35.3, 0.6], [36.188, 0.88], [37.094, 0.51], [37.767, 0.42], [37.988, 0.88],
  [38.661, 0.88], [38.882, 0.51], [39.555, 0.42], [39.782, 0.88], [40.676, 0.51], [41.343, 0.42],
  [41.57, 0.78], [41.906, 0.88], [42.243, 0.97], [42.469, 0.51],
  // Two exposed words
  [43.781, 0.20], [44.234, 0.10],
];

const spec: Spec = {
  duration: 44.646, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.45], [12.539, 0.45], [14.7, 0.51], [27.725, 0.81], [29.03, 0.70], [33.51, 0.76], [35.30, 0.66], [40.68, 0.82], [41.34, 0.85], [42.47, 0.76], [43.781, 0.73]]),
    speed: curve([[0, 0.38], [12.539, 0.49], [14.7, 0.72], [27.725, 0.72], [29.03, 0.92], [33.51, 0.98], [35.30, 0.94], [40.68, 0.96], [42.47, 0.94], [43.781, 0.55]]),
  },
};
export default spec;
