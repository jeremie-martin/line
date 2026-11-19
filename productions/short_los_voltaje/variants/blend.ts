/** The loved approved ride, with the drum driving the picture, as you asked: charge, then current.
 * From the approved reading: the calls with their slow crescendo, the quick naked voice ridden flat and
 * accelerating into the slam, the last words, and the strengths.
 * From Opus: the drums that take over are ridden as tall, regular hops, one per beat.
 * From Sol: the drum strokes are a little heavier, in the drum passage and on the beat that closes each
 * phrase of the bright replies, and each phrase is one sweep: low through the replies, lifting into
 * the closing drum, driving on into the next.
 * Its own: that closing lift grows a little phrase by phrase (Opus's climb, in Sol's sweep), so the
 * long passage of replies keeps rising to the end instead of repeating; then the words glide out. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const SLAM = 14.869, REPLIES = 23.553, WORDS = 47.678;
const drumWeight = curve([[14.869, 1.02], [16.947, 1.08], [18.758, 1.04], [20.569, 1.05], [22.125, 1.10], [23.158, 1.06]]);
const ends0 = base.contacts.map((c) => c.t);
/** In the replies, a long gap (over 0.45 s) lands on the drum beat that closes a phrase. */
const closesPhrase = (end: number, len: number) => end > REPLIES && end < WORDS - 0.01 && len > 0.45;

const contacts = base.contacts.map(({t, impact = 0}, i) => {
  const len = i > 0 ? t - ends0[i - 1] : 0;
  if (t > SLAM && t <= 23.16) return {t, impact: Math.min(1, +(impact * drumWeight(t)!).toFixed(3))};
  if (closesPhrase(t, len)) return {t, impact: Math.min(1, +(impact + 0.045).toFixed(3))};
  return {t, impact};
});

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length (s); `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number | undefined, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};
/** How far through the replies (0 to 1). */
const through = (t: number) => Math.min(1, Math.max(0, (t - REPLIES) / (WORDS - REPLIES)));

const approvedAir = curve([[0,.62],[.426,.43],[.971,.64],[2.492,.42],[3.026,.60],[4.559,.40],[5.093,.60],[6.626,.36],
  [9.214,.44],[10.747,.44],[11.002,.30],[14.741,.30]]);

const air = perGap((end, len) => {
  if (end < SLAM - 0.01) return approvedAir(end);
  if (end < REPLIES - 0.01) return len > 0.45 ? 0.86 : 0.6; // Drum hops.
  if (closesPhrase(end, len)) return 0.66 + 0.18 * through(end); // The lift into the closing drum, growing.
  if (end < WORDS - 0.01) return 0.42; // Low through the replies.
  return 0.45;
}, 0.45);

const amplitude = perGap((end, len) => {
  if (end < SLAM - 0.01) return undefined;
  if (end < REPLIES - 0.01) return len > 0.45 ? 0.16 : 0.04;
  if (closesPhrase(end, len)) return 0.14 + 0.14 * through(end);
  if (end < WORDS - 0.01) return 0.03;
  return 0.05;
}, 0.05);

const spec: Spec = {...base, contacts,
  axes: {
    air,
    amplitude,
    speed: curve([
      [0,.44],[4.559,.50],[6.347,.50],[6.626,.60],[10.747,.60],[11.002,.74],[12.361,.82],[14.427,.94],[SLAM,.94],
      [15.4,.86],[23.158,.86],
      [25.23,.80],[27.04,.92],[28.08,.82],[30.39,.98],[31.42,.92],[32.21,.80],[33.49,.84],[35.30,.94],
      [36.36,.82],[38.67,.98],[39.70,.92],[40.49,.80],[41.77,.90],[42.56,.82],[43.58,.92],[44.64,.84],
      [46.95,.99],[47.46,.90],[WORDS,.66],[48.352,.56],
    ]),
  }};
export default spec;
