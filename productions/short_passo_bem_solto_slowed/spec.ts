/**
 * Start inside the sentence. The little voice attacks at .31, .70 and .93 give the word its shape. Let a
 * held vowel carry the quieter counts. In the second sentence the low pair at 7.94 and 8.20 interrupts
 * the voice. The centre has two short vocal bursts on alternate drum strokes. Ride the two attacks as a
 * pair and leave the beat between bursts open. Follow the exposed link right across the first returning
 * drum. A last little succession of words around 45 s precedes the upper replies. Their exact consonants
 * are uncertain.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "PASSO BEM SOLTO (Slowed)", "audio": "productions/short_passo_bem_solto_slowed/audio.mp3", "beats": "productions/short_passo_bem_solto_slowed/audio.json", "spectrogram": {"image": "productions/short_passo_bem_solto_slowed/spectrogram.png", "metadata": "productions/short_passo_bem_solto_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "ATLXS", phases: [
  {"name": "Middle of the sentence", "t0": 0, "t1": 6.12, "color": "#426582"},
  {"name": "Low punctuation in the reply", "t0": 6.12, "t1": 12.34, "color": "#a45643"},
  {"name": "Two syllables across each measure", "t0": 12.34, "t1": 26.85, "color": "#448078"},
  {"name": "Exposed link", "t0": 26.85, "t1": 29.32, "color": "#826488"},
  {"name": "Broken drums", "t0": 29.32, "t1": 44.47, "color": "#426582"},
  {"name": "Last word and upper reply", "t0": 44.47, "t1": 47.029, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Middle of the sentence
  [0.308, 0.51], [0.564, 0.32], [0.697, 0.42], [0.929, 0.51], [1.208, 0.6], [1.44, 0.32],
  [1.73, 0.42], [1.992, 0.51], [2.224, 0.51], [2.52, 0.42], [2.758, 0.32], [3.054, 0.6],
  [3.286, 0.51], [3.541, 0.42], [4.052, 0.6], [4.343, 0.32], [4.621, 0.42], [4.824, 0.51],
  [5.132, 0.42], [5.62, 0.32],
  // Low punctuation in the reply
  [6.136, 0.6], [6.519, 0.42], [6.92, 0.51], [7.187, 0.42], [7.437, 0.32], [7.942, 0.97],
  [8.197, 0.78], [8.592, 0.51], [8.969, 0.42], [9.254, 0.6], [9.503, 0.32], [9.759, 0.51],
  [10.043, 0.42], [10.275, 0.6], [10.542, 0.42], [10.821, 0.51], [11.042, 0.32], [11.576, 0.51],
  [11.831, 0.32],
  // Two syllables across each measure
  [12.342, 0.97], [12.864, 0.69], [13.126, 0.42], [13.898, 0.69], [14.159, 0.32], [14.942, 0.69],
  [15.198, 0.32], [15.982, 0.78], [16.231, 0.51], [16.487, 0.32], [17.003, 0.69], [17.27, 0.42],
  [18.048, 0.69], [18.309, 0.32], [19.081, 0.69], [19.348, 0.32], [20.121, 0.69], [20.376, 0.32],
  [21.154, 0.69], [21.409, 0.32], [22.187, 0.69], [22.443, 0.32], [23.22, 0.69], [23.482, 0.32],
  [24.265, 0.69], [24.521, 0.42], [25.293, 0.6], [25.554, 0.32], [26.332, 0.69],
  // Exposed link
  [27.063, 0.6], [27.394, 0.51], [27.679, 0.42], [27.911, 0.32], [28.184, 0.51], [28.398, 0.42],
  [28.683, 0.32],
  // Broken drums
  [29.316, 0.88], [29.96, 0.69], [30.227, 0.42], [30.482, 0.32], [30.993, 0.78], [31.522, 0.6],
  [31.783, 0.51], [32.032, 0.69], [32.549, 0.32], [33.071, 0.78], [33.849, 0.51], [34.099, 0.6],
  [34.621, 0.69], [35.138, 0.78], [35.533, 0.42], [36.177, 0.6], [36.688, 0.69], [37.21, 0.51],
  [37.605, 0.69], [38.249, 0.78], [38.522, 0.42], [38.772, 0.32], [39.283, 0.69], [39.678, 0.51],
  [40.322, 0.6], [40.839, 0.78], [41.1, 0.32], [41.355, 0.69], [42.139, 0.51], [42.388, 0.78],
  [42.911, 0.51], [43.428, 0.69], [43.822, 0.6],
  // Last word and upper reply
  [44.467, 0.51], [44.734, 0.69], [45.018, 0.42], [45.279, 0.51], [45.535, 0.32], [45.895, 0.42],
  [46.284, 0.6], [46.8, 0.32],
];

const spec: Spec = {
  duration: 47.029, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.47], [6.12, 0.64], [12.34, 0.54], [26.85, 0.72], [29.32, 0.56], [44.47, 0.53]]),
    speed: curve([[0, 0.66], [6.12, 0.73], [12.34, 0.84], [26.85, 0.65], [29.32, 0.89], [44.47, 0.77]]),
  },
};
export default spec;
