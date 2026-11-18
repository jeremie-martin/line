/**
 * Enter on the quiet spoken bridge and carry the held vowel. The lower D-sharp/E/F words stand above
 * three bass entries. Sharpen the pickups into the chorus, where the heavy stroke and its low answer get
 * the floor before the singer returns between beats. In the second chorus follow the long lower notes
 * into clipped C turns. Leave the intervening guitar edges alone. The final drum fill answers the last
 * sung line, with room for its closing resonance. The early chorus bass accent is the choice to check.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "Bones", "audio": "productions/short_bones/audio.mp3", "beats": "productions/short_bones/audio.json", "spectrogram": {"image": "productions/short_bones/spectrogram.png", "metadata": "productions/short_bones/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Imagine Dragons", phases: [
  {"name": "Spoken bridge", "t0": 0, "t1": 4.62, "color": "#426582"},
  {"name": "Lower register", "t0": 4.62, "t1": 11.22, "color": "#a45643"},
  {"name": "Sharpening pickup", "t0": 11.22, "t1": 13.3, "color": "#448078"},
  {"name": "Chorus beat and bass answer", "t0": 13.3, "t1": 30.14, "color": "#826488"},
  {"name": "Held lower voice and clipped turns", "t0": 30.14, "t1": 38.56, "color": "#426582"},
  {"name": "Last vocal over broad lows", "t0": 38.56, "t1": 48.423, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Spoken bridge
  [0.276, 0.22], [0.537, 0.12], [1.622, 0.32], [2.122, 0.22], [2.632, 0.32], [2.957, 0.22],
  [3.323, 0.32],
  // Lower register
  [4.635, 0.51], [4.838, 0.32], [5.128, 0.42], [5.512, 0.42], [5.901, 0.51], [6.336, 0.42],
  [6.974, 0.6], [7.683, 0.32], [7.99, 0.51], [8.437, 0.42], [8.815, 0.32], [9.058, 0.69],
  [9.709, 0.42], [10.527, 0.51], [10.922, 0.42],
  // Sharpening pickup
  [11.224, 0.42], [11.938, 0.51], [12.222, 0.6], [12.512, 0.69], [12.768, 0.42],
  // Chorus beat and bass answer
  [13.302, 0.97], [13.83, 0.78], [14.091, 0.42], [14.364, 0.69], [14.852, 0.88], [15.148, 0.51],
  [15.403, 0.69], [15.705, 0.88], [15.914, 0.78], [16.471, 0.69], [16.982, 0.51], [17.511, 0.78],
  [17.789, 0.42], [18.039, 0.6], [18.3, 0.42], [18.521, 0.78], [19.043, 0.51], [19.612, 0.69],
  [19.879, 0.6], [20.123, 0.78], [20.407, 0.69], [20.663, 0.6], [21.133, 0.42], [21.719, 0.51],
  [22.004, 0.6], [22.509, 0.42], [22.77, 0.69], [23.252, 0.78], [23.565, 0.51], [23.832, 0.69],
  [24.099, 0.42], [24.331, 0.78], [24.622, 0.51], [24.889, 0.42], [25.37, 0.69], [25.759, 0.6],
  [25.928, 0.78], [26.462, 0.51], [26.717, 0.69], [26.99, 0.42], [27.257, 0.6], [27.513, 0.69],
  [28.041, 0.78], [28.302, 0.51], [28.546, 0.42], [29.057, 0.6], [29.614, 0.51],
  // Held lower voice and clipped turns
  [30.142, 0.78], [30.67, 0.51], [30.932, 0.69], [31.228, 0.42], [31.681, 0.6], [32.244, 0.69],
  [32.778, 0.51], [33.033, 0.6], [33.3, 0.32], [33.538, 0.69], [34.095, 0.42], [34.351, 0.78],
  [34.879, 0.51], [35.343, 0.69], [35.616, 0.42], [35.941, 0.6], [36.458, 0.69], [36.719, 0.6],
  [36.963, 0.42], [37.247, 0.32], [37.491, 0.51], [37.996, 0.42],
  // Last vocal over broad lows
  [38.559, 0.78], [39.088, 0.51], [39.622, 0.69], [40.098, 0.42], [40.562, 0.6], [40.672, 0.78],
  [41.201, 0.69], [41.456, 0.51], [41.688, 0.42], [41.961, 0.6], [42.246, 0.32], [42.513, 0.69],
  [42.768, 0.51], [43.302, 0.78], [43.558, 0.42], [43.813, 0.6], [44.092, 0.51], [44.353, 0.51],
  [44.602, 0.78], [44.881, 0.69], [45.142, 0.6], [45.392, 0.51], [45.659, 0.42], [45.926, 0.78],
  [46.425, 0.69],
];

const spec: Spec = {
  duration: 48.423, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.57], [4.62, 0.62], [11.22, 0.67], [13.3, 0.62], [30.14, 0.69], [38.56, 0.62]]),
    speed: curve([[0, 0.42], [4.62, 0.58], [11.22, 0.81], [13.3, 0.94], [30.14, 0.85], [38.56, 0.9]]),
  },
};
export default spec;
