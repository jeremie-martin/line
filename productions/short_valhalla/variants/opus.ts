/** Call, trudge, run, soar. The high pickup and its kick pairs ride in measured arcs, each big kick throwing it into one. When
 * the low singer takes over, the rider comes down and slows to a heavy walk close to the line, only rising where his
 * phrases leave a long breath, so the uneven rhythm of his speech shows as uneven steps; his stressed syllables land
 * full and the in-between ones fall back. The quick words speed it up, flat and running. The roll launches it, and
 * over the high voice and the renewed groove it soars: fastest, highest, every kick launching a tall arc and the
 * small replies brushed in between, to the cut. The approved reading rode the low verse nearly as fast as the opening and the
 * finale no higher than the start; here the song climbs from a trudge to a flight, most of all after 42.5 s.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base, {overlayMeta} from '../spec.ts';
export {overlayMeta};

const tier = (v: number, steps: Array<[number, number]>) => (steps.find(([min]) => v >= min) ?? steps[steps.length - 1])[1];

function strength(t: number, v: number): number {
  if (t < 11.5) return v;                                                                 // the opening as approved
  if (t < 30.5) return tier(v, [[.85, .92], [.7, .76], [.5, .46], [.4, .28], [0, .14]]);  // the low singer
  if (t < 41.3) return tier(v, [[.75, .8], [.55, .56], [.45, .36], [0, .2]]);            // quick words
  if (t < 42.5) return v;                                                                 // the roll
  return v > .7 ? Math.min(1, v + .04) : v * .8;                                          // kicks full, replies brushed
}

const times = base.contacts.map((c) => c.t);
function height(t: number): number | undefined {
  const i = times.findIndex((x) => x >= t);
  if (i <= 0) return undefined;
  const end = times[i];
  const gap = end - times[i - 1];
  if (end < 11.5) return gap > .55 ? .42 : .06;
  if (end < 30.5) return gap > .8 ? .4 : gap > .54 ? .24 : .03;     // only the long breaths rise
  if (end < 41.3) return .03;
  if (end < 42.5) return .1;
  return gap > .55 ? .62 : gap > .4 ? .2 : .05;
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact}) => ({t, impact: strength(t, impact ?? 0)})),
  axes: {
    air: curve([[0, .72], [1.15, .68], [10.9, .66], [11.53, .5], [12.3, .4], [30.3, .42], [30.8, .44], [41.2, .46], [42.2, .66], [43, .76], [52.3, .74]]),
    speed: curve([[0, .62], [1.15, .74], [10.9, .72], [11.53, .64], [12.3, .56], [30.3, .58], [31.2, .86], [41.2, .9], [42.5, .92], [52.3, .9]]),
    amplitude: height,
  },
};
export default spec;
