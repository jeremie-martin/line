/** Begin inside the upper pickup. A dry drum breaks it off; a staggered line of low strokes
 * takes the singer with it. Use light words in the openings, then three clear drum pickups.
 * Keep the four kicks and the displaced bass answers beneath the hook. When the tune broadens,
 * carry the held voice over the smaller subdivisions. The closing pair rides out the last vowel. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';

const dir = 'productions/short_amor_na_praia';
const music = {title: 'Amor Na Praia (Slowed)', audio: dir + '/audio.mp3', beats: dir + '/audio.json',
  spectrogram: {image: dir + '/spectrogram.png', metadata: dir + '/spectrogram.json'}};
export const overlayMeta = {title: music.title, artist: 'Flame Runner', phases: [
  {name: 'Upper pickup', t0: 0, t1: 2.231, color: '#426582'},
  {name: 'Dry drums beneath the voice', t0: 2.231, t1: 9.557, color: '#826488'},
  {name: 'Run-up', t0: 9.557, t1: 11.995, color: '#a45643'},
  {name: 'Kick with sung replies', t0: 11.995, t1: 21.759, color: '#448078'},
  {name: 'Upper answers and quick words', t0: 21.759, t1: 32.127, color: '#426582'},
  {name: 'Bass answers', t0: 32.127, t1: 41.891, color: '#a45643'},
  {name: 'Reprise and closing pair', t0: 41.891, t1: 52.351, color: '#826488'},
]};

const strikes: [number, number][] = [
  [.292,.14],[.733,.17],[1.186,.23],[1.337,.10],[1.79,.086],[1.981,.065],
  // The words coincide with several dry drums. The later consonants on their own are tiny.
  [2.231,.96],[2.643,.55],[2.823,.075],[3.108,.80],[3.723,.10],[4.1,.43],
  [4.675,.83],[5.093,.61],[5.285,.07],[5.546,.77],[5.882,.58],
  [6.492,.81],[6.811,.61],[7.113,.85],[7.525,.58],[7.728,.11],[7.978,.72],
  [8.646,.10],[9.255,.12],
  // Three drum strokes, then the last sung pickup across the breath into the full band.
  [9.557,.78],[10.016,.70],[10.468,.84],[10.782,.13],[11.502,.18],
  // The pulse continues under the displaced bass and upper hook. Answer kick two in every bar.
  [11.995,.97],[12.605,.62],[12.918,.43],[13.214,.66],[13.528,.51],[13.824,.73],
  [14.433,.87],[15.049,.64],[15.362,.51],[15.652,.68],[16.268,.76],
  [16.877,.79],[17.487,.65],[17.8,.48],[18.096,.68],[18.41,.54],[18.706,.75],
  [19.321,.88],[19.925,.64],[20.238,.54],[20.534,.66],[21.144,.75],
  // The upper answers take a third short step when it rises clearly over the kick.
  [21.759,.87],[22.369,.62],[22.682,.43],[22.978,.66],[23.292,.50],[23.588,.74],[23.744,.26],
  [24.197,.88],[24.807,.63],[25.114,.51],[25.416,.67],[26.026,.75],
  [26.635,.81],[27.245,.65],[27.564,.49],[27.86,.69],[28.168,.55],[28.464,.75],[28.621,.27],
  [29.079,.91],[29.689,.63],[30.002,.52],[30.298,.69],[30.908,.76],[31.517,.96],
  // Broader low replies, displaced half a beat from the pulse. Let the weaker tails sustain.
  [32.127,.83],[32.44,.35],[32.736,.62],[33.352,.65],[33.955,.84],
  [34.571,.64],[34.878,.51],[35.18,.68],[35.772,.73],[36.399,.79],
  [37.009,.68],[37.322,.37],[37.618,.65],[38.228,.70],[38.814,.88],
  [39.447,.65],[39.76,.49],[40.056,.66],[40.672,.72],[41.275,.88],
  // The upper figure comes back on top. Finish with the two exposed syllables and their sustain.
  [41.885,.70],[42.216,.32],[42.5,.66],[42.808,.40],[43.11,.70],[43.719,.86],
  [44.329,.62],[44.637,.52],[44.938,.67],[45.536,.75],[46.157,.79],
  [46.767,.65],[47.075,.34],[47.382,.67],[47.684,.39],[47.992,.74],
  [48.578,.93],[48.892,.18],[49.211,.62],[49.524,.49],[49.82,.69],
  [50.43,.85],[50.546,.15],[51.045,.37],
];

const spec: Spec = {duration: 52.351, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.47],[2.231,.48],[4.675,.69],[6.811,.53],[7.978,.70],[9.557,.52],[10.788,.64],[11.519,.48],[11.995,.66],[16.372,.48],[21.26,.64],[21.759,.46],[30.548,.62],[32.127,.76],[41.45,.74],[41.891,.44],[48.892,.65],[50.54,.40],[52.351,.32]]),
    speed: curve([[0,.42],[2.231,.76],[4.675,.87],[7.978,.84],[8.646,.52],[9.557,.91],[10.474,.99],[11.995,.89],[17.487,.82],[21.759,.93],[30.548,.95],[31.523,.72],[32.127,.97],[41.45,.96],[41.891,.84],[49.681,.91],[50.54,.82],[51.051,.46],[52.351,.31]]),
  }};
export default spec;
