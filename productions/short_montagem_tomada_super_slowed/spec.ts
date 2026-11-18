/**
 * Begin on the upper figure, complete from the first bar, with the exposed call on top of it. At 6.23 the voice
 * stops and the figure rises alone; when the voice returns the figure whispers under it. Answer the next sung call
 * with the low entries, carry the swell, then put the foot down on the drummer. Let the offbeat low
 * rebounds and the returning words cut across those quarters. The gap at 28.9 belongs to the voice.
 * After the last kick the high tail keeps ticking. The balance of bass and voice at 32–35 s is my
 * question.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "MONTAGEM TOMADA (Super Slowed)", "audio": "productions/short_montagem_tomada_super_slowed/audio.mp3", "beats": "productions/short_montagem_tomada_super_slowed/audio.json", "spectrogram": {"image": "productions/short_montagem_tomada_super_slowed/spectrogram.png", "metadata": "productions/short_montagem_tomada_super_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "MXZI", phases: [
  {"name": "Held call", "t0": 0, "t1": 6.23, "color": "#426582"},
  {"name": "Upper reply", "t0": 6.23, "t1": 8.97, "color": "#a45643"},
  {"name": "Voice over low entries", "t0": 8.97, "t1": 18.75, "color": "#448078"},
  {"name": "Low swell", "t0": 18.75, "t1": 20.09, "color": "#826488"},
  {"name": "Drums with low rebounds", "t0": 20.09, "t1": 39.81, "color": "#426582"},
  {"name": "Kick and lingering notes", "t0": 39.81, "t1": 41.361, "color": "#a45643"},
]};

// Time and impact in the short.
const strikes: [number, number][] = [
  // The upper figure he marked (two wide strokes, then six close ones, every bar) is the line of the opening, complete
  // from the first bar. The call's stressed syllables fall on its strokes and give them their weight.
  [0.379,.618], [0.843,.46], [1.302,.46], [1.615,.427], [1.923,.291], [2.231,.493], [2.538,.285], [2.84,.298],
  [3.305,.46], [3.763,.46], [4.077,.341], [4.384,.381], [4.547,.312], [4.692,.282], [4.849,.269], [5,.452], [5.307,.367], [5.766,.46],
  // The voice stops: the figure alone, rising into the pickup.
  [6.23,.522], [6.538,.553], [6.846,.638], [7.159,.558], [7.467,.576], [7.769,.666], [8.233,.747], [8.697,.692],
  // The voice returns over the low entries. The figure goes on under them without a gap: a stroke that a word or a low
  // entry shares carries that weight, the others drop to a whisper, and the last bar rises into the swell.
  [9.005,.382], [9.313,.413], [9.47,.325], [9.62,.13], [9.76,.263], [9.928,.562], [10.236,.644], [10.59,.387], [10.7,.22], [10.863,.296], [11.165,.516], [11.466,.584],
  [11.78,.398], [12.088,.338], [12.395,.22], [12.703,.603], [13.161,.22], [13.336,.354], [13.626,.437], [13.934,.619], [14.241,.398],
  [14.549,.13], [14.857,.13], [15.164,.637], [15.629,.22], [15.797,.349], [16.087,.534], [16.395,.568], [16.708,.406], [17.016,.239], [17.324,.28], [17.643,.38], [17.98,.26], [18.258,.54], [18.595,.29], [18.757,.17],
  [18.914,.18], [19.129,.10], [19.303,.13], [19.483,.19], [19.663,.22], [19.826,.28], [19.936,.10],
  // The drum downstroke and the words which answer it. Four low rebounds
  // between the quarters, interrupted once by the long syllable at 28.893.
  [20.093,.989], [20.557,.62], [20.708,.486], [21.033,.553], [21.323,.596], [21.567,.31],
  [21.939,.748], [22.252,.74], [22.554,.809], [22.914,.367], [23.018,.56], [23.169,.475],
  [23.483,.412], [23.785,.623], [24.04,.324], [24.412,.784], [24.713,.78],
  [25.015,.757], [25.48,.62], [25.642,.494], [25.944,.561], [26.258,.581], [26.571,.374],
  [26.873,.751], [27.18,.75], [27.488,.804], [27.953,.421], [28.103,.469],
  [28.411,.354], [28.614,.17], [28.748,.18], [28.992,.1], [29.16,.13], [29.34,.19], [29.52,.22], [29.682,.28], 
  [29.949,.953], [30.414,.61], [30.565,.501], [30.878,.549], [31.18,.592], [31.505,.402],
  [31.795,.756], [32.109,.76], [32.411,.765], /* the tail's last syllable at 32.794 falls 80 ms before the drum's return: the drum stands for both */ [32.875,.55], [33.026,.455],
  [33.351,.425], [33.641,.639], [33.897,.321], [34.268,.813], [34.57,.79],
  [34.872,.744], [35.035,.362], [35.342,.63], [35.499,.489], [35.801,.558], [36.114,.617],
  [36.422,.35], [36.590,.22], [36.73,.779], [37.037,.75], [37.345,.827], [37.809,.439],
  [37.96,.492], [38.268,.36], [38.576,.576], [38.819,.342],
  // Two bright turns, the last low stroke and its bass aftershock; treble
  // continues to the cut. Its last four notes have different attacks.
  [39.203,.606], [39.504,.731], [39.806,.914], [39.922,.367],
  [40.12,.251], [40.427,.471], [40.735,.409], [41.043,.518],
];

const spec: Spec = {
  duration: 41.361, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.73], [6.23, 0.58], [8.97, 0.66], [18.75, 0.84], [20.09, 0.62], [28.72, 0.65], [28.893, 0.85], [29.95, 0.65], [39.81, 0.6]]),
    speed: curve([[0, 0.43], [6.23, 0.57], [8.97, 0.64], [18.75, 0.78], [20.09, 0.88], [28.4, 0.91], [28.893, 0.69], [29.95, 0.92], [39.81, 0.85], [41.361, 0.57]]),
  },
};
export default spec;
