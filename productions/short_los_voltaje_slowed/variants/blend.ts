/**
 * Two leaps, a fuse, a pendulum. The calls hang over their long rests as in the approved reading, but each rest is now
 * a real leap, the second taller than the first, so the opening rises (Opus's leaps, made into a rise of my own).
 * The quick voice runs low and flat, faster and faster, and thins just before the first kick so that kick lands into
 * space, the strongest moment of the song (Opus). From there the rider swings from kick to kick and only skims the
 * words between them; plain kicks a little softer, accented kicks as they were (Opus). Where the accented kicks
 * cluster, around 23 and 32 seconds, the swing opens up a little more air (Astra and Sol). When the treble loop
 * takes the hook the swing grows taller and slightly slower, and the last three words drift out high (Opus).
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

// The sung words between kicks (the approved reading's hook list).
const words = new Set([
  16.049, 17.639, 18.255, 19.207, 19.752, 21.413, 21.982, 22.643, 23.677, 24.222, 26.324, 27.020,
  28.471, 30.782, 32.431, 32.988, 34.544, 35.089, 35.635, 36.715, 37.260, 38.920, 39.466, 40.116,
  41.742, 43.297, 43.913, 44.389, 46.014, 47.674, 48.290, 48.882,
]);
type Kind = 'call' | 'quick' | 'kick' | 'word' | 'last';
const kind = (t: number): Kind =>
  t < 11.6 ? 'call' : t < 15.7 ? 'quick' : t > 50.4 ? 'last' : words.has(t) ? 'word' : 'kick';

function strength(t: number, impact: number): number {
  switch (kind(t)) {
    case 'quick': return impact * (t > 15.4 ? .55 : .8);      // a patter, thinning before the first kick
    case 'kick': return t === 15.77 ? 1 : impact < .62 ? impact * .9 : impact; // plain kicks softer, accents kept
    case 'word': return impact * .82;                          // skimmed
    default: return impact;
  }
}

const contacts = base.contacts.map(({t, impact = 0}) => ({t, impact: Number(strength(t, impact).toFixed(3))}));

const spec: Spec = {
  ...base,
  contacts,
  axes: {
    air: curve([
      [0,.78],[.491,.40],[1.049,.80],[2.429,.82],[2.663,.38],[3.220,.84],[4.629,.88],[4.845,.38],[5.414,.64],
      [5.937,.48],[7.039,.44],[9.791,.42],[10.023,.36],[11.405,.32],[11.672,.22],[15.468,.22],[15.631,.40],
      [15.770,.58],[16.339,.56],[21.8,.56],[22.6,.64],[24.6,.64],[25.4,.56],[30.6,.56],[31.3,.64],[33.4,.64],
      [34.0,.58],[35.0,.66],[50.252,.66],[50.484,.76],[51.479,.80],
    ]),
    speed: curve([
      [0,.34],[5.414,.36],[5.937,.52],[7.039,.60],[9.791,.62],[10.023,.66],[11.405,.68],[11.672,.74],
      [13.587,.86],[15.306,1],[15.770,1],[16.339,.93],[34.0,.93],[35.0,.86],[50.252,.86],[50.484,.62],[51.479,.52],
    ]),
  },
};
export default spec;
