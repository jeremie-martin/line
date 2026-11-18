/** A ball learning to bounce, in slow motion. The roll skitters fast and flat along the line. When
 * the bass restarts alone the rider rolls with it, low and smooth, the strokes softened a little,
 * because there are no drums yet. Over the little calls it slows and lifts once; then the drum stride
 * is the bounce itself: slow, tall, regular hops, one per step, every step the same height. When the
 * high answers enter each bounce gains a small skip on its answer. The upper phrase stretches into
 * broader, floating arcs, and the ticking treble at the end lets the ball settle low.
 * The approved reading rides the stride and the answers fast and fairly flat; here they are its
 * tallest, slowest part, and the drumless bass passage is its lowest. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const contacts = base.contacts.map(({t, impact = 0}) => {
  // The bass alone: rolled, not struck.
  if (t > 4 && t < 11.8) return {t, impact: +(impact * 0.82).toFixed(3)};
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
  if (end < 1.3) return 0.06;
  if (end < 3.5) return 0.01; // The roll: flat.
  if (end < 11.8) return 0.03; // Rolling with the bass.
  if (end < 13.2) return len > 0.5 ? 0.2 : 0.04; // A lift over the calls...
  if (end < 13.5) return 0.04; // ...into the stride.
  if (end < 22.1) return len > 0.5 ? 0.22 : 0.05; // The bounce.
  if (end < 32.6) return len > 0.35 ? 0.12 : 0.01; // Bounce and skip.
  if (end < 43.0) return len > 0.5 ? 0.24 : len > 0.25 ? 0.08 : 0.02; // Broad arcs.
  return 0.03; // Settling.
}, 0.04);

const air = perGap((end, len) => {
  if (end < 1.3) return 0.44;
  if (end < 3.5) return 0.3;
  if (end < 11.8) return 0.32;
  if (end < 13.5) return len > 0.5 ? 0.8 : 0.55;
  if (end < 22.1) return 0.9;
  if (end < 32.6) return len > 0.35 ? 0.88 : 0.45;
  if (end < 43.0) return len > 0.25 ? 0.8 : 0.55;
  return 0.4;
}, 0.4);

const spec: Spec = {...base, contacts,
  axes: {
    amplitude,
    air,
    speed: curve([
      [0, .56], [.957, .86], [3.419, .88], [3.721, .74], [11.662, .72], [11.975, .48], [13.171, .56], [13.473, .62],
      [21.403, .62], [22.006, .72], [32.374, .74], [32.688, .62], [42.068, .62], [43.078, .66], [45.979, .7],
    ]),
  }};
export default spec;
