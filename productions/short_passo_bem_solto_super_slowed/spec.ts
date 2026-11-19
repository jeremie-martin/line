/** Super slowed, the rider glides on the approved line, and a few long breaths become arcs that return like a refrain.
 * The opening he mapped by hand keeps its syllables, strengths and glide; the high answer at six and a half seconds
 * makes the first big rise, as in Sol's reading. The high answer over the bass is the approved one.
 * Under the recurring C my own figure: wherever the C comes after a long breath, the rider rises into it, the same arc
 * each time, so the passage reads as one phrase coming back (Sol lifted into some of them; here it is every one).
 * The drums he marked between keep their approved weight. The five calls float into the return as approved.
 * In the late drums the two heaviest second strokes throw the rider up, with just time to come down for the reply,
 * as Astra found; the rest of that passage and the last syllables are the approved ride.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import base from './variants/approved.ts';
export {overlayMeta} from './variants/approved.ts';

const times = base.contacts.map((c) => c.t);
const end = (t: number) => times.find((x) => x >= t) ?? times[times.length - 1];
const gapBefore = (e: number) => e - (times[times.indexOf(e) - 1] ?? 0);

// The C arrivals of the refrain, and the two heavy second strokes of the late drums.
const cs = [14.693, 16.899, 19.082, 21.287, 23.47, 25.676, 27.87];
const throws = [37.182, 45.97];
const lifts = (t: number): boolean => {
  if (t <= 13.1) return t > 5.95 && t < 6.42;   // the first big rise
  const e = end(t);
  if (t < e - gapBefore(e) + .03 || t > e - .03) return false;   // only inside the gap, not on its ends
  return (cs.includes(e) && gapBefore(e) > .5) || throws.includes(e);
};

const flow = {
  air: curve([[0, .68], [5.37, .66], [6.45, .62], [13.04, .58], [28.4, .60], [28.68, .81], [30.6, .6], [48.16, .51]]),
  speed: curve([[0, .52], [5.37, .56], [6.45, .72], [13.04, .76], [28.68, .74], [30.355, .94], [30.6, .9], [48.16, .73]]),
};

const spec: Spec = {
  ...base,
  axes: {
    air: (t: number) => (lifts(t) ? .84 : flow.air(t)),
    speed: flow.speed,
  },
};
export default spec;
