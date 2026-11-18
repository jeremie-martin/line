/**
 * The faster cut begins inside a vocal pickup. Take its two upper swells separately before the first low
 * beat. The three-and-short-answer drum figure carries the first body. The bass begins answering in
 * longer, uneven phrases around 18.45. Leave the treble doubling alone and take the little drum fills
 * where the bass pauses. The four uncovered drums lead into a quiet sung ending with a C reply and a
 * long tail. Its last faint low sound may belong to the held vowel.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LUNA BALA", "audio": "productions/short_luna_bala_original/audio.mp3", "beats": "productions/short_luna_bala_original/audio.json", "spectrogram": {"image": "productions/short_luna_bala_original/spectrogram.png", "metadata": "productions/short_luna_bala_original/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Ariis & Yb Wasg'ood", phases: [
  {"name": "End of the sung pickup", "t0": 0, "t1": 3.69, "color": "#426582"},
  {"name": "Broken percussion", "t0": 3.69, "t1": 18.45, "color": "#a45643"},
  {"name": "Low answering sentences", "t0": 18.45, "t1": 31.84, "color": "#448078"},
  {"name": "Uncovered drum tail", "t0": 31.84, "t1": 33.23, "color": "#826488"},
  {"name": "A-sharp and C-sharp answer", "t0": 33.23, "t1": 39.373, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // End of the sung pickup
  [0.342, 0.32], [1.41, 0.51], [2.019, 0.42], [2.414, 0.32], [2.757, 0.42], [3.024, 0.51],
  [3.447, 0.51],
  // Broken percussion
  [3.685, 0.97], [4.04, 0.69], [4.382, 0.51], [4.835, 0.6], [5.531, 0.78], [5.88, 0.32],
  [6.222, 0.69], [6.681, 0.6], [7.145, 0.78], [7.377, 0.51], [7.731, 0.69], [8.068, 0.42],
  [8.527, 0.78], [9.223, 0.69], [9.572, 0.51], [9.914, 0.6], [10.152, 0.78], [10.605, 0.69],
  [11.069, 0.42], [11.418, 0.78], [11.772, 0.51], [12.219, 0.69], [12.915, 0.78], [13.264, 0.69],
  [13.612, 0.51], [14.071, 0.6], [14.529, 0.78], [14.761, 0.42], [15.11, 0.51], [15.922, 0.78],
  [16.607, 0.69], [16.961, 0.42], [17.298, 0.69], [17.53, 0.6], [17.762, 0.51], [17.989, 0.42],
  // Low answering sentences
  [18.459, 0.88], [18.813, 0.6], [19.161, 0.51], [19.62, 0.69], [19.846, 0.42], [20.079, 0.78],
  [20.52, 0.51], [20.996, 0.42], [21.46, 0.6], [22.157, 0.78], [22.499, 0.6], [23.312, 0.51],
  [23.538, 0.69], [24.003, 0.42], [24.351, 0.78], [24.688, 0.51], [24.914, 0.42], [25.379, 0.69],
  [25.837, 0.6], [26.069, 0.51], [26.302, 0.32], [27.033, 0.42], [27.457, 0.69], [27.683, 0.42],
  [28.148, 0.51], [28.386, 0.6], [28.838, 0.69], [29.071, 0.78], [29.541, 0.51], [29.999, 0.51],
  [30.458, 0.42], [30.922, 0.6], [31.381, 0.69],
  // Uncovered drum tail
  [31.84, 0.6], [32.298, 0.42], [32.763, 0.51],
  // A-sharp and C-sharp answer
  [33.233, 0.51], [33.691, 0.32], [34.028, 0.42], [35.073, 0.32], [35.543, 0.51], [35.874, 0.32],
  [36.002, 0.22], [36.913, 0.51], [37.169, 0.42], [37.499, 0.32], [37.848, 0.42], [38.771, 0.22],
];

const spec: Spec = {
  duration: 39.373, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.6], [3.69, 0.53], [18.45, 0.68], [31.84, 0.65], [33.23, 0.77]]),
    speed: curve([[0, 0.58], [3.69, 0.86], [18.45, 0.83], [31.84, 0.7], [33.23, 0.47]]),
  },
};
export default spec;
