/**
 * Group the chopped opening into three calls. The dry low boom interrupts the last one, then its spaced
 * 808 strokes own the phrase while two words still answer. Give the downbeat of the full band and the
 * displaced bass and upper replies separate catches. In the middle let the solitary hey break the
 * pattern. Restore the same weight when the bass answers again. The three closing words lead into two
 * soft echoes. The first distant chop is the most uncertain accent.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "Amor Na Praia (Slowed)", "audio": "productions/short_amor_na_praia_46s/audio.mp3", "beats": "productions/short_amor_na_praia_46s/audio.json", "spectrogram": {"image": "productions/short_amor_na_praia_46s/spectrogram.png", "metadata": "productions/short_amor_na_praia_46s/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Flame Runner", phases: [
  {"name": "Three clipped calls", "t0": 0, "t1": 4.46, "color": "#426582"},
  {"name": "Dry 808 burst", "t0": 4.46, "t1": 9.13, "color": "#a45643"},
  {"name": "Band and displaced replies", "t0": 9.13, "t1": 26.29, "color": "#448078"},
  {"name": "Hey and re-entry", "t0": 26.29, "t1": 27.28, "color": "#826488"},
  {"name": "Low duet resumes", "t0": 27.28, "t1": 43.24, "color": "#426582"},
  {"name": "Chops and low echoes", "t0": 43.24, "t1": 46, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Three clipped calls
  [0.337, 0.6], [0.865, 0.32], [1.132, 0.51], [1.672, 0.32], [2.038, 0.42], [2.548, 0.6],
  [3.082, 0.42], [3.611, 0.32], [3.913, 0.51],
  // Dry 808 burst
  [4.458, 0.97], [4.731, 0.51], [5.277, 0.69], [5.828, 0.6], [6.38, 0.69], [6.931, 0.42],
  [7.192, 0.32], [7.755, 0.69], [8.04, 0.42], [8.481, 0.32], [8.684, 0.51],
  // Band and displaced replies
  [9.131, 0.97], [9.543, 0.42], [9.967, 0.6], [10.228, 0.32], [10.519, 0.69], [10.78, 0.51],
  [11.059, 0.6], [11.331, 0.78], [11.622, 0.42], [11.883, 0.69], [12.161, 0.32], [12.434, 0.6],
  [12.98, 0.42], [13.125, 0.69], [13.531, 0.88], [13.944, 0.42], [14.362, 0.6], [14.629, 0.32],
  [14.913, 0.69], [15.18, 0.51], [15.459, 0.69], [15.732, 0.42], [16.01, 0.6], [16.283, 0.32],
  [16.562, 0.51], [16.834, 0.78], [17.119, 0.42], [17.38, 0.69], [17.665, 0.6], [17.932, 0.32],
  [18.35, 0.78], [18.762, 0.51], [19.04, 0.78], [19.313, 0.42], [19.58, 0.6], [19.859, 0.32],
  [20.132, 0.69], [20.41, 0.51], [20.683, 0.69], [20.962, 0.42], [21.235, 0.6], [21.525, 0.32],
  [21.78, 0.51], [22.332, 0.78], [22.75, 0.42], [23.156, 0.69], [23.429, 0.6], [23.708, 0.32],
  [23.98, 0.78], [24.265, 0.51], [24.532, 0.69], [24.811, 0.42], [25.083, 0.6], [25.362, 0.32],
  [25.641, 0.51],
  // Hey and re-entry
  [26.285, 0.51], [26.732, 0.97],
  // Low duet resumes
  [27.283, 0.69], [27.562, 0.42], [27.835, 0.6], [28.108, 0.32], [28.386, 0.78], [28.659, 0.51],
  [28.932, 0.69], [29.211, 0.42], [29.484, 0.6], [29.762, 0.32], [30.035, 0.51], [30.569, 0.78],
  [30.72, 0.42], [31.132, 0.69], [31.55, 0.6], [31.962, 0.32], [32.229, 0.78], [32.508, 0.51],
  [32.781, 0.69], [33.065, 0.42], [33.309, 0.6], [33.611, 0.32], [33.884, 0.51], [34.441, 0.78],
  [34.714, 0.42], [34.987, 0.69], [35.132, 0.6], [35.532, 0.32], [35.95, 0.78], [36.084, 0.51],
  [36.635, 0.69], [36.914, 0.42], [37.181, 0.6], [37.46, 0.32], [37.732, 0.51], [38.284, 0.78],
  [38.563, 0.42], [38.841, 0.69], [39.114, 0.6], [39.381, 0.32], [39.665, 0.78], [39.933, 0.51],
  [40.484, 0.69], [40.763, 0.42], [41.03, 0.6], [41.308, 0.32], [41.587, 0.51], [42.121, 0.78],
  [42.551, 0.42], [42.684, 0.69], [42.963, 0.6],
  // Chops and low echoes
  [43.241, 0.6], [43.514, 0.32], [43.892, 0.42], [44.339, 0.51], [44.931, 0.32], [45.72, 0.22],
];

const spec: Spec = {
  duration: 46, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.62], [4.46, 0.66], [9.13, 0.58], [26.29, 0.72], [27.28, 0.55], [43.24, 0.52]]),
    speed: curve([[0, 0.48], [4.46, 0.81], [9.13, 0.86], [26.29, 0.84], [27.28, 0.88], [43.24, 0.48]]),
  },
};
export default spec;
