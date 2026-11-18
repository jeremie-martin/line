/** Earth, then sky. The stomp is ridden heavy and grounded: the rider trudges low along the line,
 * at a walking pace, and every stomp lands from almost no height. The triplets are a quick skip on
 * tiptoe. After the stomp returns, the empty beat and the two bass notes become three huge bounds, the
 * tallest of the film, and “Pain!” lands from the last of them. From there the rider stays in the air:
 * the chant is a run of high, regular hops on the quarter beats. Under the second drummer it drops
 * into a fast low run, and only the two late snares get a jump of their own, with the stroke just
 * before each made lighter so they land clean. Strengths otherwise as approved. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const contacts = base.contacts.map(({t, impact = 0}) => {
  // Room before the two late snares.
  if (Math.abs(t - 34.633) < 0.01) return {t, impact: 0.36};
  if (Math.abs(t - 44.229) < 0.01) return {t, impact: 0.3};
  return {t, impact};
});

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length; `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};
const near = (end: number, t: number) => Math.abs(end - t) < 0.01;

const amplitude = perGap((end, len) => {
  if (end < 10.1) return 0.02; // Stomp: no height.
  if (end < 13.5) return 0.03; // Triplets: tiptoe.
  if (end < 19.8) return 0.02; // Stomp again.
  if (end < 22.5) return len > 0.9 ? 0.5 : 0.32; // Three bounds.
  if (end < 22.7) return 0.02; // The kick into “Pain!”.
  if (end < 36.1) return near(end, 35.127) ? 0.16 : len > 0.42 ? 0.12 : 0.03; // The chant hops.
  return near(end, 44.74) ? 0.16 : 0.02; // Low run; one jump into the late snare.
}, 0.05);

const air = perGap((end, len) => {
  if (end < 10.1) return 0.34;
  if (end < 13.5) return 0.55;
  if (end < 19.8) return 0.34;
  if (end < 22.5) return 0.94;
  if (end < 22.7) return 0.5;
  if (end < 36.1) return near(end, 35.127) || near(end, 36.055) ? 0.85 : len > 0.42 ? 0.78 : 0.6;
  return near(end, 44.74) ? 0.85 : 0.4;
}, 0.45);

const spec: Spec = {...base, contacts,
  axes: {
    amplitude,
    air,
    speed: curve([
      [0, .62], [5.364, .64], [9.881, .76], [10.148, .86], [12.986, .86], [13.526, .66], [19.761, .68],
      [20.765, .80], [22.646, .90], [35.608, .90], [36.055, .94], [51.084, .97],
    ]),
  }};
export default spec;
