/** One gesture per bar. Under the five upper strokes the rider repeats the same figure every bar, so the eye learns
 * it: the heavy downbeat, two small equal steps, a tall arc over the long fourth stroke, a quick skim on the short
 * fifth, and a tall arc again into the next downbeat. The solo voice before it drifts slowly with nearly weightless
 * touches and a breath where the singer breathes. The uncovered drums slow down and hang. When the bass fills the
 * holes the figure runs lower and quicker; when the bass withdraws under the refrain (from 34.8) the in-between
 * touches turn lighter and the rider sails higher between the downbeats, which keep all their weight.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

const approved = base.contacts.map(({t, impact}) => [t, impact ?? 0] as [number, number]);

const REFRAIN = 34.7;
// Under the refrain the in-between touches are lighter; the downbeats (.79 and above) keep their weight.
const strikes = approved.map(([t, impact]): [number, number] =>
  [t, t > REFRAIN && t < 43.5 && impact < .7 ? Number((impact * .8).toFixed(3)) : impact]);

const times = strikes.map(([t]) => t);
/** The tallest arc a span of `dt` seconds allows (a free flight from landing to landing), on the 60 px scale. */
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);
/** How much of it a span uses. Inside the bar figure: the long spans arc tall, the even steps stay small, the short
 * fifth skims. */
function share(t: number, dt: number): number {
  if (t < 8.6) return .45;
  if (t > 23.8 && t < 26.06) return .8;
  const tall = t > REFRAIN ? 1 : t > 26.06 ? .8 : 1;
  if (dt >= .5) return tall;
  if (dt >= .36) return t > REFRAIN ? .6 : .3;
  return .1;
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
      [0,.56],[3.216,.58],[3.5,.84],[4.2,.84],[4.493,.52],[8.069,.52],[8.615,.68],[23.487,.68],[23.870,.80],
      [25.797,.80],[26.053,.60],[34.5,.60],[34.9,.80],[42.957,.80],[43.2,.36],[44,.32],
    ]),
    speed: curve([
      [0,.46],[4.2,.48],[4.493,.52],[7.523,.54],[8.069,.92],[23.487,.94],[23.870,.70],[25.507,.70],[25.797,.86],
      [26.053,1],[34.5,1],[34.9,.88],[42.957,.90],[43.2,.40],[44,.38],
    ]),
    amplitude,
  },
};
export default spec;
