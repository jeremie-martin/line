/** A bouncing hammer and a long slide. In the drum bursts the rider pounds the half-second pulse like a ball dropped
 * on stone: one tall, identical arc onto every slam, only the soft pickups of the doubles skimmed low, so the bursts
 * read as one steady, mechanical bounce. Within each bar the lesser slams are a little softer than before so the
 * accents carry. Between the bursts the descending voice is one smooth, low slide down its scale, slower and without
 * the earlier ups and downs, except one long float over the held note at 25.1; then the words shorten and the slide
 * gathers speed into the last burst, whose first slam comes out of a few lighter syllables. The quick words in the
 * hole at 16.5 are ridden as they were.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

const bursts: Array<[number, number]> = [[8.09, 16.1], [18.09, 22.1], [32.09, 47.6]];
const inBurst = (t: number) => bursts.some(([a, b]) => t >= a - .01 && t <= b + .01);

const strikes = base.contacts.map(({t, impact = 0}): [number, number] => {
  // The lesser slams soften so the accents of each bar stand out; the slams of .8 and above keep their weight.
  if (inBurst(t) && impact >= .6 && impact < .8) return [t, Number((impact * .86).toFixed(3))];
  // The last few quick syllables before the final burst lighten, leaving the slam at 32.09 alone.
  if (t > 31.4 && t < 32) return [t, Number((impact * .7).toFixed(3))];
  return [t, impact];
});

const times = strikes.map(([t]) => t);
/** The tallest arc a span of `dt` seconds allows (a free flight from landing to landing), on the 60 px scale. */
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);
function share(t: number, dt: number): number {
  if (t > 7.5 && t < 8.1) return 1;                    // room before the first slam
  if (inBurst(t)) return dt >= .45 ? .95 : .1;          // the hammer: a tall arc onto every slam, pickups skimmed
  if (t > 25.1 && t < 26.11) return .9;                 // the held note
  if (t > 22.5 && t < 32.09) return .15;                // the slide
  if (t < 4.1) return .5;
  return .3;
}
const amplitude = (t: number): number => {
  const i = times.findIndex((ct) => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const dt = times[k] - (k > 0 ? times[k - 1] : 0);
  return share(times[k], dt) * fullArc(dt);
};

const spec: Spec = {
  ...base,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    // The hole at 16.6–17.6 keeps its approved air and speed.
    air: curve([
      [0,.50],[3.601,.50],[4.1,.54],[7.3,.66],[7.595,.80],[8.094,.76],[16.093,.76],[16.616,.26],[17.591,.26],
      [18.09,.76],[22.096,.76],[22.607,.54],[25.0,.52],[25.138,.84],[26.0,.84],[26.2,.52],[27.8,.52],[29.2,.46],
      [31.6,.50],[32.092,.76],[38.605,.76],[39.116,.38],[39.975,.38],[40.103,.76],[47.591,.76],[47.719,.52],[48.019,.52],
    ]),
    speed: curve([
      [0,.36],[3.601,.38],[4.1,.60],[7.85,.80],[8.094,.92],[16.093,.92],[16.616,.82],[17.591,.82],[18.09,.92],
      [22.096,.92],[22.607,.66],[27.2,.62],[27.843,.70],[29.2,.86],[31.8,1],[32.092,.98],[38.605,.98],[39.116,.72],
      [39.975,.90],[40.103,.98],[47.591,.98],[48.019,.92],
    ]),
    amplitude,
  },
};
export default spec;
