/** Call, walk, run, soar: the song climbs from the low singer's heavy walk to a flight over the high voice.
 * The high pickup and the kick pairs keep the approved pace and weights, each big kick throwing the rider into an arc
 * (Opus). When the low singer takes over, the rider slows to a walk close to the line, as all three new readings had
 * it, rising only on the two long breaths of his phrases, at 20 and 28 seconds; his strokes keep their approved
 * weights, which held his strongest syllables best. The quick words run flat and fast, one level all through (Opus);
 * the roll launches the rider, and over the high voice it soars, fastest and highest, kicks full, replies light (Opus).
 * My own part is the arrangement: one pace per singer, so the change of voice is seen as a change of gait, with the
 * low singer's two breaths the only height between the opening's arcs and the final flight.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';
export {overlayMeta} from '../spec.ts';

const times = base.contacts.map((c) => c.t);
// The gap a moment belongs to, or nothing on a landing itself, so that no gap borrows its neighbour's height.
const gapAt = (t: number) => {
  const i = times.findIndex((x) => x >= t);
  if (i <= 0 || t < times[i - 1] + .03 || t > times[i] - .03) return {gap: 0, end: -1};
  return {gap: times[i] - times[i - 1], end: times[i]};
};
const breaths = [20.254, 28.34];      // the low singer's two long breaths

// Over the high voice the kicks land full and the replies are brushed, as Opus wrote them; the rest is approved.
const strength = (t: number, v: number) => (t < 42.5 ? v : v > .7 ? Math.min(1, v + .04) : +(v * .8).toFixed(3));

const flow = {
  air: curve([[0, .72], [1.15, .68], [10.55, .64], [11.53, .5], [12.3, .42], [30.3, .42], [30.8, .44], [41.2, .46], [42.2, .66],
    [43, .76], [52.3, .74]]),
  speed: curve([[0, .62], [1.15, .82], [10.55, .78], [11.53, .70], [12.3, .64], [30.2, .64], [31.2, .86], [41.2, .88], [42.5, .92],
    [52.3, .9]]),
};

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({t, impact: strength(t, impact)})),
  axes: {
    air: (t: number) => (breaths.includes(gapAt(t).end) ? .64 : flow.air(t)),
    speed: flow.speed,
    amplitude: (t: number) => {
      const {gap, end} = gapAt(t);
      if (end < 1.0) return undefined;
      if (end < 11.5) return gap > .55 ? .36 : undefined;     // the arc after each big kick
      if (breaths.includes(end)) return .4;
      if (end < 42.6) return undefined;                        // the walk and the run stay low by their pace
      return gap > .55 ? .5 : undefined;                       // the flight's long breaths
    },
  },
};
export default spec;
