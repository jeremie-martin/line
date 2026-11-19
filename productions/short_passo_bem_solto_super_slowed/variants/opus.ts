/** Super slowed, the rider glides. It stays down on the line and moves at an unhurried pace, and the small notes
 * between the calls become ripples it rolls over rather than steps it lands on; what remains as weight is the
 * recurring C, the drum strokes he asked for under it (14.1, 18.5, 20.7, 22.9, 27.3) and the strong strokes of the
 * high answer. The hand-mapped opening keeps its syllables as they were. The five unaccompanied calls are the one
 * place it lifts and floats, the held breath before the return at 30.6, and the drum pairs after it glide again,
 * a little faster, heads firm and pickups soft. The approved reading hopped through every note at a brisker pace;
 * this one should look like one long line with a few deep strokes in it, most of all from 13 to 28 s.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base, {overlayMeta} from './approved.ts';
export {overlayMeta};

const tier = (v: number, steps: Array<[number, number]>) => (steps.find(([min]) => v >= min) ?? steps[steps.length - 1])[1];

function strength(t: number, v: number): number {
  if (t < 6.4) return v;                                                              // his opening
  if (t < 13) return tier(v, [[.95, .97], [.85, .9], [.75, .8], [.6, .62], [.5, .4], [.4, .24], [0, .1]]);
  if (t < 13.1) return .95;                                                           // the first C
  if (t < 28.6) return tier(v, [[.72, .76], [.6, .7], [.49, .46], [.3, .22], [0, .05]]); // C, his drums, ripples
  if (t < 30.5) return v * .6;                                                        // the five calls
  if (t < 30.7) return 1;                                                             // the return
  if (t < 48.1) return tier(v, [[.8, .86], [.65, .68], [.55, .5], [.4, .28], [0, .1]]);
  return v * .9;
}

const glide = (t: number) => (t > 13 && t < 28.6) || (t > 30.7 && t < 48.1);

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact}) => ({t, impact: strength(t, impact ?? 0)})),
  axes: {
    air: curve([[0, .56], [6.45, .54], [12.7, .5], [13.4, .38], [28.3, .38], [28.9, .78], [30.2, .76], [30.9, .42], [47.9, .42], [49.78, .5]]),
    speed: curve([[0, .5], [6.45, .58], [13.04, .6], [28.3, .62], [29, .68], [30.4, .76], [31, .8], [47.9, .8], [49.78, .68]]),
    amplitude: (t: number) => (glide(t) ? .03 : undefined),
  },
};
export default spec;
