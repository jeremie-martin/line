/** Keep the quick vocal pickup light. Ride the upper figure across the drummer, including its short fifth stroke and the broken-bar doubles. The answering bass comes forward, then the bare drums lead back to the singer. */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LUNA BALA", "audio": "productions/short_luna_bala_original/audio.mp3", "beats": "productions/short_luna_bala_original/audio.json", "spectrogram": {"image": "productions/short_luna_bala_original/spectrogram.png", "metadata": "productions/short_luna_bala_original/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Ariis & Yb Wasg'ood", phases: [
  {"name": "End of the sung pickup", "t0": 0, "t1": 3.69, "color": "#426582"},
  {"name": "Broken percussion", "t0": 3.69, "t1": 18.45, "color": "#a45643"},
  {"name": "Low answering sentences", "t0": 18.45, "t1": 31.375, "color": "#448078"},
  {"name": "Uncovered drum tail", "t0": 31.375, "t1": 33.23, "color": "#826488"},
  {"name": "A-sharp and C-sharp answer", "t0": 33.23, "t1": 39.373, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Cut into the breathy phrase. Its little consonants bunch up before the first kick.
  [.202,.035],[.336,.11],[.597,.039],[.736,.031],[.934,.067],[1.41,.10],
  [1.526,.039],[1.718,.052],[1.822,.028],[2.019,.057],
  [2.414,.07],[2.588,.034],[2.757,.083],[2.954,.05],[3.053,.029],[3.227,.043],[3.488,.024],
  // Four longer upper strokes then the short answer. The double at 7.15 cuts the rest short.
  [3.685,.60],[4.04,.43],[4.382,.48],[4.846,.65],[5.079,.53],
  [5.531,.86],[5.885,.66],[6.228,.51],[6.687,.64],[6.919,.54],[7.151,.70],
  [7.377,.85],[7.731,.62],[8.074,.48],[8.538,.65],[8.771,.53],
  [9.223,.89],[9.577,.62],[9.92,.51],[10.152,.68],[10.379,.56],[10.622,.74],[10.843,.55],
  [11.069,.8],[11.418,.66],[11.766,.47],[12.225,.65],[12.463,.53],
  [12.915,.91],[13.264,.69],[13.612,.52],[14.071,.65],[14.309,.55],[14.535,.68],
  [14.761,.9],[15.11,.63],[15.458,.46],[15.917,.66],[16.155,.54],
  [16.607,.66],[16.961,.82],[17.316,.51],[17.536,.62],[17.768,.75],[18.001,.68],[18.233,.52],
  // The upper attacks keep their place as the low response grows beneath them.
  [18.459,.91],[18.807,.51],[19.15,.48],[19.614,.64],[19.846,.55],[20.073,.73],
  [20.305,.88],[20.653,.51],[20.996,.57],[21.454,.64],[21.692,.56],
  [22.151,.81],[22.494,.59],[22.842,.49],[23.306,.58],[23.538,.70],
  [24.003,.90],[24.351,.56],[24.688,.60],[25.135,.47],[25.617,.65],
  [25.843,.84],[26.186,.24],[26.534,.33],[26.998,.40],[27.23,.53],[27.457,.69],
  [27.689,.91],[28.037,.23],[28.38,.34],[28.844,.43],[29.076,.60],
  [29.541,.84],[29.878,.26],[30.226,.39],[30.684,.36],[31.108,.58],
  // Four bare drums, then three pitched calls and a very fine answer to each.
  [31.375,.76],[31.84,.65],[32.304,.61],[32.757,.72],
  [33.233,.28],[33.709,.089],[34.394,.051],[35.079,.46],[35.613,.073],
  [36.182,.048],[36.321,.033],[36.925,.48],[37.633,.083],[37.877,.052],[37.993,.032],[38.666,.043],
];

const spec: Spec = {
  duration: 39.373, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.38], [1.41, 0.31], [2.757, 0.33], [3.488, 0.51], [3.69, 0.59], [18.45, 0.68], [31.375, 0.65], [33.23, 0.77]]),
    speed: curve([[0, 0.58], [3.69, 0.86], [18.45, 0.83], [31.375, 0.7], [33.23, 0.47]]),
  },
};
export default spec;
