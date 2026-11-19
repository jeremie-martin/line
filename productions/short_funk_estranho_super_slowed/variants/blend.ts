/** A machine that stalls once and winds itself back up.
 * From Opus: the faint clock is a slow pendulum, every tick the same small swing, and the calls swing
 * a little wider; the four-note figure and the words with their drum replies stay close and quick.
 * From Sol: the motor's first stroke is the hardest landing of the film.
 * From the approved reading: the low motor ridden as one even run of high, fast strokes, which its ride
 * shows cleanly (lower and flatter versions of the motor picked up stray touches).
 * Its own: the hollow stroke halfway is a stall. As in Sol the rider lifts over it and loses its pace;
 * then the motor restarts in slow, tall strokes and winds back up, a little faster and flatter each bar,
 * until it is back at full speed for the last third of the ride. Strengths as approved otherwise. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const contacts = base.contacts.map(({t, impact = 0}) => ({t, impact: t === 17.776 ? 1 : impact}));

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length (s); `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

const MOTOR = 17.776, STALL = 26.809, WOUND = 36.457;
/** 0 just after the stall, 1 once the motor is wound back up. */
const rewind = (end: number) => Math.min(1, Math.max(0, (end - STALL) / (WOUND - STALL)));
const near = (end: number, at: number) => Math.abs(end - at) < 0.01;

const air = perGap((end, len) => {
  if (end < 4.0) return 0.6; // The pendulum.
  if (end < 7.7) return len > 0.5 ? 0.7 : 0.5; // Wider swings into the calls.
  if (end < 13.2) return 0.32;
  if (end < 17.5) return 0.4;
  if (end < MOTOR - 0.01) return 0.6; // A breath before the motor.
  if (end < STALL - 0.01) return 0.76; // The motor, even.
  if (near(end, STALL)) return 0.86; // The stall: lifted.
  return 0.84 - 0.08 * rewind(end);
}, 0.74);

const spec: Spec = {...base, contacts,
  axes: {
    air,
    speed: curve([
      [0, .28], [3.624, .30], [4.181, .44], [7.014, .48], [7.583, .64], [8.72, .70], [12.668, .70], [13.248, .68],
      [16.638, .68], [17.196, .86], [MOTOR, .98], [26.251, .98], [STALL, .64], [27.378, .62], [WOUND, .98], [45.434, .98],
    ]),
  }};
export default spec;
