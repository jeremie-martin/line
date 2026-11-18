/**
 * Two F-sharps flick upward out of a C-sharp pickup. Follow the sung turns until the drummer answers at
 * 8.616. Leave space between kicks for the upper phrase ending. In the break keep
 * the upper replies around the exposed G4 and G-sharp before the verse at 30.8. Let the last word hang over the
 * swell. The second drum entrance is the heavier one. The upper notes continue after the final low beat.
 * Whether the high figure or a chopped voice carries 23–30 s is uncertain.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "MONTAGEM TOMADA (Extended)", "audio": "productions/short_montagem_tomada_extended/audio.mp3", "beats": "productions/short_montagem_tomada_extended/audio.json", "spectrogram": {"image": "productions/short_montagem_tomada_extended/spectrogram.png", "metadata": "productions/short_montagem_tomada_extended/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "MXZI", phases: [
  {"name": "Pickup and sung pairs", "t0": 0, "t1": 6.77, "color": "#426582"},
  {"name": "Swelling last line", "t0": 6.77, "t1": 8.616, "color": "#a45643"},
  {"name": "Drum and upper answer", "t0": 8.616, "t1": 23.15, "color": "#448078"},
  {"name": "Upper figure and exposed words", "t0": 23.15, "t1": 30.8, "color": "#826488"},
  {"name": "Second verse", "t0": 30.8, "t1": 38.152, "color": "#426582"},
  {"name": "Low return", "t0": 38.152, "t1": 52.92, "color": "#a45643"},
  {"name": "Low punctuation and treble tail", "t0": 52.92, "t1": 53.773, "color": "#448078"},
]};

const strikes: [number, number][] = [
  // Each vowel turns back onto the accented long note. Carry its decay.
  [.408,.18], [.651,.31], [.895,.28], [1.035,.26], [1.273,.30],
  [1.708,.24], [1.963,.28], [2.161,.53], [2.544,.26],
  [3.124,.28], [3.345,.34], [3.548,.32], [3.815,.24], [4.007,.54],
  [4.965,.33], [5.197,.38], [5.388,.35], [5.655,.27], [5.853,.60],
  [6.77,.46], [7.043,.39], [7.234,.65], 
  // The quick voice into the drum's return, syllable by syllable and very light, as in the slowed entry (its 16.5–17.9 s).
  [7.501,.28], [7.710,.19], [7.832,.13], [8.030,.19], [8.157,.15], [8.302,.23], [8.418,.25],
  // Ride the low pulse. Let the last bright answer cross it once per cell.
  [8.616,.947], [9.074,.518], [9.539,.576], [10.003,.602], [10.235,.487],
  [10.462,.747], [10.92,.466], [11.385,.539], [11.849,.626], [12.081,.504],
  [12.308,.719], [12.772,.516], [13.231,.508], [13.695,.653], [13.927,.481],
  [14.154,.738], [14.618,.477], [15.164,.351],
  [16,.879], [16.464,.53], [16.929,.568], [17.393,.596], [17.62,.463],
  [17.852,.728], [18.31,.481], [18.775,.526], [19.239,.624], [19.465,.517],
  [19.692,.716], [20.156,.535], [20.621,.511], [21.073,.645], [21.311,.492],
  [21.538,.734], [22.002,.494], [22.467,.536],
  // The upper notes answer the G4 and G-sharp, then take over in the
  // vocal gap from 27.9 to 29.94. Leave the held G-sharp open.
  [22.699,.549], [22.925,.622], [23.152,.699], [23.384,.463], [23.86,.348],
  [24.08,.493], [24.347,.408], [24.8,.568],
  [25.578,.548], [25.926,.718], [26.159,.444], [26.507,.465],
  [26.849,.643], [27.169,.476], [27.424,.568], [27.772,.604], [28.005,.53],
  [28.231,.663], [28.463,.541], [28.695,.478], [28.928,.629], [29.27,.704],
  [29.618,.716], [29.943,.302], [30.21,.426], [30.541,.644],
  // Same voice, different entries: the bend after 31.697 and the compressed last words.
  [30.803,.433], [31.035,.322], [31.232,.301], [31.499,.325], [31.697,.619],
  [32.010,.346], [32.649,.423], [32.881,.379], [33.078,.361], [33.351,.286], [33.542,.614],
  [34.483,.668], [34.733,.396], [34.93,.372], [35.191,.291], [35.388,.651],
  [36.311,.493], [36.578,.419], [36.77,.642],
  // The same quick voice before the second return.
  [37.037,.28], [37.275,.19], [37.409,.13], [37.571,.19], [37.705,.15], [37.838,.23], [37.954,.25],

  // On the return the singer answers the low beat. Give the held vowel
  // at 44.71 and its 45.22 renewal the space of the missing drum stroke.
  [38.152,.991], [38.616,.549], [39.08,.606], [39.533,.613], [39.998,.757],
  [40.462,.519], [40.776,.392], [40.926,.558], [41.391,.644], [41.849,.735],
  [42.308,.532], [42.656,.372], [42.923,.433], [43.237,.671], [43.69,.751],
  [44.154,.502], [44.468,.324], [44.711,.431], [45.245,.479],
  [45.536,.889], [46,.538], [46.36,.347], [46.557,.438], [46.929,.615],
  [47.382,.749], [47.846,.511], [48.148,.39], [48.415,.422], [48.775,.642],
  [49.228,.732], [49.692,.543], [50.052,.356], [50.249,.425], [50.621,.674],
  [51.074,.754], [51.538,.506], [52.002,.573], [52.176,.374], [52.467,.447], [52.699,.493],
  [52.92,.791], [53.39,.434], [53.616,.291],
];

const spec: Spec = {
  duration: 53.773, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.51], [6.77, 0.69], [8.616, 0.55], [23.15, 0.72], [30.8, 0.62], [37.57, 0.82], [38.152, 0.57], [52.92, 0.57]]),
    speed: curve([[0, 0.49], [6.77, 0.76], [8.616, 0.86], [23.15, 0.54], [30.8, 0.58], [38.152, 0.94], [52.92, 0.75]]),
  },
};
export default spec;
