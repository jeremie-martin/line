/** A ball that learns to bounce, bounces, and comes to rest.
 * From the approved reading: the last words, the flat fast roll, and the bass restart ridden at its even,
 * moderate height with every bass stroke at its approved weight (the drumless rolling of Opus was weaker there).
 * From Opus and Astra: over the little calls the rider slows and lifts once, and the lone drum stride
 * is the bounce itself: slow, tall, regular hops, one per step, every step the same height.
 * From Opus: when the high answers enter, each bounce gains a small skip on its answer; as in Sol, the
 * answers are lighter than the drum, so each pair reads as one heavy step and its echo.
 * From Astra: the upper phrase gets broad, unhurried arcs. Its own: the ticking treble at the end lets
 * the ball settle, each bounce lower than the one before, down to the line at the cut. */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import base from './variants/approved.ts';

export {overlayMeta} from './variants/approved.ts';

const contacts = base.contacts.map(({t, impact = 0}) =>
  t >= 22.19 && t < 32.6 && impact < 0.5 ? {t, impact: +(impact * 0.7).toFixed(3)} : {t, impact});

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length (s); `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number | undefined, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

const approvedAir = curve([[0,.44],[.342,.44],[.957,.30],[3.419,.30],[3.721,.62],[11.662,.62]]);

const air = perGap((end, len) => {
  if (end < 11.8) return approvedAir(end);
  if (end < 13.5) return len > 0.5 ? 0.8 : 0.55; // A lift over the calls...
  if (end < 22.1) return 0.88; // The bounce.
  if (end < 32.6) return len > 0.35 ? 0.86 : 0.45; // Bounce and skip.
  if (end < 43.0) return len > 0.25 ? 0.76 : 0.55; // Broad arcs.
  return 0.6 - 0.22 * (end - 43.0) / 2.7; // Settling, lower each time.
}, 0.36);

const spec: Spec = {...base, contacts,
  axes: {
    air,
    speed: curve([
      [0,.56],[.342,.56],[.957,.86],[3.419,.86],[3.721,.78],[11.662,.76],[11.975,.48],[13.171,.56],[13.473,.64],
      [21.403,.64],[22.006,.74],[32.374,.78],[32.688,.72],[42.068,.68],[43.078,.6],[45.979,.56],
    ]),
  }};
export default spec;
