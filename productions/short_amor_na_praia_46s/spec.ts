/**
 * The opening boom leaves space for three clipped vocal groups. The dry 808 takes the sentence away mid-
 * word. Keep its uneven last three strokes, with a small vocal answer in each preceding gap. When the
 * band comes in, ride the four kicks of each bar and the bass replies after kicks two and three. Some of
 * those replies swell as clearly as the kick. Let the isolated hey interrupt the pattern once, then
 * resume through the last soft words and echoes. The weight on the second answer of a bar is the main
 * uncertainty.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "Amor Na Praia (Slowed)", "audio": "productions/short_amor_na_praia_46s/audio.mp3", "beats": "productions/short_amor_na_praia_46s/audio.json", "spectrogram": {"image": "productions/short_amor_na_praia_46s/spectrogram.png", "metadata": "productions/short_amor_na_praia_46s/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Flame Runner", phases: [
  {"name": "Boom and chopped replies", "t0": 0, "t1": 4.458, "color": "#426582"},
  {"name": "Dry 808 burst", "t0": 4.458, "t1": 9.13, "color": "#a45643"},
  {"name": "Kick and paired answers", "t0": 9.13, "t1": 26.73, "color": "#448078"},
  {"name": "The kick resumes", "t0": 26.73, "t1": 43.24, "color": "#826488"},
  {"name": "Last words and soft echoes", "t0": 43.24, "t1": 46.0, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // The rise at 3.355 is the stress. Carry the intervening 3.233 chop.
  [.337,.747],[.865,.235],[1.126,.287],[1.672,.211],
  [2.548,.326],[3.082,.359],[3.355,.484],[3.895,.182],
  // Dry strokes, two unaccompanied words in their holes, then a breath.
  [4.458,.981],[4.731,.704],[5.277,.895],[5.555,.174],[5.828,.742],[6.38,.788],
  [6.658,.208],[6.931,.639],[7.343,.718],[7.755,.683],[8.04,.352],[8.684,.254],
  // Four kicks to a bar. At 10.507, 14.907 and 23.708 the second answer blooms.
  [9.131,.936],[9.683,.564],[9.967,.358],[10.228,.581],[10.507,.502],[10.78,.672],
  [11.331,.783],[11.883,.594],[12.161,.429],[12.434,.577],[12.713,.236],[12.98,.642],
  [13.531,.693],[14.083,.658],[14.362,.489],[14.629,.616],[14.907,.563],[15.18,.712],
  [15.732,.842],[16.283,.568],[16.562,.517],[16.834,.591],[17.113,.218],[17.38,.638],
  [17.932,.749],[18.483,.604],[18.762,.358],[19.04,.626],[19.313,.462],[19.58,.681],
  [20.132,.785],[20.683,.598],[20.962,.536],[21.235,.608],[21.513,.244],[21.78,.647],
  [22.332,.719],[22.883,.669],[23.156,.491],[23.429,.619],[23.708,.578],[23.98,.711],
  [24.532,.799],[25.083,.573],[25.362,.512],[25.641,.632],[25.908,.271],[26.18,.624],
  [26.285,.306],
  // The hey leaves a hole for the return. Keep the answering rhythm even as
  // its quieter upper notes sink back into the bass.
  [26.732,.966],[27.283,.558],[27.562,.279],[27.835,.636],[28.108,.252],[28.386,.624],
  [28.932,.827],[29.484,.598],[29.762,.433],[30.035,.614],[30.319,.239],[30.569,.654],
  [31.132,.725],[31.684,.661],[31.962,.342],[32.229,.607],[32.508,.388],[32.781,.642],
  [33.309,.814],[33.884,.592],[34.162,.471],[34.441,.623],[34.714,.264],[34.987,.639],
  [35.532,.801],[36.084,.582],[36.362,.328],[36.635,.615],[36.914,.247],[37.181,.628],
  [37.732,.768],[38.284,.601],[38.563,.469],[38.841,.616],[39.114,.259],[39.381,.657],
  [39.933,.724],[40.484,.668],[40.763,.324],[41.03,.599],[41.308,.381],[41.587,.612],
  [42.121,.731],[42.684,.576],[42.963,.449],[43.241,.552],
  // Last exposed words, the low stroke they share, then two audible echoes.
  [43.659,.191],[43.892,.263],[44.339,.409],[44.931,.187],[45.72,.128],
];

const spec: Spec = {
  duration: 46.0, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.66], [3.895, 0.68], [4.458, 0.77], [4.731, 0.46], [5.277, 0.64], [7.755, 0.58], [8.684, 0.74], [9.13, 0.58], [26.73, 0.63], [43.24, 0.52]]),
    speed: curve([[0, 0.39], [3.355, 0.43], [4.458, 0.88], [7.755, 0.87], [8.04, 0.63], [9.13, 0.85], [26.73, 0.89], [43.24, 0.76], [44.339, 0.47], [45.72, 0.29]]),
  },
};
export default spec;
