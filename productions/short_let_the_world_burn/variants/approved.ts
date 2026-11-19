/**
 * Finish the three quiet vocal attacks before the distant drum pair. Two exposed
 * C calls open onto the chorus. Follow the drum sentence and sing in its gaps:
 * the last, sharp answering strokes at 8.348, 10.937 and 13.514 lift the mix.
 * At 24.462 leave the drummer behind. Land the starts and rearticulations of
 * the held G and upper C, including the soft G after each break. The little
 * consonant at 34.006 is the least certain catch; the pitch opens just after it.
 * Three drum answers bring the voice back down. Let the last word at 45.906
 * carry through the cut; the small fluctuations in its vowel belong together.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';

const directory = 'productions/short_let_the_world_burn';
const music = {
  title: 'LET THE WORLD BURN (Remix)', audio: directory + '/audio.mp3',
  beats: directory + '/audio.json',
  spectrogram: {image: directory + '/spectrogram.png', metadata: directory + '/spectrogram.json'},
};
export const overlayMeta = {title: music.title, artist: 'Chris Grey, G-Eazy & Ari Abdul', phases: [
  {name: 'Distant approach', t0: 0, t1: 3.204, color: '#426582'},
  {name: 'Exposed C calls', t0: 3.204, t1: 4.481, color: '#a45643'},
  {name: 'Drums with words between', t0: 4.481, t1: 24.462, color: '#448078'},
  {name: 'G over the drummer', t0: 24.462, t1: 34.006, color: '#826488'},
  {name: 'Upper C', t0: 34.006, t1: 43.514, color: '#426582'},
  {name: 'Drum answers and bare words', t0: 43.514, t1: 46.98, color: '#a45643'},
]};

const strikes: [number, number][] = [
  [0.348, .238], [1.022, .214], [1.591, .154], [1.927, .398], [2.252, .334],
  [3.204, .573], [3.646, .659],

  [4.481, .978], [5.457, .543], [5.770, .748], [5.968, .303], [6.165, .413],
  [6.745, .604], [7.070, .467], [7.396, .586], [8.034, .627], [8.348, .852],
  [8.858, .397], [9.242, .335], [9.648, .623], [10.356, .248],
  [10.612, .617], [10.937, .882], [11.401, .315], [11.610, .439],
  [11.900, .591], [12.086, .268], [12.225, .566], [12.550, .553], [12.748, .452],
  [13.201, .683], [13.514, .869], [14.187, .534], [14.814, .601],
  [15.081, .317], [15.778, .612], [16.091, .884], [16.544, .469],
  [17.067, .561], [17.392, .614], [17.717, .503], [18.355, .547], [18.669, .759],
  [19.145, .632], [19.400, .322], [19.969, .721], [20.933, .631], [21.258, .913],
  [21.908, .421], [22.233, .456], [22.547, .595], [22.872, .526],
  [23.034, .352], [23.266, .313], [23.522, .646], [23.835, .776],

  [24.462, .628], [25.321, .533], [28.758, .372], [29.466, .436],
  [30.383, .394], [30.848, .497], [31.985, .286], [33.123, .358],
  [34.006, .264], [34.145, .784], [34.865, .462], [35.480, .641],
  [39.091, .481], [40.310, .513], [42.028, .386],

  [43.514, .678], [44.164, .787], [44.478, .819],
  [44.745, .281], [44.942, .478], [45.906, .457],
];

const spec: Spec = {
  duration: 46.98, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.64],[1.591,.64],[1.927,.38],[2.252,.38],[3.204,.70],[3.646,.84],[4.481,.70],[10.356,.70],
      [10.937,.40],[12.748,.40],[13.201,.70],[23.835,.70],[24.462,.80],[25.321,.91],
      [28.758,.92],[29.466,.78],[31.985,.78],[33.123,.58],[33.8,.66],
      [34.006,.42],[34.865,.56],[35.480,.92],[39.091,.92],[42.028,.84],
      [43.514,.52],[44.478,.52],[44.745,.62],[45.906,.78],[46.98,.78]]),
    speed: curve([[0,.32],[1.591,.32],[1.927,.44],[2.252,.44],[3.204,.56],[3.646,.95],
      [4.481,.92],[23.835,.92],[24.462,.96],[28.758,.96],[29.466,.66],
      [31.985,.66],[33.8,.72],[34.006,.86],[34.865,.96],[39.091,.96],[40.310,.82],
      [42.028,.82],[43.514,.92],[44.478,.92],[44.745,.56],[46.98,.56]]),
  },
};
export default spec;
