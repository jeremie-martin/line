/**
 * Start with the pickup, A3 opening to A-sharp, the lift to E and the small
 * repeated D syllables. The bass already moves under the C-sharp and A answer;
 * let the singer finish that line. From 4.586 follow the kick and answering
 * snare. Keep the words in the rests at 4.795, 10.286 and 15.604. The flam
 * at 17.868 takes one catch. The G4 crossing the groove at 19.424 is the
 * close call here: the drums continue their sentence under that held pitch.
 * Bass steps into the last pair before the breath. Give the held voice one
 * flight from 24.242 to 25.252. The returning pulse has weight for four bars,
 * then plays more lightly right up to the cut, just before the snare fill.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const directory = 'productions/short_amour_de_ma_vie';
const music = {
  title: 'L’AMOUR DE MA VIE', audio: directory + '/audio.mp3', beats: directory + '/audio.json',
  spectrogram: {image: directory + '/spectrogram.png', metadata: directory + '/spectrogram.json'},
};
export const overlayMeta = {title: music.title, artist: 'Billie Eilish', phases: [
  {name: 'The opening singer', t0: 0, t1: 4.586, color: '#426582'},
  {name: 'Drums and exposed words', t0: 4.586, t1: 23.591, color: '#a45643'},
  {name: 'Bass pickup and breath', t0: 23.591, t1: 25.252, color: '#448078'},
  {name: 'Backbeat return', t0: 25.252, t1: 36.583, color: '#826488'},
  {name: 'Groove eases', t0: 36.583, t1: 44.187, color: '#426582'},
]};

const strikes: [number, number][] = [
  [0.232,.196], [0.604,.318], [0.894,.298], [1.625,.304], [1.962,.232],
  [2.264,.342], [2.868,.167], [3.065,.192], [3.378,.225], [3.750,.281],

  [4.586,.381], [4.795,.235], [5.236,.602], [5.584,.373], [5.909,.524], [6.246,.653],
  [7.245,.458], [7.581,.561], [7.918,.607], [8.255,.504], [8.580,.598], [8.916,.546],
  [9.253,.529], [9.915,.478], [10.286,.281], [10.588,.448], [10.925,.517],
  [11.250,.402], [11.587,.552], [12.574,.476], [12.922,.547], [13.247,.558],
  [13.572,.514], [13.920,.463], [14.257,.508], [14.594,.541], [15.267,.374],
  [15.604,.314], [15.917,.573], [16.254,.528], [16.591,.608], [16.904,.484],
  [17.868,.335], [18.251,.551], [18.576,.378], [18.913,.452], [19.249,.483],
  [19.586,.471], [19.923,.448], [20.596,.429], [21.258,.394], [21.595,.488],
  [21.920,.456], [22.256,.506], [23.255,.438],

  [23.591,.321], [23.905,.614], [24.242,.563],
  [25.252,.761], [25.925,.382], [26.587,.527], [26.924,.502], [27.249,.459],
  [27.597,.584], [28.584,.479], [28.920,.508], [29.257,.523], [29.594,.549],
  [29.919,.517], [30.256,.487], [30.592,.536], [31.254,.474], [31.916,.519],
  [32.253,.552], [32.589,.507], [32.914,.561], [33.913,.531], [34.261,.582],
  [34.598,.426], [34.911,.565], [35.248,.417], [35.585,.629], [35.921,.556],

  [36.583,.413], [37.245,.483], [37.581,.513], [37.918,.457], [38.243,.501],
  [39.253,.472], [39.590,.446], [39.915,.427], [40.252,.482], [40.588,.389],
  [40.914,.471], [41.250,.453], [41.924,.442], [42.585,.452], [42.910,.419],
  [43.236,.454], [43.584,.495],
];

const spec: Spec = {
  duration: 44.187, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.58],[3.065,.46],[3.750,.52],[16.591,.52],[23.591,.54],[24.242,.78],
      [25.252,.56],[36.583,.56],[43.584,.64],[44.187,.61]]),
    speed: curve([[0,.42],[1.962,.50],[2.264,.68],[2.868,.82],[3.750,.90],[16.591,.90],
      [23.591,.80],[24.242,.74],[25.252,.94],[36.583,.88],[43.584,.84],[44.187,.89]]),
  },
};
export default spec;
