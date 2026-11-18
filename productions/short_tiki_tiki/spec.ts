/**
 * QMIIR's slow pulse carries the solo words. Seven brushes under the opening,
 * four gathering beats, then the kick with a short answer between beats.
 * Leave the quick double syllables and the pickup snares in the sound.
 * The boom at 24.35 starts four slower steps into the second full-band entry.
 * After the last kick the pulse continues under the voice through the cut.
 * Check whether the quiet supports disappear enough around the breath.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {keyframes} from '../../scripts/v0/core/curves.ts';

export const overlayMeta = {title: 'TIKI TIKI (Slowed)', artist: 'QMIIR', phases: [
  {name: 'Solo words', t0: 0, t1: 6.90}, {name: 'First beats', t0: 6.90, t1: 10.43},
  {name: 'Drop hook', t0: 10.43, t1: 24.35}, {name: 'Reset', t0: 24.35, t1: 27.83},
  {name: 'Run', t0: 27.83, t1: 41.74}, {name: 'Voice over the pulse', t0: 41.74, t1: 48},
]};

// Time, weight, and amplitude of the approach. The short answers skim the line.
const pulse: [number, number, number][] = [
  [.94,.02,.03], [1.81,.02,.03], [2.68,.02,.03], [3.55,.02,.03],
  [4.42,.02,.03], [5.29,.02,.03], [6.16,.02,.03],
  [6.97,.608,.458], [7.83,.555,.434], [8.70,.533,.434], [9.619,.503,.404],
  [10.43,1,.94], [11.31,.757,.44], [11.746,.638,.10], [12.18,.746,.10],
  [12.617,.657,.10], [13.05,.738,.10], [13.482,.634,.10], [13.91,.77,.10],
  [14.78,.740,.44], [15.229,.716,.12], [15.66,.765,.10], [16.068,.674,.10],
  [16.53,.759,.10], [16.927,.741,.10], [17.39,.789,.10],
  [18.26,.746,.44], [18.704,.636,.10], [19.13,.751,.10], [19.577,.735,.12],
  [20,.748,.10], [20.442,.653,.12], [20.87,.797,.10],
  [21.74,.754,.44], [22.187,.708,.12], [22.61,.766,.10], [23.055,.584,.12], [23.48,.749,.10],
  [24.35,.711,.44], [25.22,.520,.20], [26.09,.502,.20], [26.95,.495,.20],
  [27.83,1,.70], [28.70,.653,.48], [29.144,.569,.12], [29.57,.778,.10],
  [30.009,.598,.12], [30.44,.648,.10], [30.877,.606,.12], [31.31,.767,.10],
  [32.18,.660,.48], [32.618,.594,.12], [33.05,.781,.10], [33.483,.565,.10],
  [33.92,.597,.10], [34.351,.715,.10], [34.78,.786,.10],
  [35.66,.660,.48], [36.101,.608,.12], [36.53,.775,.10], [36.969,.554,.12],
  [37.40,.634,.10], [37.834,.544,.12], [38.26,.767,.10],
  [39.13,.497,.48], [39.544,.722,.10], [40.01,.581,.10], [40.441,.765,.10],
  [40.87,.603,.10], [41.74,.586,.40],
  [42.70,.03,.06], [43.57,.03,.06], [44.44,.03,.06], [45.31,.03,.06],
  [46.18,.03,.06], [47.05,.03,.06], [47.92,.03,.06],
];

const dir = 'productions/short_tiki_tiki';
const spec: Spec = {
  duration: 48,
  music: {title: overlayMeta.title, artist: overlayMeta.artist, audio: dir + '/audio.mp3',
    beats: dir + '/audio.json', spectrogram: {image: dir + '/spectrogram.png', metadata: dir + '/spectrogram.json'}},
  contacts: pulse.map(([t, impact]) => ({t, impact})),
  axes: {
    amplitude: t => (pulse.find(([end]) => end >= t) ?? pulse[pulse.length - 1])[2],
    air: keyframes([
      {t:0,v:.42,ease:'smooth'}, {t:6.9,v:.48,ease:'easeIn'}, {t:10.43,v:.76,ease:'smooth'},
      {t:16.53,v:.72,ease:'smooth'}, {t:24.35,v:.66,ease:'easeOut'}, {t:27.83,v:.78,ease:'smooth'},
      {t:34.78,v:.76,ease:'smooth'}, {t:41.74,v:.70,ease:'smooth'}, {t:46.99,v:.84,ease:'easeOut'}, {t:48,v:.58},
    ]),
    speed: keyframes([
      {t:0,v:.34,ease:'smooth'}, {t:3.48,v:.37,ease:'smooth'}, {t:6.9,v:.42,ease:'easeIn'},
      {t:7.83,v:.54,ease:'smooth'}, {t:9.619,v:.73,ease:'easeIn'}, {t:10.43,v:.86,ease:'smooth'},
      {t:16.53,v:.74,ease:'smooth'}, {t:24.35,v:.52,ease:'easeOut'}, {t:25.22,v:.50,ease:'smooth'},
      {t:26.09,v:.62,ease:'smooth'}, {t:26.95,v:.76,ease:'easeIn'}, {t:27.83,v:.90,ease:'smooth'},
      {t:34.78,v:.80,ease:'smooth'}, {t:41.74,v:.68,ease:'easeOut'}, {t:46.99,v:.60,ease:'easeOut'}, {t:48,v:.50},
    ]),
  },
};
export default spec;
