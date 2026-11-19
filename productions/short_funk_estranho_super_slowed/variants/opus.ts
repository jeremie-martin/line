/** A machine winding up. The faint clock is a slow pendulum: every tick the same small swing,
 * and the calls swing a little wider. The four-note figure and the words and drum replies stay close
 * and quick. Then the low motor takes over for half a minute, and the whole passage is one gesture:
 * it starts as tall, slow, heavy piston strokes and, stroke by stroke, runs lower and faster, until
 * by the cut it is a fast flat hum along the line. The one hollow stroke is a hiccup: the rider rolls
 * through it instead of bouncing, then picks the rhythm up again. The approved reading rides the
 * motor at one constant pace and height; this one gives it a direction. Strengths as approved. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

const ends = base.contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length; `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

const MOTOR = 17.776, CUT = 45.434;
/** 0 at the motor's first stroke, 1 at the cut. */
const wound = (t: number) => Math.min(1, Math.max(0, (t - MOTOR) / (CUT - MOTOR)));
const hiccup = (end: number) => Math.abs(end - 26.809) < 0.01;

const amplitude = perGap((end, len) => {
  if (end < 4.0) return 0.12; // The pendulum.
  if (end < 7.7) return len > 0.5 ? 0.16 : 0.04; // Wider swings into the calls.
  if (end < MOTOR - 0.01) return len > 0.38 ? 0.06 : 0.02; // Close and quick.
  if (hiccup(end)) return 0.02;
  return 0.2 - 0.17 * wound(end); // Tall pistons, flattening to a hum.
}, 0.03);

const air = perGap((end, len) => {
  if (end < 4.0) return 0.6;
  if (end < 7.7) return len > 0.5 ? 0.7 : 0.5;
  if (end < 13.2) return 0.32;
  if (end < MOTOR - 0.01) return 0.4;
  if (hiccup(end)) return 0.42;
  return 0.9 - 0.48 * wound(end);
}, 0.42);

const spec: Spec = {...base,
  axes: {
    amplitude,
    air,
    speed: curve([
      [0, .28], [3.624, .30], [4.181, .44], [7.014, .48], [7.583, .64], [8.72, .70], [12.668, .70], [13.248, .68],
      [16.638, .68], [17.196, .78], [MOTOR, .70], [CUT, 1],
    ]),
  }};
export default spec;
