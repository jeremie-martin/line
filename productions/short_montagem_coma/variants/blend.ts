/**
 * A bouncing hammer and a long slide (Opus's reading, whose ride is the cleanest of the four and lands the last
 * burst hardest). In the drum bursts the rider pounds the half-second pulse with one tall, identical arc onto every
 * slam, the soft pickups of the doubles skimmed low, the lesser slams of each bar a little softer so the accents carry.
 * The quick words in the hole at 16.5 are ridden exactly as approved. Between the bursts the descending voice is one
 * smooth low slide, and here the reading is my own: the slide brakes as the voice comes down to the held note at
 * 25.1, floats slowly over it (the stretch Sol and Astra gave it), and only then gathers speed again through the
 * shortening words into the last burst, whose first slam comes out of a few lighter syllables (Opus).
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const bursts: Array<[number, number]> = [[8.09, 16.1], [18.09, 22.1], [32.09, 47.6]];
const inBurst = (t: number) => bursts.some(([a, b]) => t >= a - .01 && t <= b + .01);

function strength(t: number, impact: number): number {
  if (inBurst(t) && impact >= .6 && impact < .8) return impact * .86;   // lesser slams soften, accents keep
  if (t > 31.4 && t < 32) return impact * .7;                          // the syllables before the last burst
  return impact;
}
const strikes = base.contacts.map(({t, impact = 0}): [number, number] => [t, Number(strength(t, impact).toFixed(3))]);

const spec: Spec = {
  ...base,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([
      [0,.50],[3.601,.50],[4.1,.54],[7.3,.66],[7.595,.80],[8.094,.76],[16.093,.76],[16.616,.26],[17.591,.26],
      [18.09,.76],[22.096,.76],[22.607,.54],[25.0,.52],[25.138,.84],[26.0,.84],[26.2,.52],[27.8,.52],[29.2,.46],
      [31.6,.50],[32.092,.76],[38.605,.76],[39.116,.38],[39.975,.38],[40.103,.76],[47.591,.76],[47.719,.52],[48.019,.52],
    ]),
    speed: curve([
      [0,.36],[3.601,.38],[4.1,.60],[7.85,.80],[8.094,.92],[16.093,.92],[16.616,.82],[17.591,.82],[18.09,.92],
      [22.096,.92],[22.607,.66],[24.6,.56],[25.138,.48],[26.0,.48],[26.6,.58],[27.843,.70],[29.2,.86],[31.8,1],
      [32.092,.98],[38.605,.98],[39.116,.72],[39.975,.90],[40.103,.98],[47.591,.98],[48.019,.92],
    ]),
  },
};
export default spec;
