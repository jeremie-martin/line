/** A slow dance that never turns into a drop. This song is chill; the rider sways instead of running.
 * From Sol: the first words even smaller, with one small bow over the melody, then a quick low run
 * into the three hard drums so that they land as sharp as they can.
 * From Opus: after them an unhurried pace, low through the steps of each bar and a soft lift over every
 * bar's long rest, the same in every bar; the held voice is the one tall flight; the body is touched gently.
 * Its own: the returning backbeat has its weight for four bars only, quicker and closer to the line,
 * and then lets go gradually, slowing and lifting more each bar, so the easing groove floats out to the cut
 * without a step between the two. Strengths keep the approved order. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const contacts = base.contacts.map(({t, impact = 0}) => {
  if (t < 3.2) return {t, impact: +(impact * 0.72).toFixed(3)}; // The first words: very low.
  if ((t > 4.5 && t < 23.5) || t > 36.5) return {t, impact: +(impact * 0.85).toFixed(3)}; // The sway.
  return {t, impact};
});

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length (s); `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};
/** Long rests (about a second), half rests (two thirds of a second), steps (a third). */
const sway = (len: number, long: number, half: number, step: number) => (len > 0.85 ? long : len > 0.55 ? half : step);
/** 0 during the four heavy bars of the return, rising to 1 where the groove has eased. */
const letGo = (end: number) => Math.min(1, Math.max(0, (end - 30.6) / (36.6 - 30.6)));

const air = perGap((end, len) => {
  if (end < 1.7) return len > 0.5 ? 0.62 : 0.34; // The small bow over the melody.
  if (end < 3.2) return 0.34;
  if (end < 4.0) return 0.44; // Three drums, low and hard.
  if (end < 23.6) return sway(len, 0.82, 0.7, 0.48);
  if (end < 24.3) return 0.52;
  if (end < 25.3) return 0.95; // The held voice: the one tall flight.
  const k = letGo(end);
  return sway(len, 0.62 + 0.23 * k, 0.5 + 0.24 * k, 0.42 + 0.1 * k);
}, 0.6);

const amplitude = perGap((end, len) => {
  if (end < 1.7) return len > 0.5 ? 0.16 : 0.03;
  if (end < 4.0) return 0.03;
  if (end < 23.6) return sway(len, 0.38, 0.18, 0.04);
  if (end < 24.3) return 0.05;
  if (end < 25.3) return 0.55;
  const k = letGo(end);
  return sway(len, 0.2 + 0.25 * k, 0.08 + 0.14 * k, 0.03 + 0.02 * k);
}, 0.1);

const spec: Spec = {...base, contacts,
  axes: {
    air,
    amplitude,
    speed: curve([
      [0, .39], [1.28, .45], [2.264, .56], [3.251, .82], [3.918, .86], [4.586, .66], [6.3, .58], [23.255, .58],
      [24.242, .56], [25.252, .76], [30.592, .76], [36.583, .60], [40.25, .54], [44.187, .5],
    ]),
  }};
export default spec;
