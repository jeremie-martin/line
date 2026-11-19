/** A held breath and its release, as Opus reads it, and then a long exhale.
 * Under the chopped voice the rider tiptoes, slow and close to the line, every chop as small as approved.
 * From Opus: the dry 808 strokes throw it into tall bounds, the silence after them is the highest arc,
 * the first band passage runs low and flat gathering speed, and one rise in its last bar meets the great downbeat.
 * From there the same groove is ridden high and wide, rising over each long step.
 * Its own: the flight does not stop at once; over the last phrase it comes down step by step and slows,
 * and, as in Sol, the two echoes drift away higher and farther apart while the pace falls.
 * All strengths are the approved ones, except Opus's slightly softer answers in the low run. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const contacts = base.contacts.map(({t, impact = 0}) =>
  t > 9.2 && t < 26.0 && impact < 0.7 ? {t, impact: +(impact * 0.9).toFixed(3)} : {t, impact});

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length (s); `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

const air = perGap((end, len) => {
  if (end < 4.2) return 0.36; // Tiptoe under the chops.
  if (end < 7.8) return len > 0.5 ? 0.82 : 0.6; // Tall bounds between the 808 strokes.
  if (end < 9.2) return 0.92; // The silence: the highest arc.
  if (end < 25.1) return 0.4; // The low run.
  if (end < 26.8) return 0.78; // The last bar rises to meet the downbeat.
  if (end < 39.95) return len > 0.5 ? 0.84 : 0.68; // Flight.
  if (end < 43.3) return len > 0.5 ? 0.72 : 0.56; // Coming down over the last phrase.
  if (end < 44.4) return 0.55; // The last words.
  return end < 45 ? 0.68 : 0.8; // The echoes drift.
}, 0.6);

const spec: Spec = {...base, contacts,
  axes: {
    air,
    speed: curve([
      [0, .36], [2.548, .24], [3.895, .26], [4.174, .66], [4.458, .72], [7.755, .72], [8.4, .62], [9.131, .80],
      [12.98, .82], [20.13, .90], [26.18, .96], [26.732, .88], [39.93, .86], [43.24, .70], [44.339, .50],
      [45.72, .28], [46.0, .24],
    ]),
  }};
export default spec;
