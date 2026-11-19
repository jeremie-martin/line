/** A boom under the first voice, then a row of feather-light chops. The dry low strokes
 * take over the whole phrase. Follow all four kicks in the band, answering the second and
 * the more audible offbeats after the third. The word before the last kick pair steps out. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';

const music = {"title": "Amor Na Praia (Slowed)", "audio": "productions/short_amor_na_praia_46s/audio.mp3", "beats": "productions/short_amor_na_praia_46s/audio.json", "spectrogram": {"image": "productions/short_amor_na_praia_46s/spectrogram.png", "metadata": "productions/short_amor_na_praia_46s/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Flame Runner", phases: [
  {"name": "Boom and chopped replies", "t0": 0, "t1": 4.458, "color": "#426582"},
  {"name": "Dry 808 burst", "t0": 4.458, "t1": 9.13, "color": "#a45643"},
  {"name": "Kick and paired answers", "t0": 9.13, "t1": 26.73, "color": "#448078"},
  {"name": "The kick resumes", "t0": 26.73, "t1": 43.24, "color": "#826488"},
  {"name": "Last words and soft echoes", "t0": 43.24, "t1": 46.0, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // A shared boom and word. The small overlapping voice comes off the boom and answers across its decay.
  [.337,.747],[.614,.042],[.865,.064],[1.126,.079],[1.44,.049],[1.672,.066],[2.038,.045],[2.299,.031],
  // The small mouth sounds each have an edge. Keep even the stress at 3.355 low.
  [2.548,.06],[2.641,.045],[2.932,.05],[3.082,.05],[3.355,.08],
  [3.611,.05],[3.895,.05],[4.174,.065],
  // Eight exposed 808 strokes. Carry the voice in the spaces and across the breath.
  [4.458,.981],[4.731,.704],[5.277,.895],[5.828,.742],[6.38,.788],
  [6.931,.639],[7.343,.718],[7.755,.683],
  // Four kicks to a bar. At 10.507, 14.907 and 23.708 the second answer blooms.
  [9.131,.936],[9.683,.564],[9.967,.358],[10.228,.581],[10.507,.502],[10.78,.672],
  [11.331,.783],[11.883,.594],[12.161,.429],[12.434,.577],[12.98,.642],
  [13.531,.693],[14.083,.658],[14.362,.489],[14.629,.616],[14.907,.563],[15.18,.712],
  [15.732,.842],[16.283,.568],[16.562,.517],[16.834,.591],[17.38,.638],
  [17.932,.749],[18.483,.604],[18.762,.358],[19.04,.626],[19.313,.462],[19.58,.681],
  [20.132,.785],[20.683,.598],[20.962,.536],[21.235,.608],[21.78,.647],
  [22.332,.719],[22.883,.669],[23.156,.491],[23.429,.619],[23.708,.578],[23.98,.711],
  [24.532,.799],[25.083,.573],[25.362,.512],[25.641,.632],[26.18,.624],
  // Give the downbeat its full space. Only the clearer upper replies rise above the pulse.
  [26.732,.966],[27.283,.558],[27.562,.279],[27.835,.636],[28.386,.624],
  [28.932,.827],[29.484,.598],[29.762,.433],[30.035,.614],[30.569,.654],
  [31.132,.725],[31.684,.661],[31.962,.342],[32.229,.607],[32.508,.388],[32.781,.642],
  [33.309,.814],[33.884,.592],[34.162,.471],[34.441,.623],[34.987,.639],
  [35.532,.801],[36.084,.582],[36.362,.328],[36.635,.615],[37.181,.628],
  [37.732,.768],[38.284,.601],[38.563,.469],[38.841,.616],[39.381,.657],
  [39.933,.724],[40.484,.668],[40.763,.324],[41.03,.599],[41.308,.381],[41.587,.612],
  [42.121,.731],[42.394,.30],[42.684,.576],[42.963,.449],[43.241,.552],
  // Last exposed words, the low stroke they share, then two audible echoes.
  [43.659,.191],[43.892,.263],[44.339,.409],[44.931,.187],[45.72,.128],
];

const spec: Spec = {
  duration: 46.0, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.50], [.337, 0.57], [2.548, 0.38], [3.895, 0.34], [4.174, 0.79], [4.458, 0.77], [4.731, 0.46], [5.277, 0.64], [7.755, 0.58], [8.684, 0.74], [9.13, 0.58], [26.73, 0.63], [43.24, 0.52]]),
    speed: curve([[0, 0.37], [2.548, 0.24], [3.895, 0.25], [4.174, 0.80], [4.458, 0.88], [7.755, 0.87], [8.04, 0.63], [9.13, 0.85], [26.73, 0.89], [43.24, 0.76], [44.339, 0.47], [45.72, 0.29]]),
  },
};
export default spec;
