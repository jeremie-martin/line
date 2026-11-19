/** Down into the drive, then out into the open. The breathy pickup glides almost on the line. Under the broken
 * percussion the rider gathers pace bar by bar, in steady hops with the doubles skimmed. When the low answers come in
 * (18.5) it runs lowest and fastest, close to the line, the hardest part of the ride. Then it opens up: where the upper
 * strokes thin out over the bass the hops grow tall, the four bare drums are four separate high leaps, slowing, and
 * the three pitched calls at the end are wide, slow, lazy arcs with their fine answers barely touched. The middle stroke
 * of each bar is a little softer than before, so the downbeats stand clearer.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

const approved = base.contacts.map(({t, impact}) => [t, impact ?? 0] as [number, number]);
// The weakest stroke of each bar under the percussion and the low answers (below .52) eases a little.
const strikes = approved.map(([t, impact]): [number, number] =>
  [t, t > 3.6 && t < 25.8 && impact < .52 ? Number((impact * .85).toFixed(3)) : impact]);

const times = strikes.map(([t]) => t);
/** The tallest arc a span of `dt` seconds allows (a free flight from landing to landing), on the 60 px scale. */
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);
/** How much of it each passage uses: little at the pickup and in the drive, all of it once the music opens up. */
function share(t: number, dt: number): number {
  if (t < 3.6) return .2;
  if (t < 18.4) return dt < .3 ? .1 : .6;
  if (t < 25.8) return .25;
  return .95;
}
const amplitude = (t: number): number => {
  const i = times.findIndex((ct) => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const dt = times[k] - (k > 0 ? times[k - 1] : 0);
  return share(times[k], dt) * fullArc(dt);
};

const spec: Spec = {
  ...base,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([
      [0,.32],[3.3,.32],[3.69,.58],[18.2,.66],[18.45,.54],[25.6,.54],[25.84,.70],[31.1,.72],[31.375,.82],
      [33.0,.84],[33.23,.82],[39.373,.80],
    ]),
    speed: curve([
      [0,.50],[3.3,.56],[3.69,.74],[18.2,.90],[18.45,1],[25.6,1],[25.84,.92],[31.1,.86],[31.375,.76],
      [33.0,.62],[33.23,.50],[39.373,.42],
    ]),
    amplitude,
  },
};
export default spec;
