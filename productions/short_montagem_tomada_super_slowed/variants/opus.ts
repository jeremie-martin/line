/** Airborne, then stamping. For the long opening the rider swings with the upper figure: the two wide strokes of every
 * bar are two tall, slow arcs and the six close ones a low ripple along the line, and the swing changes with the voice:
 * small and slow under the held call, wider and quicker when the figure is left alone at 6.2, hushed and low when the
 * voice returns, and widening again into the swell. The quick voice before the drum is a light run gathering speed.
 * Then the drum puts the foot down and the motion turns over: from 20.1 to the end the rider stays low and fast,
 * stamping along the line on the quarters, with no tall arcs left, except the long syllable at 28.9, which is ridden
 * like the run before the first drum and lands on the second downstroke at full weight.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const DRUM = 20.093;
const runs = [[18.7, DRUM], [28.6, 29.95]] as const;      // the light voice runs into a downstroke
const inRun = (t: number) => runs.some(([a, b]) => t > a && t < b - .01);

const strikes = base.contacts.map(({t, impact = 0}): [number, number] => {
  // The figure under the returning voice whispers a little more, so the solo figure before it and the rise after it
  // stand out; the strokes a word or a low entry shares (.5 and above) keep their weight.
  if (t > 8.97 && t < 14.5 && impact < .5) return [t, Number((impact * .8).toFixed(3))];
  return [t, impact];
});
const times = strikes.map(([t]) => t);
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);
/** How wide the swing is in each part of the opening: share of the tallest arc the wide strokes take. */
const swing = (t: number): number => t < 6.23 ? .6 : t < 8.97 ? 1 : t < 14.5 ? .45 : .9;

const amplitude = (t: number): number => {
  const i = times.findIndex((ct) => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const dt = times[k] - (k > 0 ? times[k - 1] : 0);
  const end = times[k];
  if (inRun(end)) return .02;
  if (end > DRUM + .01) return .15 * fullArc(dt);            // stamping: flat
  return (dt >= .4 ? swing(end) : .2) * fullArc(dt);
};
/** Air in the opening: high over the wide strokes, low on the ripple. */
const openingAir = (t: number): number => {
  const i = times.findIndex((ct) => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const dt = times[k] - (k > 0 ? times[k - 1] : 0);
  const wide = .62 + .22 * swing(times[k]);
  return dt >= .4 ? wide : wide - .2;
};
const runAndDrumAir = curve([
  [18.6,.60],[DRUM - .05,.50],[DRUM,.56],[28.5,.50],[28.6,.56],[29.9,.50],[29.95,.52],[39.6,.50],[39.81,.58],[41.361,.62],
]);
const air = (t: number): number | undefined => (t < 18.6 ? openingAir(t) : runAndDrumAir(t));

const spec: Spec = {
  ...base,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air,
    speed: curve([
      [0,.40],[6.0,.46],[6.23,.62],[8.8,.66],[8.97,.52],[14.3,.54],[17.6,.68],[18.7,.70],[DRUM,.96],[28.5,1],
      [28.6,.74],[29.9,.94],[29.95,1],[39.6,1],[39.81,.86],[41.361,.60],
    ]),
    amplitude,
  },
};
export default spec;
