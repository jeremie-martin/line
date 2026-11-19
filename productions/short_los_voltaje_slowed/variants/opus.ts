/** Three leaps, a fuse, then a pendulum. The opening calls hang high in the air over their long rests, each call a
 * small skip on the line before the next tall leap; as the calls gather the leaps shrink, and the quick voice runs
 * flat and low along the line, faster and faster, like a lit fuse, into the first kick. From there the body swings:
 * every kick that is followed by a kick is one full arc over the beat, and where the singer speaks between two kicks
 * the rider only skims the word and swings on. The plain kicks are a little softer than before and the accented ones
 * keep their weight, so the downbeat pattern reads in the motion. When the treble loop takes over the hook the swing
 * grows taller and slightly slower, and the last three words drift out high and unhurried.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

type Strike = [time: number, impact: number];
type Kind = 'call' | 'answer' | 'quick' | 'kick' | 'word' | 'last';

const calls: Strike[] = [
  [.491,.18],[.689,.08],[1.049,.12],
  [2.663,.24],[2.883,.12],[3.220,.15],
  [4.845,.25],[5.066,.12],[5.414,.19],
  [7.039,.39],[7.318,.25],[7.574,.33],[8.154,.30],[8.479,.20],
  [9.245,.42],[9.443,.19],[9.791,.28],
];
const answers: Strike[] = [
  [5.937,.22],[6.192,.30],[6.482,.26],
  [10.023,.35],[10.313,.31],[10.569,.46],[10.859,.42],[11.126,.26],[11.405,.52],
];
// The quick voice is a patter: even and lighter, thinning out just before the first kick so it lands into space.
const quick: Strike[] = [
  [11.672,.34],[11.962,.22],[12.218,.27],[12.508,.36],[12.670,.18],[12.856,.21],[13.100,.25],
  [13.587,.30],[13.808,.22],[13.982,.23],[14.168,.25],[14.354,.28],[14.539,.23],
  [14.737,.20],[14.923,.24],[15.097,.20],[15.306,.22],[15.468,.15],[15.631,.14],
];
// Plain kicks a touch softer, accented kicks as they were: the same order, more contrast.
const kicks: Strike[] = [
  [15.770,1],[16.339,.47],[16.873,.53],[17.419,.50],[17.964,.83],[18.522,.47],
  [19.067,.51],[19.613,.52],[19.880,.78],[20.159,.78],[20.716,.47],[21.250,.52],
  [21.796,.50],[22.341,.82],[22.899,.72],[23.444,.90],[23.990,.82],[24.536,.83],
  [25.081,.48],[25.627,.50],[26.173,.52],[26.718,.85],[27.276,.47],[27.821,.51],
  [28.367,.52],[28.634,.76],[28.913,.74],[29.458,.50],[30.004,.51],[30.550,.53],
  [31.095,.80],[31.641,.72],[32.187,.91],[32.744,.78],[33.290,.80],[33.835,.48],
  [34.381,.49],[34.927,.53],[35.472,.78],[36.030,.48],[36.564,.47],[37.121,.46],
  [37.388,.85],[37.667,.73],[38.212,.47],[38.758,.49],[39.304,.52],[39.849,.77],
  [40.395,.74],[40.941,.83],[41.486,.71],[42.044,.79],[42.589,.48],[43.135,.50],
  [43.681,.52],[44.226,.77],[44.783,.49],[45.329,.49],[45.875,.46],[46.153,.83],
  [46.432,.68],[46.966,.49],[47.512,.48],[48.058,.51],[48.603,.77],[49.160,.74],
  [49.706,.85],[50.252,.74],
];
// The sung words between kicks are skimmed: lighter than the plain kicks around them.
const words: Strike[] = [
  [16.049,.36],[17.639,.33],[18.255,.30],[19.207,.27],[19.752,.23],[21.413,.28],
  [21.982,.29],[22.643,.31],[23.677,.39],[24.222,.33],[26.324,.28],[27.020,.31],
  [28.471,.32],[30.782,.30],[32.431,.37],[32.988,.34],
  [34.544,.31],[35.089,.29],[35.635,.27],[36.715,.31],[37.260,.27],[38.920,.30],
  [39.466,.29],[40.116,.35],[41.742,.34],[43.297,.29],[43.913,.31],[44.389,.28],
  [46.014,.27],[47.674,.30],[48.290,.30],[48.882,.33],
];
const lastWords: Strike[] = [[50.484,.40],[50.832,.44],[51.390,.38]];

const all: Array<[number, number, Kind]> = [
  ...calls.map(([t, i]) => [t, i, 'call'] as [number, number, Kind]),
  ...answers.map(([t, i]) => [t, i, 'answer'] as [number, number, Kind]),
  ...quick.map(([t, i]) => [t, i, 'quick'] as [number, number, Kind]),
  ...kicks.map(([t, i]) => [t, i, 'kick'] as [number, number, Kind]),
  ...words.map(([t, i]) => [t, i, 'word'] as [number, number, Kind]),
  ...lastWords.map(([t, i]) => [t, i, 'last'] as [number, number, Kind]),
].sort((a, b) => a[0] - b[0]);

/** The height of the arc over each span between two landings (0 = flat along the line, 1 = 60 px above it). */
function arcHeight(prev: [number, number, Kind] | undefined, next: [number, number, Kind]): number {
  const dt = next[0] - (prev?.[0] ?? 0);
  const t = next[0];
  if (t < 11.6) return dt > 1 ? .9 : dt > .45 ? .22 : .03;     // tall leaps over the rests, skips inside a call
  if (t < 15.7) return 0;                                       // the fuse: flat
  if (next[2] === 'word' || next[2] === 'last' && dt < .4) return .03; // skim the word
  const swing = t < 34.4 ? .2 : .28;                            // the swing grows when the loop arrives
  return prev?.[2] === 'kick' ? swing : swing * .55;            // a full arc kick to kick, a half arc word to kick
}

const amplitude = (t: number): number => {
  const i = all.findIndex(([ct]) => ct >= t);
  const k = i < 0 ? all.length - 1 : i;
  return arcHeight(all[k - 1], all[k]);
};

const spec: Spec = {
  ...base,
  contacts: all.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([
      [0,.82],[.491,.40],[1.049,.86],[2.429,.86],[2.663,.38],[3.220,.86],[4.629,.86],[4.845,.38],[5.414,.66],
      [5.937,.50],[7.039,.46],[9.791,.42],[10.023,.36],[11.405,.32],[11.672,.20],[15.468,.20],[15.631,.40],
      [15.770,.60],[16.339,.56],[34.0,.56],[35.0,.68],[50.252,.68],[50.484,.78],[51.479,.84],
    ]),
    speed: curve([
      [0,.30],[5.414,.32],[5.937,.48],[7.039,.56],[9.791,.60],[10.023,.66],[11.405,.68],[11.672,.72],
      [13.587,.84],[15.306,1],[15.770,1],[16.339,.92],[34.0,.92],[35.0,.84],[50.252,.84],[50.484,.62],[51.479,.50],
    ]),
    amplitude,
  },
};
export default spec;
