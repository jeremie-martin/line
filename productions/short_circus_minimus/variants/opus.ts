/** A juggler's act. In the verse every big low stroke is thrown: the rider goes up slowly over the
 * long rest before it and falls onto it, tall against an unhurried pace. Under the hats the throws
 * stop and the rider runs quick and low through the groove. In the hook the throw returns once per
 * phrase, always on the same stroke, so the passage has a visible period. The five even notes are a
 * drum roll on the ground, accelerating into the band's return; the full groove floats in quick small
 * hops; the held note is one slow high lob, landing softly, and the last bar throws once more.
 * The approved reading keeps one even motion per passage; this one shapes the long rests.
 * Strengths as approved. */
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

/** The throws: the long rests (over half a second), outside the hats passage and the roll. */
const thrown = (end: number, len: number) => len > 0.5 && !(end > 6 && end < 18.6) && !(end > 29.6 && end < 31.6);

const amplitude = perGap((end, len) => {
  if (end > 51.4 && end < 51.6) return 0.4; // The held note: one slow lob.
  if (thrown(end, len)) return len > 0.7 ? 0.3 : 0.16;
  if (end > 29.9 && end < 31.6) return 0.01; // The roll, on the ground.
  if (end > 6 && end < 18.6) return 0.02; // Under the hats: low.
  if (end > 31.6 && end < 50.8) return 0.06; // Small floating hops.
  return 0.03;
}, 0.1);

const air = perGap((end, len) => {
  if (end > 51.4 && end < 51.6) return 0.92;
  if (thrown(end, len)) return 0.9;
  if (end < 6) return 0.5;
  if (end < 18.6) return 0.42;
  if (end < 29.9) return 0.5;
  if (end < 31.6) return 0.36;
  if (end < 50.8) return 0.72;
  return 0.55;
}, 0.6);

const spec: Spec = {...base,
  axes: {
    amplitude,
    air,
    speed: curve([
      [0, .60], [5.3, .62], [5.893, .78], [6.69, .90], [18.19, .90], [18.693, .82], [29.491, .84],
      [29.944, .86], [31.499, 1], [32.3, .90], [50.11, .90], [50.702, .76], [51.91, .78], [57.262, .80],
    ]),
  }};
export default spec;
