/** One held breath and its release. Under the chopped voice the rider tiptoes, slow and close to the
 * line; the dry 808 strokes throw it into tall bounds, and the long silence after them is the highest
 * arc of the film, falling onto the first kick. The first band passage then runs low and flat, gaining
 * speed bar after bar like a held breath, with no lift at all until the stroke before the great
 * downbeat is softened and the rider rises once to meet it. From there the second passage flies: the
 * same groove, ridden high and wide. The last words come down in smaller and smaller bounces.
 * Versus the approved reading: the two band passages, ridden alike there, are here opposites (low run,
 * then flight); strengths keep their order, the first passage's answers are a little softer. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

const contacts = base.contacts.map(({t, impact = 0}) => {
  // The low run: the answers between the kicks stay under the pulse.
  if (t > 9.2 && t < 26.0 && impact < 0.7) return {t, impact: +(impact * 0.9).toFixed(3)};
  // Room before the great downbeat.
  if (Math.abs(t - 26.18) < 0.01) return {t, impact: 0.46};
  return {t, impact};
});

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length; `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

const amplitude = perGap((end, len) => {
  if (end < 4.2) return 0.02; // Tiptoe under the chops.
  if (end < 7.8) return len > 0.5 ? 0.2 : 0.06; // Tall bounds between the 808 strokes.
  if (end < 9.2) return 0.75; // The long silence: the highest arc.
  if (end < 26.1) return 0.02; // The low run.
  if (end < 26.8) return 0.22; // One rise into the downbeat.
  if (end < 43.3) return len > 0.5 ? 0.22 : 0.05; // Flight.
  if (end < 44.4) return 0.08;
  if (end < 45.0) return 0.12;
  return 0.08; // Smaller and smaller echoes.
}, 0.03);

const air = perGap((end, len) => {
  if (end < 4.2) return 0.36;
  if (end < 7.8) return len > 0.5 ? 0.82 : 0.6;
  if (end < 9.2) return 0.92;
  if (end < 26.1) return 0.4;
  if (end < 26.8) return 0.8;
  if (end < 43.3) return len > 0.5 ? 0.84 : 0.68;
  if (end < 45.0) return 0.6;
  return 0.5;
}, 0.45);

const spec: Spec = {...base, contacts,
  axes: {
    amplitude,
    air,
    speed: curve([
      [0, .36], [2.548, .24], [3.895, .26], [4.174, .66], [4.458, .72], [7.755, .72], [8.4, .62], [9.131, .80],
      [12.98, .82], [20.13, .90], [26.18, .97], [26.732, .88], [43.24, .84], [44.339, .55], [45.72, .32], [46.0, .28],
    ]),
  }};
export default spec;
