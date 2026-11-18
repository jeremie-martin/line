/** Charge and discharge. In the opening each call is a little spark that jumps the silence after it:
 * a slow small arc over every space, the arcs growing as the calls gather. The quick naked voice
 * charges up: flat to the line and accelerating, no height at all. The slam lets it go, and the drums
 * that take over are ridden as tall, regular hops, one per beat, so the drum drives the picture. Under
 * the bright replies the rider runs low and fast like current along a wire, and only the drum beat
 * that closes each phrase lifts it, a little higher phrase by phrase, so the long passage keeps
 * climbing to the end; the last words glide out. The approved reading keeps the drum passage and the
 * replies at one pace and height; strengths are unchanged. */
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

const SLAM = 14.869, REPLIES = 23.553, WORDS = 47.678;
/** In the replies, the long gaps land on the drum beat that closes a phrase. */
const phraseEnd = (end: number, len: number) => end > REPLIES && end < WORDS && len > 0.45;
/** How far through the replies (0 to 1). */
const through = (t: number) => Math.min(1, Math.max(0, (t - REPLIES) / (WORDS - REPLIES)));

const amplitude = perGap((end, len) => {
  if (end < 11.0) return len > 0.45 ? 0.06 + 0.1 * (end / 11) : 0.02; // Sparks over the spaces, growing.
  if (end < SLAM - 0.01) return 0.01; // Charging: flat.
  if (end < REPLIES - 0.01) return len > 0.45 ? 0.16 : 0.04; // Drum hops.
  if (phraseEnd(end, len)) return 0.08 + 0.12 * through(end); // One lift per phrase, climbing.
  if (end < WORDS - 0.01) return 0.02; // Current along the wire.
  return 0.08;
}, 0.1);

const air = perGap((end, len) => {
  if (end < 11.0) return len > 0.45 ? 0.72 : 0.4;
  if (end < SLAM - 0.01) return 0.3;
  if (end < REPLIES - 0.01) return len > 0.45 ? 0.86 : 0.6;
  if (phraseEnd(end, len)) return 0.8 + 0.1 * through(end);
  if (end < WORDS - 0.01) return 0.4;
  return 0.5;
}, 0.5);

const spec: Spec = {...base,
  axes: {
    amplitude,
    air,
    speed: curve([
      [0, .44], [4.559, .48], [6.626, .56], [10.747, .60], [11.002, .74], [12.361, .82], [14.427, .94], [SLAM, .92],
      [15.4, .84], [23.158, .84], [REPLIES, .96], [47.458, .96], [WORDS, .66], [48.352, .56],
    ]),
  }};
export default spec;
