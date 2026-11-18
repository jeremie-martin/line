/**
 * The first C is already in the air. Catch the C-sharp turn, leave room over the long D-sharp, and
 * follow the five gathering words. Ride the long-long-short kick pattern with its answering small
 * strokes from 18.52. Release the three exposed notes before the heavy drop. After it the bass
 * anticipates and the snare answers, while the triple kicks build their own weight. Float through the
 * cutouts, then land the two words this cut keeps. The most uncertain detail is whether the tiny
 * percussion crowds the third kick.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "I Knew You Were Trouble (Taylor's Version)", "audio": "productions/short_trouble/audio.mp3", "beats": "productions/short_trouble/audio.json", "spectrogram": {"image": "productions/short_trouble/spectrogram.png", "metadata": "productions/short_trouble/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Taylor Swift", phases: [
  {"name": "Sung arc", "t0": 0, "t1": 12.539, "color": "#426582"},
  {"name": "Five gathering words", "t0": 12.539, "t1": 14.7, "color": "#a45643"},
  {"name": "Long long short", "t0": 14.7, "t1": 27.725, "color": "#448078"},
  {"name": "Exposed E and G", "t0": 27.725, "t1": 29.03, "color": "#826488"},
  {"name": "Anticipation and release", "t0": 29.03, "t1": 43.781, "color": "#426582"},
  {"name": "Two exposed words", "t0": 43.781, "t1": 44.646, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Sung arc
  [0.453, 0.42], [0.859, 0.51], [1.3, 0.32], [1.742, 0.42], [2.217, 0.6], [2.45, 0.42],
  [3.518, 0.42], [5.793, 0.42], [6.223, 0.6], [6.676, 0.51], [7.128, 0.32], [7.558, 0.51],
  [8.023, 0.42], [8.475, 0.51], [8.928, 0.32], [9.369, 0.42], [9.834, 0.6], [10.054, 0.42],
  [10.704, 0.51],
  // Five gathering words
  [12.539, 0.32], [12.945, 0.42], [13.433, 0.51], [13.851, 0.51], [14.292, 0.6],
  // Long long short
  [14.704, 0.78], [15.383, 0.6], [16.045, 0.69], [16.492, 0.69], [17.171, 0.6], [17.839, 0.69],
  [18.286, 0.78], [18.518, 0.22], [18.959, 0.69], [19.191, 0.22], [19.632, 0.6], [19.853, 0.32],
  [20.074, 0.78], [20.526, 0.22], [20.747, 0.69], [20.991, 0.32], [21.42, 0.6], [21.867, 0.69],
  [22.32, 0.22], [22.541, 0.69], [22.79, 0.32], [23.208, 0.6], [23.452, 0.22], [23.661, 0.78],
  [24.108, 0.22], [24.329, 0.69], [24.787, 0.32], [25.002, 0.6], [25.24, 0.22], [25.449, 0.78],
  [25.902, 0.22], [26.122, 0.69], [26.355, 0.32], [26.796, 0.6], [27.028, 0.22], [27.243, 0.78],
  // Exposed E and G
  [27.725, 0.32], [28.096, 0.51], [28.595, 0.42],
  // Anticipation and release
  [29.031, 0.97], [29.931, 0.6], [30.604, 0.42], [30.824, 0.88], [31.492, 0.78], [31.718, 0.42],
  [32.392, 0.42], [32.612, 0.88], [33.506, 0.51], [34.18, 0.42], [34.412, 0.78], [34.743, 0.88],
  [35.08, 0.97], [35.3, 0.6], [36.188, 0.88], [37.094, 0.51], [37.767, 0.42], [37.988, 0.88],
  [38.661, 0.88], [38.882, 0.51], [39.555, 0.42], [39.782, 0.88], [40.676, 0.51], [41.343, 0.42],
  [41.57, 0.78], [41.906, 0.88], [42.243, 0.97], [42.469, 0.51],
  // Two exposed words
  [43.781, 0.42], [44.234, 0.32],
];

const spec: Spec = {
  duration: 44.646, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.58], [12.539, 0.55], [14.7, 0.56], [27.725, 0.81], [29.03, 0.70], [33.51, 0.76], [35.30, 0.66], [40.68, 0.82], [41.34, 0.85], [42.47, 0.76], [43.781, 0.73]]),
    speed: curve([[0, 0.47], [12.539, 0.58], [14.7, 0.77], [27.725, 0.72], [29.03, 0.92], [33.51, 0.98], [35.30, 0.94], [40.68, 0.96], [41.34, 1], [42.47, 1], [43.781, 0.55]]),
  },
};
export default spec;
