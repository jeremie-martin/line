/** Fire, then smoke: the drum sentence burns close to the ground, the held notes rise slow and tall.
 * From the approved reading: the distant opening, the two exposed calls, and the strengths.
 * From Sol: in the drum sentence each bar draws out its approach to the sharp answering stroke, quicker
 * and higher into it, low and close for the words between, which are touched more lightly: the spark Opus
 * wanted, in a form the ride shows.
 * From Opus: when the voice leaves the drummer the rider slows right down and climbs into huge, slow
 * arcs over the held G, and higher still over the upper C.
 * Its own: the smoke rises out of the fire rather than after it; over the last bars of the drum sentence
 * the pace eases and the air grows, so the first held note lifts off from a rider already rising.
 * From Sol and Astra: the three drum answers bring it back to the ground, and the last word glides out. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

// As in Sol, the words between the drums are touched more lightly, so the drum strokes stand clear.
const contacts = base.contacts.map(({t, impact = 0}) =>
  t > 4.5 && t < 24.4 && impact < 0.5 ? {t, impact: +(impact * 0.8).toFixed(3)} : {t, impact});
const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length (s); `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

const SMOKE = 24.462, EARTH = 42.03;
/** Smoke: tall slow arcs over the held notes, the upper C the highest. */
const smokeAir = perGap((end, len) => (len > 0.4 ? (end > 34.1 ? 0.95 : 0.9) : 0.6), 0.6);

const air = curve([
  [0,.64],[1.591,.64],[1.927,.38],[2.252,.38],[3.204,.70],[3.646,.84],[4.481,.86],
  [5.77,.48],[7.07,.49],[8.35,.71],[9.65,.52],[10.94,.64],[12.09,.38],[13.51,.68],[14.81,.49],[16.09,.69],
  [17.72,.48],[18.67,.62],[19.40,.54],[21.26,.78],[22.87,.64],[23.83,.76],
  [43.514,.43],[44.48,.38],[44.94,.50],[45.91,.65],[46.98,.52],
]);

const spec: Spec = {...base, contacts,
  axes: {
    air: (t) => (t > SMOKE && t <= EARTH ? smokeAir(t) : air(t)),
    speed: curve([
      [0,.32],[1.591,.32],[1.927,.44],[2.252,.44],[3.204,.56],[3.646,.95],[4.481,.96],
      [5.77,.80],[7.40,.72],[8.35,.89],[9.65,.72],[10.94,.90],[12.23,.73],[13.51,.92],[14.81,.73],[16.09,.91],
      [17.72,.72],[18.67,.84],[19.97,.74],[21.26,.92],[22.87,.78],[24.462,.74],
      [25.321,.62],[33.123,.60],[34.145,.70],[35.48,.56],[42.028,.56],
      [43.51,.80],[44.48,.92],[44.94,.65],[45.91,.47],[46.98,.38],
    ]),
  }};
export default spec;
