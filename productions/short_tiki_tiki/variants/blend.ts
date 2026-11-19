/** The approved ride he loved, bookended by soft hills and with a clearer tick-tock in the two hooks.
 * Under the solo words the rider rolls over one low, slow swell per brush instead of skimming flat, as Opus had it,
 * and under the closing voice the hills come back, growing as the rider slows to the cut.
 * The four gathering beats, the drop, the reset and both hooks keep the approved air and speed.
 * My own part is in the weights: every stroke he marked as an impact keeps its approved strength, and the other
 * answers between the beats step back in proportion, so the beat and its answer part more clearly without the
 * order he set changing anywhere (the tick-tock Opus wanted, without losing his marks off the beat).
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import base from '../spec.ts';
export {overlayMeta} from '../spec.ts';

// The landings under his impact marks, which keep their approved strength.
const marked = [13.91, 16.927, 17.39, 20.87, 31.31, 34.351, 34.78, 38.26, 39.544, 40.441, 40.87, 41.74];

function strength(t: number, v: number): number {
  if (t < 10.5 || t > 41.7 || (t > 24.3 && t < 27.9) || marked.includes(t)) return v;
  return Math.min(v, +(.72 + (v - .72) * 1.6).toFixed(3));   // the answers step back; the beats stay where they were
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({t, impact: strength(t, impact)})),
  axes: {
    air: (t: number) => (t < 6.2 ? .5 : base.axes.air!(t)),
    speed: base.axes.speed,
  },
};
export default spec;
