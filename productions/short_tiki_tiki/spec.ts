/**
 * Let the five-word motif and its lone breath brush the track. Build through the breathy words and open
 * on the fat fourth beat. Keep the pickup snares, the two distinct syllables into beat three and the
 * chord stabs that distinguish the bars. The two softer booms continue under the reset. The four closing
 * kicks are a second peak, then the voice alone goes all the way to its final note. Leave the hats and
 * close bass shadows underneath. The main video question is whether the breath still shows at this
 * scale.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {keyframes} from '../../scripts/v0/core/curves.ts';

const music = {"title": "TIKI TIKI (Slowed)", "audio": "productions/short_tiki_tiki/audio.mp3", "beats": "productions/short_tiki_tiki/audio.json", "spectrogram": {"image": "productions/short_tiki_tiki/spectrogram.png", "metadata": "productions/short_tiki_tiki/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "QMIIR", phases: [
  {"name": "Voice", "t0": 0, "t1": 4.9, "color": "#426582"},
  {"name": "Silence", "t0": 4.9, "t1": 7.001, "color": "#a45643"},
  {"name": "Build", "t0": 7.001, "t1": 9.6, "color": "#448078"},
  {"name": "Cut", "t0": 9.6, "t1": 10.472, "color": "#826488"},
  {"name": "Groove", "t0": 10.472, "t1": 24.381, "color": "#426582"},
  {"name": "Boom / reset", "t0": 24.381, "t1": 27.864, "color": "#a45643"},
  {"name": "Run", "t0": 27.864, "t1": 39.172, "color": "#448078"},
  {"name": "Run end", "t0": 39.172, "t1": 41.784, "color": "#826488"},
  {"name": "Voice outro", "t0": 41.784, "t1": 48.0, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Voice
  [0.406, 0.1], [0.929, 0.1], [1.277, 0.1], [1.846, 0.1], [2.705, 0.1], [3.32, 0.08],
  [3.576, 0.09], [3.855, 0.1], [4.156, 0.11], [4.423, 0.12], [4.853, 0.06],
  // Silence
  [5.271, 0.08],
  // Build
  [7.001, 0.34], [7.372, 0.18], [7.872, 0.4], [8.243, 0.22], [8.731, 0.46], [9.102, 0.26],
  // Cut
  [9.66, 0.54], [9.961, 0.3],
  // Groove
  [10.472, 1], [10.913, 0.4], [11.122, 0.54], [11.343, 0.66], [11.773, 0.48], [12.214, 0.62],
  [12.643, 0.48], [12.875, 0.5], [13.073, 0.62], [13.351, 0.36], [13.526, 0.56], [13.955, 0.9],
  [14.396, 0.42], [14.605, 0.54], [14.826, 0.66], [15.256, 0.48], [15.685, 0.68], [16.126, 0.48],
  [16.358, 0.5], [16.556, 0.8], [16.985, 0.84], [17.427, 0.92], [17.868, 0.42], [18.088, 0.54],
  [18.297, 0.66], [18.727, 0.48], [19.168, 0.64], [19.598, 0.48], [19.841, 0.5], [20.039, 0.64],
  [20.48, 0.62], [20.944, 0.94], [21.351, 0.46], [21.56, 0.54], [21.78, 0.68], [22.21, 0.48],
  [22.639, 0.7], [22.895, 0.5], [23.081, 0.48], [23.324, 0.52], [23.51, 0.64], [23.975, 0.42],
  // Boom / reset
  [24.381, 0.55], [25.252, 0.4], [26.122, 0.36], [26.482, 0.16], [26.796, 0.18], [27.04, 0.2],
  [27.458, 0.12],
  // Run
  [27.864, 0.95], [28.317, 0.42], [28.514, 0.6], [28.735, 0.7], [29.176, 0.54], [29.605, 0.66],
  [30.035, 0.54], [30.279, 0.5], [30.476, 0.66], [30.917, 0.56], [31.347, 0.92], [31.788, 0.42],
  [31.997, 0.6], [32.218, 0.7], [32.647, 0.54], [33.077, 0.7], [33.518, 0.54], [33.762, 0.5],
  [33.948, 0.8], [34.377, 0.84], [34.818, 0.92], [35.26, 0.42], [35.468, 0.6], [35.689, 0.7],
  [36.13, 0.54], [36.56, 0.68], [37.001, 0.54], [37.222, 0.46], [37.431, 0.68], [37.872, 0.56],
  [38.301, 0.95], [38.731, 0.42], [38.975, 0.42],
  // Run end
  [39.172, 0.42], [39.602, 0.92], [40.054, 0.34], [40.472, 0.94], [40.902, 0.92], [41.366, 0.38],
  // Voice outro
  [41.784, 0.98], [42.237, 0.1], [42.655, 0.1], [43.003, 0.1], [43.537, 0.1], [44.408, 0.1],
  [45.012, 0.12], [45.256, 0.11], [45.534, 0.1], [45.836, 0.09], [46.103, 0.08], [46.602, 0.06],
  [46.916, 0.06], [47.322, 0.06],
];

const spec: Spec = {
  duration: 48.0, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: keyframes([
      {t: 0, v: 0.5, ease: "smooth"}, {t: 4.5, v: 0.55, ease: "smooth"},
      {t: 4.9, v: 0.7, ease: "smooth"}, {t: 5.4, v: 0.88, ease: "smooth"},
      {t: 6.8, v: 0.6, ease: "smooth"}, {t: 9.5, v: 0.55, ease: "smooth"},
      {t: 9.95, v: 0.58, ease: "smooth"}, {t: 10.25, v: 0.74, ease: "smooth"},
      {t: 10.472, v: 0.54, ease: "smooth"}, {t: 24, v: 0.54, ease: "smooth"},
      {t: 24.381, v: 0.64, ease: "smooth"}, {t: 26.3, v: 0.62, ease: "smooth"},
      {t: 27.864, v: 0.52, ease: "smooth"}, {t: 38.4, v: 0.52, ease: "smooth"},
      {t: 39.3, v: 0.66, ease: "smooth"}, {t: 41.784, v: 0.66, ease: "smooth"},
      {t: 42.6, v: 0.46, ease: "smooth"}, {t: 46.2, v: 0.36, ease: "smooth"},
      {t: 46.9, v: 0.18, ease: "smooth"}, {t: 48, v: 0.12, ease: "smooth"},
    ]),
    speed: keyframes([
      {t: 0, v: 0.38, ease: "smooth"}, {t: 4.9, v: 0.36, ease: "smooth"},
      {t: 7.001, v: 0.44, ease: "smooth"}, {t: 9.9, v: 0.64, ease: "smooth"},
      {t: 10.472, v: 0.76, ease: "smooth"}, {t: 20, v: 0.8, ease: "smooth"},
      {t: 24, v: 0.8, ease: "smooth"}, {t: 24.381, v: 0.56, ease: "smooth"},
      {t: 26.4, v: 0.5, ease: "smooth"}, {t: 27.6, v: 0.56, ease: "smooth"},
      {t: 27.864, v: 0.86, ease: "smooth"}, {t: 38.3, v: 0.92, ease: "smooth"},
      {t: 39.6, v: 0.96, ease: "smooth"}, {t: 40.9, v: 0.96, ease: "smooth"},
      {t: 41.784, v: 0.84, ease: "smooth"}, {t: 43, v: 0.46, ease: "smooth"},
      {t: 46.9, v: 0.34, ease: "smooth"}, {t: 48, v: 0.26, ease: "smooth"},
    ]),
  },
};
export default spec;
