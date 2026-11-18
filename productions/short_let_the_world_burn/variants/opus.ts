/** Fire, then smoke. The distant opening smoulders, slow and low; the two exposed calls draw a breath.
 * The drum sentence is the fire: fast, close to the line, crackling, and once a bar the sharp answering
 * stroke throws a spark, a small jump onto it, always at the same place in the bar. When the voice
 * leaves the drummer behind the rider rises like smoke: it slows right down and climbs into huge,
 * slow arcs over the held notes, the upper C the highest and slowest of all. The three drum answers
 * bring it back to earth, and the last word glides low through the cut. The approved reading rides
 * the held notes at full speed; here they are slow and tall, and the drums are lower and quicker. */
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

/** The sharp answering stroke that ends each bar of the drum sentence. */
const sparks = [8.348, 10.937, 13.514, 16.091, 18.669, 21.258, 23.835];
const spark = (end: number) => sparks.some((s) => Math.abs(s - end) < 0.01);

const amplitude = perGap((end, len) => {
  if (end < 3.0) return 0.04; // Smouldering.
  if (end < 4.0) return 0.3; // The calls draw a breath.
  if (end < 4.5) return 0.1;
  if (end < 24.0) return spark(end) ? 0.1 : 0.02; // Fire, with a spark each bar.
  if (end < 43.0) return len > 2 ? 1 : len > 0.8 ? 0.6 : len > 0.4 ? 0.2 : 0.03; // Smoke.
  return 0.03; // Back to earth.
}, 0.08);

const air = perGap((end, len) => {
  if (end < 3.0) return 0.42;
  if (end < 4.5) return 0.8;
  if (end < 24.0) return spark(end) ? 0.8 : 0.42;
  if (end < 43.0) return len > 0.4 ? 0.95 : 0.6;
  return 0.45;
}, 0.55);

const spec: Spec = {...base,
  axes: {
    amplitude,
    air,
    speed: curve([
      [0, .34], [1.927, .40], [3.204, .56], [3.646, .80], [4.481, .94], [23.835, .96], [24.462, .80],
      [25.321, .62], [33.123, .60], [34.145, .70], [35.48, .54], [42.028, .54], [43.514, .84], [44.478, .86],
      [44.745, .56], [46.98, .42],
    ]),
  }};
export default spec;
