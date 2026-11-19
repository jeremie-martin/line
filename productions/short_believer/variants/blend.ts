/** The approved ride, which is loved, with the break made into the one great leap of the film.
 * The stomp, the chant, the second drummer and the late snares are as approved, strengths included.
 * From Astra: the triplets slip out from under the stomp in one low, quick run, the little catches
 * softer, like diction, and only the clear stresses landing with weight.
 * From Opus and Astra: across the empty beat and the two bass notes the rider leaves the ground in tall bounds.
 * Its own: two equal bounds, as high as the rider can go, and a third, shorter and lower, so that
 * “Pain!” lands from the air at full speed rather than after a pause on the ground. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const contacts = base.contacts.map(({t, impact = 0}) =>
  t > 10.2 && t < 13.0 && impact < 0.56 ? {t, impact: +(impact * 0.6).toFixed(3)} : {t, impact});

const spec: Spec = {...base, contacts,
  axes: {
    air: curve([[0,0.48], [5.36,0.52], [9.6,0.46], [10.15,0.33], [12.99,0.34], [13.53,0.46], [19.76,0.52], [20.4,0.8],
      [21.72,0.9], [22.48,0.82], [22.65,0.7], [23.60,0.54], [35.13,0.61], [44.74,0.64]]),
    speed: curve([[0,0.69], [5.36,0.75], [9.6,0.86], [10.15,0.92], [12.99,0.92], [13.53,0.77], [19.76,0.69],
      [21.72,0.86], [22.65,0.9], [36.05,0.94]]),
    amplitude: (t) => {
      if (t <= 19.77 || t > 22.49) return undefined;
      if (t <= 21.72) return 0.5; // Two tall bounds, over the empty beat and the first bass note.
      return 0.25; // Third, shorter: down toward “Pain!”.
    },
  }};
export default spec;
