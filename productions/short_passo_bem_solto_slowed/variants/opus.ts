/** Slowed, the centre of the song is a swing. Each measure has two long breaths, and the rider uses them: a high,
 * round arc into every strong syllable, then quick low steps through the answer and its small neighbours, so the
 * measure reads as loft, step, step, again and again. The sung opening, mapped by hand, stays as it was, carried low
 * and unhurried; the two low strokes at 7.9 cut it off hard. The exposed link floats, and after 28.9 the broken drums
 * keep a smaller version of the swing: a shorter lift into each bar's heavy head, flat and fast between. The approved
 * reading rode at an even height with the strong and answering syllables close in weight; here the long gaps become
 * height and the answers step back. Most visible from 12.3 to 26.8 s.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base, {overlayMeta} from '../spec.ts';
export {overlayMeta};

const tier = (v: number, steps: Array<[number, number]>) => (steps.find(([min]) => v >= min) ?? steps[steps.length - 1])[1];

function strength(t: number, v: number): number {
  if (t < 7.9) return v;                                                              // his opening, untouched
  if (t < 8.3) return t < 8 ? .97 : .8;                                               // the two low strokes
  if (t < 12.3) return tier(v, [[.6, .5], [.4, .3], [.3, .18], [0, .08]]);
  if (t < 12.4) return .95;
  if (t < 26.8) return tier(v, [[.6, .7], [.45, .4], [0, .14]]);                     // strong, answer, small
  if (t < 28.9) return v * .8;                                                        // the exposed link
  if (t < 29) return .95;
  if (t < 44.5) return tier(v, [[.7, .84], [.6, .64], [.5, .46], [.4, .3], [0, .16]]); // broken drums
  return v;
}

// The long breath before each strong syllable of the centre, and before each heavy bar head of the drums.
const lofts = [13.903, 15.982, 18.054, 20.121, 22.187, 24.265, 26.332];
const halfLofts = [14.942, 17.003, 19.081, 21.154, 23.22, 25.293, 30.993, 33.066, 35.138, 37.21, 39.283, 41.355, 43.428];
const times = base.contacts.map((c) => c.t);

function height(t: number): number | undefined {
  if (t < 12.4 || t > 44.5 || (t > 26.8 && t < 29.2)) return undefined;
  const end = times.find((x) => x >= t) ?? times[times.length - 1];
  if (lofts.includes(end)) return .42;
  if (halfLofts.includes(end)) return end > 29 ? .2 : .16;
  return .04;
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact}) => ({t, impact: strength(t, impact ?? 0)})),
  axes: {
    air: curve([[0, .44], [5.6, .46], [6.12, .58], [7.9, .6], [12.34, .66], [26.6, .66], [27.1, .76], [28.7, .72], [29.32, .56], [44.47, .54], [47.03, .5]]),
    speed: curve([[0, .6], [5.6, .62], [6.12, .7], [7.9, .76], [12.34, .74], [26.6, .74], [27.1, .8], [28.9, .88], [29.32, .9], [44.47, .9], [47.03, .74]]),
    amplitude: height,
  },
};
export default spec;
