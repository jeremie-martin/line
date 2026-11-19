/**
 * Hear the quiet middle as the continuation of the bright phrase-end answer. Keep its seven-note contour
 * intact at each break and give the uncovered articulations light touches. Leave the bass pumping
 * beneath the full drum bars in flight. The question is whether the faint centre can hold attention on
 * its own.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import {bareOpening, firstBody, secondBody, returningDrums, bassReturn, lastBars, type Strike} from "../music.ts";

const music = {"title": "LUA NA PRAÇA", "audio": "productions/short_lua_na_praca/audio.mp3", "beats": "productions/short_lua_na_praca/audio.json", "spectrogram": {"image": "productions/short_lua_na_praca/spectrogram.png", "metadata": "productions/short_lua_na_praca/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "dj Samir, DJ Zarek, DJ DUDA & LUNxdiE", phases: [
  {"name": "Cut into bare drums", "t0": 0, "t1": 3.25, "color": "#426582"},
  {"name": "Voice pickup", "t0": 3.25, "t1": 5.52, "color": "#a45643"},
  {"name": "Bass body", "t0": 5.52, "t1": 10.98, "color": "#448078"},
  {"name": "Seven-note contour", "t0": 10.98, "t1": 12.79, "color": "#826488"},
  {"name": "Second body", "t0": 12.79, "t1": 18.25, "color": "#426582"},
  {"name": "Seven-note answer", "t0": 18.25, "t1": 19.85, "color": "#a45643"},
  {"name": "Uncovered upper phrases", "t0": 19.85, "t1": 27.34, "color": "#448078"},
  {"name": "Drums alone", "t0": 27.34, "t1": 34.61, "color": "#826488"},
  {"name": "Bass re-entry", "t0": 34.61, "t1": 47.57, "color": "#426582"},
  {"name": "Last exposed answer", "t0": 47.57, "t1": 49.691, "color": "#a45643"},
]};

const strikes: Strike[] = [
  ...bareOpening,
  [3.391,.299], [4.047,.328], [4.628,.406], [4.854,.312], [4.965,.39], [5.081,.25], [5.191,.49], [5.307,.27], [5.406,.20],
  [5.522,.85], ...firstBody.slice(1),
  [10.979,.624], [11.205,.418], [11.321,.369], [11.658,.648], [12.111,.811], [12.343,.374], [12.569,.309],
  ...secondBody,
  [18.246,.511], [18.479,.401], [18.589,.343], [18.931,.658], [19.384,.762], [19.611,.306], [19.843,.323],
  // Exposed upper phrase gathers weight through its last three consecutive rises.
  [21.213,.047], [21.439,.028], [21.892,.055], [22.234,.045], [22.577,.052], [23.03,.067], [23.256,.049],
  [23.709,.085], [24.388,.071], [24.847,.063], [25.073,.084], [25.526,.092], [25.868,.102], [26.205,.118],
  ...returningDrums,
  [33.81,.453], [34.164,.382], [34.384,.224],
  ...bassReturn,
  [40.979,.383], [41.095,.31], [41.432,.394], [41.664,.428],
  ...lastBars,
  [47.567,.28], [47.684,.306], [48.026,.412], [48.479,.476], [48.705,.384], [48.932,.259], [49.506,.184],
];

const spec: Spec = {
  duration: 49.691, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.48], [3.25, 0.66], [5.52, 0.59], [10.98, 0.59], [12.79, 0.59], [18.25, 0.64], [19.85, 0.76], [27.34, 0.58], [33.81, .53], [34.384, .42], [34.61, .68], [47.57, 0.57]]),
    speed: curve([[0,.96], [3.25,.87], [5.52,.99], [10.98,.94], [12.79,1], [18.25,.96],
      [19.85,.82], [21.21,.80], [26.205,.84], [27.34,.98], [33.81,.96], [34.384,.99],
      [34.61,1], [35.52,.99], [47.57,.87], [49.506,.82]]),
  },
};
export default spec;
