/**
 * Start on the bare drummer and its shortened closing strokes. The exposed voice leads into the first
 * bass entrance. Let the first phrase gap travel, then let four vocal pickups and one upper stab
 * release the second body. Carry the faint upper line through the long quiet. The drummer returns
 * alone before the bass opens underneath it. Leave the backing subdivisions alone. The final upper
 * attack may be part of the closing bass gesture; its separation needs a listening check.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {keyframes} from "../../scripts/v0/core/curves.ts";
import {bareOpening, firstBody, secondBody, returningDrums, bassReturn, lastBars, type Strike} from "./music.ts";

const music = {"title": "LUA NA PRAÇA", "audio": "productions/short_lua_na_praca/audio.mp3", "beats": "productions/short_lua_na_praca/audio.json", "spectrogram": {"image": "productions/short_lua_na_praca/spectrogram.png", "metadata": "productions/short_lua_na_praca/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "dj Samir, DJ Zarek, DJ DUDA & LUNxdiE", phases: [
  {"name": "Cut into bare drums", "t0": 0, "t1": 3.25, "color": "#426582"},
  {"name": "Voice pickup", "t0": 3.25, "t1": 5.458, "color": "#a45643"},
  {"name": "Bass body", "t0": 5.458, "t1": 10.791, "color": "#448078"},
  {"name": "Phrase gap", "t0": 10.791, "t1": 12.79, "color": "#826488"},
  {"name": "Second body", "t0": 12.79, "t1": 18.25, "color": "#426582"},
  {"name": "Vocal release", "t0": 18.25, "t1": 19.691, "color": "#a45643"},
  {"name": "Suspension", "t0": 19.691, "t1": 27.34, "color": "#448078"},
  {"name": "Drums alone", "t0": 27.34, "t1": 34.61, "color": "#826488"},
  {"name": "Bass re-entry", "t0": 34.61, "t1": 47.335, "color": "#426582"},
  {"name": "Closing bass", "t0": 47.335, "t1": 49.691, "color": "#a45643"},
]};

const strikes: Strike[] = [
  ...bareOpening,
  [3.833,.278], [4.053,.323], [4.727,.348], [5.087,.475],
  ...firstBody,
  ...secondBody,
  [18.241,.416], [18.496,.46], [18.728,.283], [19.019,.239], [19.622,.374],
  ...returningDrums,
  ...bassReturn, ...lastBars,
  [48.479,.353], [48.717,.506],
];

const movement = [
  // Hold each setting through its phrase. The quiet figure travels close to the track.
  [0,.53,.64], [3.251,.45,.5], [5.458,.6,.72], [10.791,.75,.43], [12.784,.63,.74],
  [18.241,.6,.45], [19.691,.28,.31], [27.343,.5,.6], [34.611,.67,.8], [47.335,.86,.4],
];

const spec: Spec = {
  duration: 49.691, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: keyframes(movement.map(([t, air]) => ({t, v: air})), "hold"),
    speed: keyframes(movement.map(([t, , speed]) => ({t, v: speed})), "hold"),
  },
};
export default spec;
