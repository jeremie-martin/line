/** Enter inside the exposed vocal sentence. Let its small articulations carry the opening, then follow the five upper strokes and the low replies that grow through them. */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LUNA BALA (Slowed)", "audio": "productions/short_luna_bala_44s/audio.mp3", "beats": "productions/short_luna_bala_44s/audio.json", "spectrogram": {"image": "productions/short_luna_bala_44s/spectrogram.png", "metadata": "productions/short_luna_bala_44s/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Yb Wasg'ood & Ariis", phases: [
  {"name": "Solo voice", "t0": 0, "t1": 8.615, "color": "#426582"},
  {"name": "Five upper strokes", "t0": 8.615, "t1": 23.88, "color": "#a45643"},
  {"name": "Exposed percussion", "t0": 23.88, "t1": 26.05, "color": "#448078"},
  {"name": "Bass and snare answers", "t0": 26.05, "t1": 44, "color": "#826488"},
]};

// Time and impact in the short.
const strikes: [number, number][] = [
  // The cut opens on the exposed syllables. Catch the lip of each vowel, then the restart.
  [.174,.045],[.435,.077],[1.027,.12],[1.393,.10],[1.573,.042],[1.834,.026],
  [2.072,.065],[2.305,.025],[2.403,.033],[2.647,.05],[2.85,.028],[3.199,.066],[3.477,.025],
  [4.499,.115],[4.661,.067],[4.754,.023],[4.992,.087],[5.166,.032],[5.358,.049],
  [5.741,.028],[5.927,.098],[6.293,.045],[6.438,.036],[6.653,.078],
  [6.774,.026],[6.96,.041],[7.192,.055],[7.314,.031],[7.517,.088],[7.738,.043],
  [7.866,.074],[8.098,.045],[8.202,.032],[8.411,.022],
  // Upper line across the kick. Its short fifth stroke answers the long fourth.
  [8.615,.53],[9.027,.39],[9.439,.44],[9.985,.62],[10.252,.52],
  [10.791,.87],[11.204,.73],[11.616,.45],[12.167,.64],[12.428,.55],
  [12.974,.95],[13.392,.49],[13.798,.46],[14.344,.63],[14.611,.53],
  [15.157,.89],[15.569,.74],[15.981,.67],[16.242,.63],[16.521,.55],[16.788,.72],
  [17.067,.57],[17.334,.53],[17.752,.42],[18.158,.55],[18.704,.61],[18.971,.53],
  [19.516,.92],[19.929,.67],[20.335,.42],[20.881,.66],[21.153,.56],
  [21.693,.86],[22.111,.74],[22.518,.46],[23.063,.59],[23.33,.55],
  // The four uncovered drums have little bright answers between them.
  [23.876,.62],[24.288,.78],[24.7,.51],[25.246,.8],[25.507,.69],
  // Bass fills the holes between upper strokes, then withdraws beneath the refrain.
  [26.053,.92],[26.471,.51],[26.877,.42],[27.15,.62],[27.429,.46],[27.696,.78],
  [28.235,.88],[28.653,.52],[29.06,.56],[29.327,.61],[29.605,.65],[29.872,.73],
  [30.418,.83],[30.83,.65],[31.242,.47],[31.509,.62],[31.788,.45],[32.055,.77],
  [32.595,.89],[33.007,.57],[33.425,.61],[33.686,.65],[33.971,.41],[34.232,.68],
  [34.778,.84],[35.196,.23],[35.602,.30],[36.148,.35],[36.415,.56],
  [36.955,.92],[37.378,.21],[37.779,.34],[38.33,.44],[38.597,.60],
  [39.137,.83],[39.555,.26],[39.962,.39],[40.513,.34],[40.774,.62],
  [41.314,.79],[41.738,.23],[42.144,.56],[42.69,.54],[42.957,.60],
  [43.566,.09],[43.764,.055],
];

const spec: Spec = {
  duration: 44, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.62], [3.216,.62], [3.5,.86], [4.2,.86], [4.493,.48], [8.069,.48], [8.615,.68], [23.487,.68], [23.870,.76], [25.797,.76], [26.053,.68], [42.957,.68], [43.2,.32], [44,.32]]),
    speed: curve([[0,.55], [4.2,.55], [4.493,.58], [7.523,.56], [8.069,.98], [23.487,.98], [23.870,.74], [25.507,.74], [25.797,.86], [26.053,.98], [42.957,.98], [43.2,.40], [44,.40]]),
  },
};
export default spec;
