/**
 * Begin on the swaying upper notes already in progress. The isolated low answers interrupt a slower
 * vocal line. Over the tightening drums let the voice become a pickup, then set down on the full kick.
 * The middle alternates low pulse with sung B and an upper syncopation. At 32.13 the bass answers more
 * broadly. Return to the upper line and take the last vocal pair over the decay. The displaced words
 * just before the bass phrase could read a little late.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "Amor Na Praia (Slowed)", "audio": "productions/short_amor_na_praia/audio.mp3", "beats": "productions/short_amor_na_praia/audio.json", "spectrogram": {"image": "productions/short_amor_na_praia/spectrogram.png", "metadata": "productions/short_amor_na_praia/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Flame Runner", phases: [
  {"name": "Tail of the upper phrase", "t0": 0, "t1": 2.23, "color": "#426582"},
  {"name": "Isolated drum under the voice", "t0": 2.23, "t1": 9.56, "color": "#a45643"},
  {"name": "Run-up", "t0": 9.56, "t1": 11.99, "color": "#448078"},
  {"name": "Pulse and sung B", "t0": 11.99, "t1": 21.75, "color": "#826488"},
  {"name": "Upper response then fast words", "t0": 21.75, "t1": 32.13, "color": "#426582"},
  {"name": "Bass answers", "t0": 32.13, "t1": 41.88, "color": "#a45643"},
  {"name": "Upper reprise and the closing voice", "t0": 41.88, "t1": 52.351, "color": "#448078"},
]};

const strikes: [number, number][] = [
  // Tail of the upper phrase
  [0.728, 0.42], [1.18, 0.51], [1.337, 0.42], [1.79, 0.32], [1.947, 0.42],
  // Isolated drum under the voice
  [2.231, 0.78], [2.643, 0.42], [3.108, 0.6], [3.723, 0.51], [3.961, 0.32], [4.112, 0.42],
  [4.687, 0.69], [5.093, 0.51], [5.29, 0.42], [5.598, 0.32], [6.062, 0.6], [6.492, 0.69],
  [6.811, 0.42], [7.113, 0.42], [7.728, 0.6], [7.978, 0.51], [8.361, 0.42], [8.953, 0.32],
  // Run-up
  [9.557, 0.32], [9.841, 0.42], [10.149, 0.51], [10.48, 0.42], [10.782, 0.6], [11.06, 0.42],
  [11.502, 0.51],
  // Pulse and sung B
  [11.995, 0.97], [12.61, 0.6], [12.918, 0.42], [13.214, 0.69], [13.528, 0.42], [13.824, 0.51],
  [14.143, 0.69], [14.433, 0.42], [14.752, 0.51], [15.049, 0.69], [15.362, 0.6], [15.652, 0.32],
  [16.268, 0.69], [16.384, 0.51], [16.877, 0.32], [17.341, 0.6], [17.492, 0.42], [17.951, 0.69],
  [18.253, 0.6], [18.561, 0.51], [18.711, 0.42], [19.019, 0.69], [19.321, 0.32], [19.78, 0.6],
  [20.081, 0.69], [20.534, 0.51], [21.26, 0.42],
  // Upper response then fast words
  [21.753, 0.78], [22.218, 0.6], [22.682, 0.42], [23.292, 0.51], [23.744, 0.69], [24.197, 0.32],
  [24.505, 0.6], [25.114, 0.42], [25.573, 0.51], [26.032, 0.69], [26.316, 0.32], [26.641, 0.6],
  [27.094, 0.51], [27.552, 0.42], [27.86, 0.6], [28.162, 0.32], [28.621, 0.69], [29.079, 0.42],
  [29.393, 0.51], [29.845, 0.42], [30.298, 0.6], [30.606, 0.32], [31.024, 0.51], [31.517, 0.42],
  // Bass answers
  [32.127, 0.97], [32.44, 0.42], [32.742, 0.6], [33.044, 0.69], [33.352, 0.42], [33.967, 0.51],
  [34.269, 0.69], [34.571, 0.6], [34.878, 0.42], [35.18, 0.51], [35.488, 0.32], [35.772, 0.69],
  [36.103, 0.51], [36.399, 0.69], [37.009, 0.6], [37.322, 0.42], [37.618, 0.78], [37.938, 0.51],
  [38.228, 0.69], [38.547, 0.42], [38.814, 0.6], [39.308, 0.32], [39.447, 0.69], [39.76, 0.51],
  [40.062, 0.69], [40.376, 0.42], [40.672, 0.6], [41.287, 0.51],
  // Upper reprise and the closing voice
  [41.885, 0.78], [42.198, 0.42], [42.808, 0.6], [43.272, 0.51], [43.719, 0.32], [44.027, 0.69],
  [44.642, 0.51], [45.095, 0.6], [45.536, 0.42], [45.861, 0.69], [46.157, 0.32], [46.622, 0.51],
  [47.075, 0.6], [47.382, 0.42], [47.684, 0.51], [47.992, 0.32], [48.299, 0.6], [48.578, 0.42],
  [48.892, 0.51], [49.066, 0.42], [49.519, 0.6], [49.82, 0.32], [50.43, 0.69], [50.72, 0.42],
  [51.051, 0.32],
];

const spec: Spec = {
  duration: 52.351, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.65], [2.23, 0.59], [9.56, 0.76], [11.99, 0.59], [21.75, 0.56], [32.13, 0.69], [41.88, 0.57]]),
    speed: curve([[0, 0.46], [2.23, 0.59], [9.56, 0.85], [11.99, 0.88], [21.75, 0.76], [32.13, 0.94], [41.88, 0.78]]),
  },
};
export default spec;
