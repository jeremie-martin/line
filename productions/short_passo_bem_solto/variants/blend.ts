/** A loose step that learns to leave the ground, then comes back down to run.
 * The opening sentence is a slow, low ripple on the syllables he placed by hand (Opus); just before the three strokes
 * he marked strong it rises into the approved stride, and those strokes are asked a little stronger, as Opus did, so
 * they are the first real weight. The high answer keeps the approved air and pace.
 * In the treble dance the rider skims low and leaps over the same long space in each phrase, as Astra and Sol found;
 * my own part is that the four leaps grow, each a little longer in the air, the last the highest, until the naked call
 * is one long float on the barest touches (Opus), the room before the drums come back.
 * From the return on it is the approved run and its fraying end, which kept its strong strokes best of the four.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';
export {overlayMeta} from '../spec.ts';

// The three strokes he marked strong, raised above the ripple as Opus did; every other strength is the approved one.
const marked: Record<number, number> = {7.202: .8, 9.048: .95, 10.894: .9};

// The long space in each phrase of the dance, and how high each leap goes.
const leaps: Array<[number, number, number]> = [[15.288, 15.973, .16], [18.98, 19.665, .26], [22.672, 23.357, .36], [26.364, 27.049, .46]];
const leap = (t: number) => leaps.find(([a, b]) => t > a + .03 && t < b - .03);

const flow = {
  air: curve([[0, .38], [6.05, .40], [6.74, .62], [9.04, .64], [14.58, .58], [15.05, .46], [27.1, .46], [27.5, .74], [29.1, .74],
    [29.35, .59], [45.05, .46]]),
  speed: curve([[0, .55], [6.05, .58], [6.74, .74], [9.04, .77], [14.3, .80], [14.6, .78], [27.1, .78], [27.7, .80], [28.9, .86],
    [29.35, .91], [45.05, .75]]),
};

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({t, impact: marked[t] ?? impact})),
  axes: {
    air: (t: number) => {
      const l = leap(t);
      return l ? .74 + (l[2] - .16) * .5 : flow.air(t);
    },
    speed: flow.speed,
    amplitude: (t: number) => {
      const l = leap(t);
      return l ? l[2] : undefined;
    },
  },
};
export default spec;
