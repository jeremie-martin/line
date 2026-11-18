/**
 * The cut opens on a voice already sounding. Catch the crash under its first
 * turn, then trace the words. Give the holds after 3.506 and 10.704 room.
 * From 14.710 the long-long-short spacing of the kicks carries the lilt.
 * The little strokes from 18.518 fill the spaces between them. Keep both
 * voices of that rhythm audible. At the break, the two short rearticulations
 * frame the much sharper G. The drop gets the strongest catch.
 * Bass enters six times ahead of the heavy kick. Release the ride with the
 * snare in the bass cutouts, keep each triple together, then catch the two
 * exposed words. The sung D-sharps in the cutouts travel in air. The uncertain
 * opening detail is the turn near 8.85, where spectral and pitch times differ.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';

const directory = 'productions/short_trouble';
const music = {
  title: "I Knew You Were Trouble (Taylor's Version)", audio: directory + '/audio.mp3',
  beats: directory + '/audio.json',
  spectrogram: {image: directory + '/spectrogram.png', metadata: directory + '/spectrogram.json'},
};
export const overlayMeta = {title: music.title, artist: 'Taylor Swift', phases: [
  {name: 'Sung arc', t0: 0, t1: 12.527, color: '#426582'},
  {name: 'Five gathering words', t0: 12.527, t1: 14.710, color: '#a45643'},
  {name: 'Long, long, short', t0: 14.710, t1: 27.725, color: '#448078'},
  {name: 'Exposed E and G', t0: 27.725, t1: 29.025, color: '#826488'},
  {name: 'Bass, kick and release', t0: 29.025, t1: 43.770, color: '#426582'},
  {name: 'Two exposed words', t0: 43.770, t1: 44.646, color: '#a45643'},
]};

const strikes: [number, number][] = [
  [0.372,.568], [0.848,.302], [1.300,.341], [1.730,.249], [2.125,.367], [2.438,.307],
  [3.506,.429], [5.770,.251], [6.211,.272], [6.664,.316], [7.105,.288], [7.546,.349],
  [8.011,.374], [8.464,.326], [8.847,.343], [9.358,.298], [9.822,.228],
  [10.043,.257], [10.704,.411],
  [12.527,.292], [12.934,.359], [13.398,.314], [13.827,.369], [14.292,.412],

  [14.710,.798], [15.383,.648], [16.045,.676], [16.498,.706], [17.160,.643], [17.833,.759],
  [18.286,.701], [18.518,.161], [18.750,.173], [18.959,.651], [19.191,.153],
  [19.412,.165], [19.632,.724], [19.865,.206],
  [20.085,.718], [20.526,.204], [20.747,.667], [20.991,.216], [21.211,.183],
  [21.420,.724], [21.664,.158], [21.873,.748], [22.094,.167], [22.338,.253],
  [22.547,.687], [22.790,.211], [22.999,.193], [23.208,.732], [23.452,.182],
  [23.661,.771], [23.905,.208], [24.114,.188], [24.335,.756], [24.787,.238],
  [25.008,.806], [25.240,.217], [25.449,.781], [25.693,.179], [25.902,.228],
  [26.122,.746], [26.355,.193], [26.575,.205], [26.796,.765], [27.028,.186], [27.249,.717],

  [27.725,.348], [27.934,.317], [28.085,.613], [28.584,.337], [28.746,.295],
  [29.025,.996], [29.942,.517], [30.592,.342], [30.824,.852], [31.498,.896],
  [31.718,.503], [32.392,.399], [32.612,.912], [33.495,.536], [34.180,.431],
  [34.400,.825], [34.737,.883], [35.074,.947], [35.294,.525],
  [36.188,.921], [37.082,.509], [37.756,.377], [37.988,.883], [38.661,.907],
  [38.870,.562], [39.555,.418], [39.776,.934], [40.670,.501], [41.343,.412],
  [41.564,.861], [41.900,.892], [42.237,.965], [42.469,.473],
  [43.770,.509], [44.234,.327],
];

const spec: Spec = {
  duration: 44.646, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.48],[2.438,.56],[4.5,.82],[5.77,.46],[8.847,.46],[10.704,.56],[11.9,.80],
      [12.527,.42],[14.710,.50],[18.286,.50],[18.518,.56],[27.249,.56],[27.725,.62],
      [28.085,.71],[28.584,.73],[28.746,.83],[29.025,.78],[29.942,.64],[30.28,.80],[30.592,.64],[33.495,.64],
      [33.82,.84],[34.180,.66],[34.737,.78],[35.074,.86],[35.294,.64],[37.082,.64],[37.4,.80],[37.756,.64],[40.670,.64],
      [41,.84],[41.343,.66],[41.9,.76],[42.237,.86],[42.469,.64],[43.770,.60],[44.646,.66]]),
    speed: curve([[0,.42],[10.704,.42],[12.527,.46],[14.292,.60],[14.710,.80],[18.286,.84],
      [21.873,.84],[27.249,.72],[27.725,.69],[28.085,.82],[28.584,.95],[29.025,1],[42.469,1],
      [43.770,.48],[44.646,.48]]),
  },
};
export default spec;
