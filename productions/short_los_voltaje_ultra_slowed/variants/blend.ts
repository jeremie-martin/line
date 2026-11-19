/**
 * The approved reading, with the low drum turned into a pendulum. The opening calls, the drum answer and the quick
 * words are the approved ones: the rise you asked for stays as it is.
 * From the first broad drum each low stroke throws the rider into one round arc to the next, the same figure through
 * all three waves of the drum (Opus's arcs). Unlike Opus the pace stays as fast as the approved reading, which kept
 * the big drums the hardest of all four rides, and the air still steps down for the F and up again for the heavy
 * downbeats as approved. What climbs from wave to wave is weight: the plain strokes gain a little with each wave while
 * the accented ones stay as they were, and the words between the drums are lighter, quick low touches under the arcs
 * (Opus). The four last syllables settle onto the line as in the approved reading.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

// The words that answer the drum from 27 s on (the approved reading's refrain).
const words = new Set([
  27.028, 29.176, 29.907, 31.045, 32.322, 36.478, 37.140, 40.403, 41.982, 45.709, 47.090, 47.752,
  50.387, 52.280, 56.320, 57.702,
]);
const SECOND_WAVE = 27.3, THIRD_WAVE = 37.4;
const isDrum = (t: number) => t >= 16.28 && t < 58.2 && !words.has(t);

function strength(t: number, impact: number): number {
  if (words.has(t)) return impact * .85;
  if (isDrum(t) && impact < .7) return impact * (t < SECOND_WAVE ? .88 : t < THIRD_WAVE ? .95 : 1);
  return impact;
}
const contacts = base.contacts.map(({t, impact = 0}) => ({t, impact: Number(strength(t, impact).toFixed(3))}));
const times = contacts.map(c => c.t);

/** Height over the span ending at the next landing; no pressure before the first broad drum. */
const amplitude = (t: number): number | undefined => {
  if (t < 16.0 || t > 58.1) return undefined;
  const i = Math.max(0, times.findIndex(ct => ct >= t));
  const end = times[i], prev = times[i - 1] ?? 0;
  if (words.has(end)) return .03;
  const wave = .22;
  return words.has(prev) || end - prev < .45 ? wave * .5 : wave;
};

const spec: Spec = {
  ...base,
  contacts,
  axes: {
    ...base.axes,
    air: curve([[0,.58],[1.080,.58],[1.707,.66],[2.357,.66],[3.042,.46],[4.110,.46],[4.354,.52],[5.016,.52],[5.700,.44],
      [9.416,.44],[9.671,.36],[10.995,.36],[11.331,.30],[15.720,.30],[15.929,.47],[16.126,.65],[16.289,.80],[26.239,.80],
      [26.900,.52],[27.237,.72],[37.2,.76],[37.512,.82],[58.073,.82],[58.363,.50],[59.455,.42]]),
    amplitude,
  },
};
export default spec;
