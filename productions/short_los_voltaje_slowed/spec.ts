/**
 * The voice is already calling as the cut begins. Let the repeated short notes lead, giving the drum
 * reply around 10 s a bar of its own. The increasingly exposed last words pick up into a drum-and-singer
 * duet. Catch the first word after the return independently of the kick. The later G-sharp hook broadens
 * and answers the beat with room between syllables. The treble ostinato stays underneath. At the end
 * listen for the singer continuing beyond the last low beat. Which offbeat word in the first returning
 * bar leads is uncertain.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LOS VOLTAJE (Slowed)", "audio": "productions/short_los_voltaje_slowed/audio.mp3", "beats": "productions/short_los_voltaje_slowed/audio.json", "spectrogram": {"image": "productions/short_los_voltaje_slowed/spectrogram.png", "metadata": "productions/short_los_voltaje_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Sayfalse, Yb Wasg'ood & Ariis", phases: [
  {"name": "Voice calling across space", "t0": 0, "t1": 7.03, "color": "#426582"},
  {"name": "Gathering calls", "t0": 7.03, "t1": 10.02, "color": "#a45643"},
  {"name": "Drum reply and quick voice", "t0": 10.02, "t1": 15.78, "color": "#448078"},
  {"name": "Words between kicks", "t0": 15.78, "t1": 33.28, "color": "#826488"},
  {"name": "Higher hook in the low beat", "t0": 33.28, "t1": 50.47, "color": "#426582"},
  {"name": "Last isolated words", "t0": 50.47, "t1": 51.479, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Voice calling across space
  [0.468, 0.51], [0.671, 0.32], [1.031, 0.42], [2.651, 0.6], [2.86, 0.32], [3.214, 0.51],
  [3.742, 0.42], [4.288, 0.32], [4.834, 0.51], [5.048, 0.32], [5.402, 0.42], [6.192, 0.32],
  // Gathering calls
  [7.028, 0.6], [7.312, 0.42], [7.568, 0.51], [7.887, 0.32], [8.154, 0.51], [8.653, 0.42],
  [9.222, 0.6], [9.617, 0.51], [9.779, 0.42],
  // Drum reply and quick voice
  [10.023, 0.69], [10.308, 0.42], [10.569, 0.51], [10.859, 0.69], [11.219, 0.6], [11.399, 0.32],
  [11.672, 0.51], [11.962, 0.32], [12.212, 0.42], [12.496, 0.6], [13.024, 0.51], [13.576, 0.42],
  [14.162, 0.51], [14.348, 0.42], [14.917, 0.6], [15.288, 0.32],
  // Words between kicks
  [15.776, 0.97], [16.049, 0.51], [16.6, 0.69], [17.076, 0.42], [17.256, 0.6], [17.628, 0.51],
  [17.964, 0.78], [18.382, 0.42], [18.789, 0.6], [19.137, 0.42], [19.451, 0.69], [19.7, 0.51],
  [20.153, 0.69], [20.571, 0.42], [20.977, 0.51], [21.331, 0.78], [21.529, 0.6], [21.889, 0.32],
  [22.341, 0.78], [22.887, 0.42], [23.439, 0.6], [23.653, 0.32], [23.984, 0.69], [24.373, 0.51],
  [24.53, 0.69], [24.809, 0.51], [25.354, 0.6], [25.708, 0.42], [26.016, 0.32], [26.266, 0.69],
  [26.718, 0.42], [27.548, 0.6], [27.897, 0.32], [28.361, 0.78], [28.756, 0.51], [28.977, 0.69],
  [29.453, 0.42], [30.004, 0.6], [30.213, 0.32], [30.55, 0.69], [31.159, 0.51], [31.647, 0.69],
  [32.192, 0.42], [32.413, 0.51], [32.738, 0.69],
  // Higher hook in the low beat
  [33.284, 0.6], [33.829, 0.69], [34.381, 0.42], [34.764, 0.51], [35.019, 0.32], [35.316, 0.6],
  [35.71, 0.42], [36.024, 0.69], [36.953, 0.51], [37.388, 0.78], [37.643, 0.6], [38.212, 0.51],
  [38.758, 0.32], [39.153, 0.42], [39.396, 0.69], [39.698, 0.51], [40.401, 0.6], [41.022, 0.42],
  [41.335, 0.69], [41.492, 0.51], [42.044, 0.78], [42.589, 0.42], [43.135, 0.6], [43.419, 0.32],
  [43.681, 0.69], [44.075, 0.51], [44.232, 0.69], [44.47, 0.42], [44.778, 0.6], [45.41, 0.32],
  [45.712, 0.69], [46.003, 0.51], [46.148, 0.69], [46.42, 0.42], [46.966, 0.6], [47.512, 0.32],
  [47.907, 0.78], [48.15, 0.51], [48.609, 0.69], [49.16, 0.42], [49.439, 0.6], [49.776, 0.32],
  [50.252, 0.69],
  // Last isolated words
  [50.472, 0.51], [50.815, 0.42], [51.372, 0.32],
];

const spec: Spec = {
  duration: 51.479, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.71], [7.03, 0.61], [10.02, 0.54], [15.78, 0.64], [33.28, 0.69], [50.47, 0.6]]),
    speed: curve([[0, 0.49], [7.03, 0.65], [10.02, 0.82], [15.78, 0.89], [33.28, 0.87], [50.47, 0.64]]),
  },
};
export default spec;
