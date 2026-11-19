/** The verse limps and the chorus bounds. Under the words the rider glides almost level, softer than before. When the
 * three stresses arrive it takes up their long-long-short lilt in its height: two arcs and a skip, two arcs and a
 * skip; once the small percussion fills the spaces the lilt stays in the weights and the little steps run flat
 * beneath it. The exposed E and G hang slow and high. Then each heavy release of the chorus throws the rider into a
 * tall bound through the gap that follows it, with the close answering pairs taken low and quick, so the chorus
 * breathes in big arcs that the verse never had. The approved reading kept the chorus at one height and pace; here
 * the difference between verse and chorus is drawn in the air. Most visible from 29 s on.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base, {overlayMeta} from './approved.ts';
export {overlayMeta};

function strength(t: number, v: number): number {
  if (t < 1) return v;                                       // the crash
  if (t < 12.5) return v > .2 ? .18 : .08;                    // words, quieter
  if (t < 14.7) return v * .85;
  if (t < 27.7) return v < .25 ? Math.min(v, .14) * .8 + .02 : v;   // the lilt keeps its weights, the fill recedes
  if (t < 29) return v * .7;                                 // exposed E and G
  return v;                                                  // the chorus as he approved it
}

const times = base.contacts.map((c) => c.t);
function height(t: number): number | undefined {
  const i = times.findIndex((x) => x >= t);
  if (i <= 0) return undefined;
  const end = times[i];
  const gap = end - times[i - 1];
  if (end < 14.7) return gap > .4 ? .1 : .03;                // a level glide
  if (end < 27.7) return gap > .6 ? .36 : gap > .4 ? .12 : .03;   // the lilt: arc, arc, skip
  if (end < 29.1) return gap > .4 ? .22 : .06;
  if (end < 43.7) return gap > .8 ? .72 : gap > .5 ? .38 : .03;  // the bounds of the chorus
  return .2;
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact}) => ({t, impact: strength(t, impact ?? 0)})),
  axes: {
    air: curve([[0, .44], [12.5, .46], [14.7, .56], [18.3, .56], [18.6, .5], [27.5, .5], [27.9, .8], [28.8, .78], [29.03, .72], [43.7, .74], [44.65, .7]]),
    speed: curve([[0, .38], [12.5, .46], [14.7, .7], [27.5, .72], [27.9, .6], [28.8, .74], [29.03, .86], [43.7, .86], [44.65, .55]]),
    amplitude: height,
  },
};
export default spec;
