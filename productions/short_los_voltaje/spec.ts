/**
 * Hear the first small calls from inside the groove. Leave the murmuring low pulse alone until a drum
 * answers the end of a word. The voice gathers and speeds up after 11 s even as its backing falls away.
 * The full drum return takes the foreground. At 23.55 the bright upper reply begins to cut across that
 * beat. Carry it through the next wave, then follow the three vocal attacks left after the drums stop.
 * The first few muted drum answers could be lighter.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LOS VOLTAJE", "audio": "productions/short_los_voltaje/audio.mp3", "beats": "productions/short_los_voltaje/audio.json", "spectrogram": {"image": "productions/short_los_voltaje/spectrogram.png", "metadata": "productions/short_los_voltaje/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Sayfalse, Yb Wasg'ood & Ariis", phases: [
  {"name": "Calls and space", "t0": 0, "t1": 6.61, "color": "#426582"},
  {"name": "Calls gather", "t0": 6.61, "t1": 11.0, "color": "#a45643"},
  {"name": "Quick naked voice", "t0": 11.0, "t1": 14.88, "color": "#448078"},
  {"name": "Drums take over", "t0": 14.88, "t1": 23.55, "color": "#826488"},
  {"name": "Bright upper replies", "t0": 23.55, "t1": 47.67, "color": "#426582"},
  {"name": "Words past the drums", "t0": 47.67, "t1": 48.352, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Calls and space
  [0.408, 0.42], [0.606, 0.32], [0.948, 0.51], [1.227, 0.42], [1.958, 0.32], [2.475, 0.51],
  [2.678, 0.6], [3.009, 0.42], [3.502, 0.32], [3.752, 0.42], [4.025, 0.51], [4.541, 0.42],
  [4.925, 0.32], [5.302, 0.51], [5.819, 0.42], [6.091, 0.6],
  // Calls gather
  [6.608, 0.6], [6.881, 0.51], [7.125, 0.42], [7.38, 0.32], [7.891, 0.51], [8.146, 0.69],
  [8.692, 0.6], [9.064, 0.42], [9.441, 0.51], [9.714, 0.69], [10.23, 0.6], [10.573, 0.32],
  // Quick naked voice
  [11.002, 0.51], [11.345, 0.42], [11.78, 0.6], [12.024, 0.32], [12.28, 0.51], [12.808, 0.42],
  [13.353, 0.6], [13.533, 0.32], [14.067, 0.51], [14.422, 0.42], [14.584, 0.51],
  // Drums take over
  [14.88, 0.97], [15.269, 0.78], [15.658, 0.51], [15.913, 0.69], [16.175, 0.42], [16.517, 0.51],
  [16.947, 0.78], [17.341, 0.69], [17.725, 0.42], [18.235, 0.51], [18.758, 0.78], [19.019, 0.6],
  [19.408, 0.69], [19.797, 0.78], [20.314, 0.51], [20.766, 0.69], [21.086, 0.42], [21.602, 0.78],
  [21.864, 0.51], [22.119, 0.69], [22.636, 0.42], [23.152, 0.6], [23.419, 0.51],
  // Bright upper replies
  [23.553, 0.42], [23.942, 0.78], [24.191, 0.51], [24.453, 0.69], [24.702, 0.6], [25.219, 0.42],
  [25.614, 0.42], [26.003, 0.51], [26.519, 0.69], [26.769, 0.6], [27.03, 0.78], [27.291, 0.51],
  [27.686, 0.42], [28.075, 0.69], [28.325, 0.6], [28.592, 0.42], [28.841, 0.78], [29.358, 0.51],
  [29.753, 0.6], [29.874, 0.42], [30.391, 0.78], [30.658, 0.69], [30.908, 0.51], [31.424, 0.78],
  [31.819, 0.42], [32.08, 0.69], [32.458, 0.6], [32.731, 0.51], [32.98, 0.69], [33.497, 0.78],
  [33.892, 0.42], [34.013, 0.6], [34.275, 0.32], [34.524, 0.69], [34.803, 0.51], [35.047, 0.78],
  [35.308, 0.42], [35.563, 0.69], [35.958, 0.6], [36.353, 0.51], [36.602, 0.78], [36.864, 0.42],
  [37.113, 0.6], [37.63, 0.32], [38.025, 0.69], [38.414, 0.51], [38.669, 0.78], [38.936, 0.42],
  [39.186, 0.69], [39.702, 0.6], [39.964, 0.51], [40.091, 0.78], [40.492, 0.42], [40.73, 0.6],
  [41.003, 0.32], [41.252, 0.69], [41.769, 0.51], [42.164, 0.6], [42.553, 0.42], [42.802, 0.51],
  [43.063, 0.78], [43.58, 0.69], [43.841, 0.6], [44.352, 0.78], [44.619, 0.42], [44.869, 0.69],
  [45.142, 0.32], [45.391, 0.6], [45.908, 0.51], [46.303, 0.6], [46.692, 0.42], [46.941, 0.78],
  [47.202, 0.69], [47.458, 0.51],
  // Words past the drums
  [47.667, 0.51], [47.992, 0.42], [48.172, 0.32],
];

const spec: Spec = {
  duration: 48.352, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.63], [6.61, 0.57], [11.0, 0.49], [14.88, 0.65], [23.55, 0.57], [47.67, 0.53]]),
    speed: curve([[0, 0.48], [6.61, 0.67], [11.0, 0.87], [14.88, 0.93], [23.55, 0.87], [47.67, 0.71]]),
  },
};
export default spec;
