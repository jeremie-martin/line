/**
 * Carry the cut-in vowel, catch its turn and let the breath at 3.5 s hang. The next words gather over
 * two low notes into the drop. Keep the drum and its syncopated bass answer distinct, thinning the
 * doubling treble. When bass vanishes the four toms get quiet upper answers. In the return let the later
 * snare strokes interrupt the low line. The last kick cuts to residual sound. The strength of the second
 * bass reply in a pair is the uncertain part.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LUNA BALA (Slowed)", "audio": "productions/short_luna_bala_44s/audio.mp3", "beats": "productions/short_luna_bala_44s/audio.json", "spectrogram": {"image": "productions/short_luna_bala_44s/spectrogram.png", "metadata": "productions/short_luna_bala_44s/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Yb Wasg'ood & Ariis", phases: [
  {"name": "Solo voice", "t0": 0, "t1": 8.615, "color": "#426582"},
  {"name": "Kick and crooked bass answer", "t0": 8.615, "t1": 23.88, "color": "#a45643"},
  {"name": "Four toms", "t0": 23.88, "t1": 26.05, "color": "#448078"},
  {"name": "Bass and snare answers", "t0": 26.05, "t1": 44, "color": "#826488"},
]};

const strikes: [number, number][] = [
  // Solo voice
  [0.435, 0.32], [1.033, 0.42], [1.393, 0.51], [2.072, 0.32], [2.403, 0.42], [3.216, 0.32],
  [4.499, 0.32], [4.661, 0.42], [5.741, 0.51], [5.927, 0.42], [6.438, 0.51], [6.96, 0.6],
  [7.314, 0.32], [7.517, 0.42], [8.098, 0.51],
  // Kick and crooked bass answer
  [8.62, 0.97], [9.027, 0.69], [9.509, 0.51], [9.979, 0.69], [10.478, 0.32], [10.791, 0.78],
  [11.204, 0.51], [11.622, 0.78], [11.889, 0.51], [12.161, 0.69], [12.428, 0.42], [12.701, 0.32],
  [12.974, 0.78], [13.392, 0.69], [13.798, 0.6], [14.338, 0.51], [14.838, 0.78], [15.157, 0.32],
  [15.569, 0.69], [15.975, 0.78], [16.242, 0.6], [16.521, 0.69], [16.997, 0.32], [17.328, 0.42],
  [17.752, 0.69], [18.158, 0.69], [18.704, 0.6], [18.971, 0.51], [19.516, 0.78], [19.929, 0.32],
  [20.341, 0.69], [20.608, 0.69], [20.881, 0.6], [21.153, 0.51], [21.42, 0.42], [21.693, 0.32],
  [22.111, 0.78], [22.587, 0.69], [22.79, 0.51], [23.04, 0.6], [23.441, 0.42],
  // Four toms
  [23.882, 0.78], [24.288, 0.32], [24.422, 0.69], [24.7, 0.32], [24.967, 0.69], [25.252, 0.32],
  [25.507, 0.69], [25.792, 0.42],
  // Bass and snare answers
  [26.053, 0.97], [26.471, 0.51], [26.796, 0.78], [27.15, 0.6], [27.423, 0.42], [27.696, 0.69],
  [28.235, 0.78], [28.648, 0.51], [29.054, 0.69], [29.6, 0.42], [29.872, 0.6], [30.14, 0.32],
  [30.418, 0.78], [30.824, 0.69], [31.242, 0.6], [31.782, 0.51], [32.369, 0.42], [32.589, 0.78],
  [33.007, 0.69], [33.489, 0.42], [33.686, 0.32], [34.232, 0.69], [34.778, 0.51], [35.19, 0.69],
  [35.515, 0.6], [36.142, 0.42], [36.525, 0.78], [36.955, 0.69], [37.367, 0.78], [37.779, 0.6],
  [38.33, 0.51], [38.597, 0.42], [38.859, 0.32], [39.137, 0.69], [39.549, 0.78], [39.88, 0.6],
  [40.501, 0.51], [41.088, 0.69], [41.314, 0.42], [41.732, 0.69], [42.144, 0.78], [42.411, 0.6],
  [42.69, 0.42], [42.957, 0.78],
];

const spec: Spec = {
  duration: 44, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.74], [8.615, 0.6], [23.88, 0.76], [26.05, 0.62]]),
    speed: curve([[0, 0.45], [8.615, 0.89], [23.88, 0.72], [26.05, 0.91]]),
  },
};
export default spec;
