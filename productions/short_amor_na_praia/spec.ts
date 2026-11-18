/** The cut opens halfway through the upper figure. The last upper note carries into the drum. The first playable reply is
 * quiet enough to leave the isolated drum at 2.231 on its own scale. The singer
 * takes over, with two short percussion answers and a three-stroke run-up.
 * In the first full phrase the little B's cross a steady kick. At 21.76 the
 * upper notes answer in threes, then the rapid words lead into four bars of
 * broader bass. One low reply per bar is enough to hear its displacement.
 * The upper figure returns and hands the ending to the voice. The last word
 * sustains through the cut. The balance of singer and drum at 6.8–7.7 is open.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const dir = 'productions/short_amor_na_praia';
const music = {title: 'Amor Na Praia (Slowed)', audio: dir + '/audio.mp3', beats: dir + '/audio.json',
  spectrogram: {image: dir + '/spectrogram.png', metadata: dir + '/spectrogram.json'}};
export const overlayMeta = {title: music.title, artist: 'Flame Runner', phases: [
  {name: 'Upper pickup', t0: 0, t1: 2.231, color: '#426582'},
  {name: 'Voice and two drum answers', t0: 2.231, t1: 9.557, color: '#826488'},
  {name: 'Run-up', t0: 9.557, t1: 11.995, color: '#a45643'},
  {name: 'Kick with sung replies', t0: 11.995, t1: 21.759, color: '#448078'},
  {name: 'Upper answers and quick words', t0: 21.759, t1: 32.127, color: '#426582'},
  {name: 'Bass answers', t0: 32.127, t1: 41.891, color: '#a45643'},
  {name: 'Reprise and closing pair', t0: 41.891, t1: 52.351, color: '#826488'},
]};

const strikes: [number, number][] = [
  [.292,.19],[.733,.218],[1.186,.264],[1.337,.177],
  // Drum, then the voice. Keep the second syllable of the short answers light.
  [2.231,.937],[2.568,.271],[2.835,.308],[3.125,.401],[3.473,.247],[3.729,.349],
  [4.089,.279],[4.704,.463],[5.099,.357],[5.296,.304],[5.598,.261],[6.19,.239],
  [6.492,.387],[6.805,.452],[7.119,.554],[7.734,.424],[8.199,.227],[8.338,.324],
  [8.628,.316],[8.942,.289],[9.336,.216],
  [9.557,.714],[9.836,.435],[10.01,.602],[10.219,.274],[10.474,.673],
  [10.788,.466],[11.043,.361],[11.229,.252],[11.519,.383],
  // Keep the full kick pulse except where the displaced words take its place.
  [11.995,.979],[12.61,.629],[12.75,.229],[13.214,.584],[13.365,.366],[13.679,.246],
  [13.829,.715],[14.271,.249],[14.433,.793],[15.049,.619],[15.199,.309],[15.513,.243],
  [15.652,.656],[16.082,.361],[16.372,.287],[16.871,.723],[17.487,.687],[17.614,.221],
  [18.102,.672],[18.253,.426],[18.706,.749],[19.019,.369],[19.321,.811],[19.484,.265],
  [19.925,.603],[20.076,.318],[20.401,.276],[20.54,.648],[20.97,.251],[21.26,.398],
  // Two offbeats and a displaced third. The later pair of words lifts out of the figure.
  [21.759,.819],[22.363,.583],[22.688,.455],[22.978,.632],[23.292,.502],[23.744,.534],
  [24.197,.773],[24.812,.592],[25.114,.558],[25.416,.613],[26.032,.684],[26.635,.736],
  [27.251,.657],[27.564,.531],[28.168,.579],[28.47,.702],[28.621,.492],[29.073,.804],
  [29.689,.572],[30.002,.548],[30.292,.627],[30.548,.284],[31.024,.439],[31.523,.812],
  [31.639,.237],
  // Four low replies slip behind the kick, each at a different distance.
  [32.127,.895],[32.742,.608],[33.346,.591],[33.961,.761],[34.077,.341],[34.565,.624],
  [35.18,.616],[35.784,.689],[36.399,.727],[36.585,.398],[37.015,.684],[37.618,.622],
  [38.234,.699],[38.826,.795],[38.942,.323],[39.453,.621],[40.056,.637],[40.672,.669],
  [41.275,.784],[41.45,.362],
  [41.891,.665],[42.216,.372],[42.494,.621],[42.808,.394],[43.261,.469],[43.725,.785],
  [44.329,.579],[44.642,.556],[44.944,.631],[45.548,.714],[46.163,.681],[46.767,.617],
  [47.08,.387],[47.382,.651],[47.684,.422],[47.986,.639],[48.137,.369],[48.59,.802],
  [48.892,.446],[49.205,.663],[49.368,.309],[49.681,.331],[50.262,.288],[50.424,.848],
  [50.54,.347],[51.051,.472],
];

const spec: Spec = {duration: 52.351, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.47],[2.231,.48],[4.704,.66],[6.805,.47],[7.734,.68],[9.557,.52],[10.788,.64],[11.519,.48],[11.995,.66],[16.372,.48],[21.26,.64],[21.759,.46],[30.548,.62],[32.127,.76],[41.45,.74],[41.891,.44],[48.892,.65],[50.54,.40],[52.351,.32]]),
    speed: curve([[0,.42],[2.231,.61],[8.628,.62],[9.557,.91],[10.474,.99],[11.995,.89],[17.487,.82],[21.759,.93],[30.548,.95],[31.523,.72],[32.127,.97],[41.45,.96],[41.891,.84],[49.681,.91],[50.54,.82],[51.051,.46],[52.351,.31]]),
  }};
export default spec;
