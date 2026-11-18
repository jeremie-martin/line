/** A slow dance. This song is chill, and the approved reading rides it at full pace; here the rider
 * sways. After the near-still opening words and the three hard drums, it settles to an unhurried
 * speed: low through the steps of each bar, and a soft lift over every bar's long rest, the same in
 * every bar. The held voice gets the one tall flight of the film. When the backbeat returns the rider
 * is heavier, quicker and closer to the line for those bars; as the groove eases it slows again and
 * the lifts grow, floating out to the cut. The body of the strokes is a little softer in the swaying
 * passages, so the three drums and the return stand clear; the order of the strengths is unchanged. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const contacts = base.contacts.map(({t, impact = 0}) => {
  // The sway: the drums and words, and the easing groove, are touched more gently.
  if ((t > 4.5 && t < 23.5) || t > 36.5) return {t, impact: +(impact * 0.85).toFixed(3)};
  return {t, impact};
});

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length; `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

/** Long rests (about a second), half rests (two thirds of a second), steps (a third). */
const sway = (len: number, long: number, half: number, step: number) => (len > 0.85 ? long : len > 0.55 ? half : step);

const amplitude = perGap((end, len) => {
  if (end < 3.2) return len > 0.5 ? 0.1 : 0.03; // The opening words, close to the line.
  if (end < 4.0) return 0.03; // Three drums, low and hard.
  if (end < 23.6) return sway(len, 0.38, 0.18, 0.04);
  if (end < 24.3) return 0.05;
  if (end < 25.3) return 0.55; // The held voice: the one tall flight.
  if (end < 36.6) return sway(len, 0.2, 0.08, 0.03); // Weight.
  return sway(len, 0.45, 0.22, 0.05); // The groove eases: floating out.
}, 0.1);

const air = perGap((end, len) => {
  if (end < 3.2) return 0.32;
  if (end < 4.0) return 0.4;
  if (end < 23.6) return sway(len, 0.82, 0.7, 0.48);
  if (end < 24.3) return 0.52;
  if (end < 25.3) return 0.95;
  if (end < 36.6) return sway(len, 0.62, 0.5, 0.42);
  return sway(len, 0.85, 0.74, 0.52);
}, 0.6);

const spec: Spec = {...base, contacts,
  axes: {
    amplitude,
    air,
    speed: curve([
      [0, .40], [1.962, .46], [2.264, .62], [3.251, .86], [3.918, .86], [4.586, .66], [6.3, .58], [23.255, .58],
      [24.242, .56], [25.252, .76], [35.921, .74], [36.583, .62], [40.25, .54], [44.187, .5],
    ]),
  }};
export default spec;
