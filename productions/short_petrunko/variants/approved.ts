/**
 * Give the quiet tick its full twenty seconds of growth. The doubled strokes tighten into a seven-stroke
 * roll, after which the rider hangs through the lone high note. The return owns the weight. The bar
 * opener is softer than the answering drum, and the bass recovery travels with that drum. Five
 * diminishing strokes close the music. The fast roll is a continuous gathering of speed; individual
 * strength differences there are uncertain.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {keyframes} from '../../../scripts/v0/core/curves.ts';

const music = {"title": "Petrunko", "audio": "productions/short_petrunko/audio.mp3", "beats": "productions/short_petrunko/audio.json", "spectrogram": {"image": "productions/short_petrunko/spectrogram.png", "metadata": "productions/short_petrunko/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Koutev Bulgarian National Ensemble", phases: [
  {"name": "Low phrase", "t0": 0, "t1": 1.96, "color": "#426582"},
  {"name": "Upper figure", "t0": 1.96, "t1": 11.48, "color": "#a45643"},
  {"name": "Build", "t0": 11.48, "t1": 19.78, "color": "#448078"},
  {"name": "Roll", "t0": 19.78, "t1": 21, "color": "#826488"},
  {"name": "Suspend", "t0": 21, "t1": 22.4, "color": "#426582"},
  {"name": "Replies", "t0": 22.4, "t1": 56, "color": "#a45643"},
  {"name": "Decay", "t0": 56, "t1": 60.0, "color": "#448078"},
]};

const strikes: [number, number][] = [
  // Low phrase
  [0.58, 0.56], [1.265, 0.1],
  // Upper figure
  [1.962, 0.11], [2.31, 0.08], [2.635, 0.13], [3.309, 0.14], [4.005, 0.16], [4.679, 0.17],
  [5.12, 0.12], [5.364, 0.19], [6.049, 0.2], [6.722, 0.21], [7.407, 0.23], [8.081, 0.24],
  [8.777, 0.26], [9.451, 0.27], [10.136, 0.29], [10.809, 0.3],
  // Build
  [11.482, 0.4], [12.167, 0.43], [12.852, 0.46], [13.526, 0.49], [14.211, 0.52], [14.896, 0.55],
  [15.569, 0.58], [16.254, 0.61], [16.939, 0.64], [17.276, 0.66], [17.612, 0.68], [17.961, 0.7],
  [18.309, 0.72], [18.646, 0.74], [18.982, 0.76], [19.331, 0.78], [19.667, 0.8],
  // Roll
  [19.841, 0.74], [20.016, 0.77], [20.19, 0.8], [20.352, 0.83], [20.538, 0.86], [20.701, 0.89],
  [20.875, 0.92],
  // Suspend
  [22.396, 1],
  // Replies
  [23.754, 0.4], [24.776, 0.76], [25.124, 0.76], [26.482, 0.4], [26.831, 0.76], [27.504, 0.76],
  [27.841, 0.76], [29.211, 0.4], [29.559, 0.76], [30.569, 0.76], [31.939, 0.4], [32.287, 0.76],
  [32.961, 0.76], [33.297, 0.76], [34.667, 0.4], [35.689, 0.76], [36.026, 0.76], [37.407, 0.4],
  [37.744, 0.76], [38.417, 0.76], [38.754, 0.76], [40.124, 0.4], [40.472, 0.76], [41.482, 0.76],
  [42.852, 0.4], [43.189, 0.76], [43.862, 0.76], [44.211, 0.76], [45.581, 0.4], [46.602, 0.76],
  [46.939, 0.76], [48.309, 0.4], [48.646, 0.76], [49.331, 0.76], [49.667, 0.76], [51.037, 0.4],
  [51.374, 0.76], [52.396, 0.76], [53.766, 0.4], [54.102, 0.76], [54.776, 0.76], [55.124, 0.76],
  // Decay
  [56.483, 0.4], [57.504, 0.36], [57.853, 0.3], [59.211, 0.2], [59.559, 0.16],
];

const spec: Spec = {
  duration: 60.0, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: keyframes([
      {t: 0, v: 0.55, ease: "smooth"}, {t: 1.3, v: 0.62, ease: "smooth"},
      {t: 11.4, v: 0.54, ease: "smooth"}, {t: 17, v: 0.42, ease: "smooth"},
      {t: 19.7, v: 0.3, ease: "smooth"}, {t: 20.9, v: 0.22, ease: "smooth"},
      {t: 21.6, v: 0.92, ease: "smooth"}, {t: 22.4, v: 0.55, ease: "smooth"},
      {t: 55.3, v: 0.55, ease: "smooth"}, {t: 56.4, v: 0.4, ease: "smooth"},
      {t: 58, v: 0.22, ease: "smooth"}, {t: 60, v: 0.12, ease: "smooth"},
    ]),
    speed: keyframes([
      {t: 0, v: 0.4, ease: "smooth"}, {t: 1.3, v: 0.34, ease: "smooth"},
      {t: 11.4, v: 0.5, ease: "smooth"}, {t: 17, v: 0.68, ease: "smooth"},
      {t: 19.7, v: 0.84, ease: "smooth"}, {t: 20.9, v: 0.95, ease: "smooth"},
      {t: 21.6, v: 0.36, ease: "smooth"}, {t: 22.2, v: 0.54, ease: "smooth"},
      {t: 22.4, v: 0.78, ease: "smooth"}, {t: 55.3, v: 0.78, ease: "smooth"},
      {t: 56.5, v: 0.5, ease: "smooth"}, {t: 60, v: 0.24, ease: "smooth"},
    ]),
  },
};
export default spec;
