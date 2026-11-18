/** Rising out of the ground. The spoken bridge creeps, slow and close to the line, and only the held
 * vowel lifts it once. With the low register the bass entries swell under it: slow, tall arcs over
 * each long rest. The pickup then pulls taut, flat and accelerating, into the crash. The chorus is
 * ridden hard and grounded, and the second drum sentence a notch faster still. Where the singer holds
 * the long low notes the rider eases off and floats above the drums; the last line drops it back to
 * the ground, the fill gets one hop into its last heavy stroke, and the closing resonance is a long,
 * slowing glide. The approved reading holds full speed from the pickup to the end; this one moves
 * between passages. Strengths as approved. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const ends = base.contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length; `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

const amplitude = perGap((end, len) => {
  if (end < 4.0) return 0.03; // Creeping.
  if (end < 4.2) return 0.5; // The held vowel.
  if (end < 11.0) return len > 0.95 ? 0.5 : len > 0.68 ? 0.28 : len > 0.42 ? 0.08 : 0.03; // Bass swells.
  if (end < 13.35) return 0.02; // Taut pickup.
  if (end < 30.1) return len > 0.45 ? 0.08 : 0.02; // Grounded chorus.
  if (end < 38.5) return len > 0.4 ? 0.16 : 0.05; // Floating over the held notes.
  if (end > 45.6 && end < 45.7) return 0.16; // The hop into the last heavy stroke.
  return len > 0.45 ? 0.06 : 0.02;
}, 0.55);

const air = perGap((end, len) => {
  if (end < 4.0) return 0.36;
  if (end < 4.2) return 0.9;
  if (end < 11.0) return len > 0.68 ? 0.88 : 0.5;
  if (end < 13.35) return 0.4;
  if (end < 30.1) return 0.52;
  if (end < 38.5) return len > 0.4 ? 0.84 : 0.7;
  if (end > 45.6 && end < 45.7) return 0.82;
  return 0.5;
}, 0.8);

const spec: Spec = {...base,
  axes: {
    amplitude,
    air,
    speed: curve([
      [0, .30], [4.107, .30], [4.885, .42], [10.922, .44], [11.224, .62], [12.768, .96], [13.302, .92],
      [21.2, .92], [21.719, 1], [29.7, 1], [30.136, .86], [38.02, .86], [38.565, 1], [45.671, 1],
      [45.926, .78], [46.425, .52], [48.423, .26],
    ]),
  }};
export default spec;
