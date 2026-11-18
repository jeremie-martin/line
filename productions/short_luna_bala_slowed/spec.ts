/**
 * The opening voice comes into focus gradually. The drum at 6.71 stops the murmur. The exposed two-part
 * sentence that follows lands very softly, including the restart after its breath. The upper figure then
 * becomes the pulse: three more widely spaced attacks, a longer step and a short answer. Follow the
 * shortened bar near 23 s and the stronger low responses after 32.89. Omit the beat that bisects the
 * long step. I am least sure how much of the closing treble the listener follows once the bass falls
 * out.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LUNA BALA (Slowed)", "audio": "productions/short_luna_bala_slowed/audio.mp3", "beats": "productions/short_luna_bala_slowed/audio.json", "spectrogram": {"image": "productions/short_luna_bala_slowed/spectrogram.png", "metadata": "productions/short_luna_bala_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Yb Wasg'ood & Ariis", phases: [
  {"name": "Distant words", "t0": 0, "t1": 6.71, "color": "#426582"},
  {"name": "Bare voice", "t0": 6.71, "t1": 15.44, "color": "#a45643"},
  {"name": "Five upper strokes", "t0": 15.44, "t1": 30.7, "color": "#448078"},
  {"name": "Exposed strokes and returning low replies", "t0": 30.7, "t1": 48.14, "color": "#826488"},
  {"name": "Bass falls away", "t0": 48.14, "t1": 50.291, "color": "#426582"},
]};

// Time and impact in the short.
const strikes: [number, number][] = [
  // The cut enters on the earlier vocal rhythm, already in motion.
  [.183,.104], [.595,.148], [1.001,.094], [1.82,.208], [2.017,.098],
  [2.366,.275], [2.778,.209], [3.26,.115], [3.73,.315], [4.055,.183],
  [4.293,.206], [4.542,.406], [4.786,.235], [4.955,.296], [5.1,.229],
  [5.361,.407], [5.64,.482], [5.866,.292], [6.052,.386], [6.243,.324], [6.452,.379],
  // Drum punctuation; two pickups, leaned vowels, then the little consonants.
  [6.713,.48], [7.004,.087], [7.259,.069], [7.851,.136], [8.217,.123],
  [8.397,.044], [8.658,.024], [8.896,.067], [9.128,.033], [9.227,.022],
  [9.477,.052], [9.674,.027], [10.034,.065], [10.295,.016],
  // Restart after a whole second of air. The short upper replies interrupt
  // the words at 11.781, 12.42, 14.045, 14.626 and 14.753.
  [11.323,.118], [11.485,.059], [11.578,.018], [11.781,.093], [11.955,.025],
  [12.199,.047], [12.42,.056], [12.577,.028], [12.756,.094], [13.116,.046],
  [13.262,.032], [13.476,.081], [13.598,.019], [13.836,.041], [13.941,.031],
  [14.045,.064], [14.144,.017], [14.347,.086], [14.626,.175], [14.753,.062],
  [14.899,.018], [15.026,.026], [15.235,.014],
  // Five-stroke line: let it speak before the full attack at 17.627.
  [15.444,.49], [15.856,.372], [16.263,.416], [16.803,.608], [17.081,.53],
  [17.627,.867], [18.033,.755], [18.44,.426], [18.985,.624], [19.264,.56],
  [19.804,.952], [20.216,.447], [20.622,.469], [21.168,.548], [21.447,.52],
  [21.986,.904], [22.393,.739], [22.799,.696],
  // The short step arrives early here; it is still the same timbre.
  [23.078,.668], [23.345,.55], [23.618,.74], [23.89,.587], [24.163,.528], [24.57,.389],
  [24.982,.516], [25.522,.477], [25.806,.52], [26.346,.939], [26.758,.671],
  [27.159,.357], [27.704,.679], [27.983,.55], [28.529,.846], [28.935,.729],
  [29.341,.452], [29.887,.578], [30.166,.54],
  // Exposed upper notes; the low line takes over the fifth stroke.
  [30.705,.593], [31.118,.816], [31.524,.531], [32.07,.827], [32.348,.714],
  [32.888,.941], [33.295,.504], [33.701,.403], [33.985,.61], [34.247,.445], [34.519,.79],
  [35.071,.899], [35.477,.49], [35.884,.563], [36.156,.63], [36.435,.658], [36.702,.74],
  [37.254,.751], [37.66,.612], [38.06,.476], [38.339,.59], [38.606,.419], [38.879,.78],
  [39.43,.873], [39.837,.58], [40.243,.636], [40.516,.68], [40.777,.352], [41.067,.693],
  // Low replies still come through; the other four are light treble now.
  [41.613,.763], [42.014,.264], [42.426,.293], [42.971,.316], [43.238,.56],
  [43.79,.904], [44.196,.193], [44.603,.331], [45.148,.458], [45.421,.61],
  [45.973,.801], [46.373,.249], [46.785,.395], [47.331,.316], [47.598,.69],
  [48.149,.757], [48.556,.228], [48.962,.586], [49.508,.557], [49.781,.60], [49.937,.169], [50.135,.279],
];

const spec: Spec = {
  duration: 50.291, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.58], [6.71, 0.59], [8.217, 0.43], [10.295, 0.49], [11.323, 0.57], [12.199, 0.43], [14.626, 0.39], [15.44, 0.62], [30.7, 0.68], [48.14, 0.53]]),
    speed: curve([[0, 0.85], [6.45, 0.87], [7.0, 0.64], [10.295, 0.50], [11.323, 0.50], [12.2, 0.64], [14.35, 0.66], [15.44, 0.83], [30.7, 0.91], [48.14, 0.7]]),
  },
};
export default spec;
