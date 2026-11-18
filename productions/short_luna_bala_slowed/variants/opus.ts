/** Two worlds, and a door between them. The distant words arrive from far away: wide, slow arcs that tighten and
 * quicken as the voice comes into focus, into the drum at 6.7. The bare voice stays exactly as it was, low and quiet
 * on the line. Then the first upper stroke at 15.4, now the strongest landing of the song, throws the rider up into
 * the strokes, and from there it never quite comes down: every arc is as tall as the stroke it falls onto is strong,
 * so the big strokes are seen coming from high and the light ones are low quick steps. The hurried short bar near 23 s
 * runs low and fast for a moment; the low replies after 30.7 swing tallest; when the bass falls away at the end the
 * rider slows and settles.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const DOOR = 15.444;
const strikes = base.contacts.map(({t, impact}): [number, number] => [t, t === DOOR ? 1 : impact ?? 0]);

const times = strikes.map(([t]) => t);
/** The tallest arc a span of `dt` seconds allows (a free flight from landing to landing), on the 60 px scale. */
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);
/** How much of it a span uses. In the strokes, the arc's height follows the strength of the landing it falls onto. */
function share(t: number, impact: number): number {
  if (t < 6.72) return .9 - .6 * (t / 6.7);                   // wide arcs tightening as the voice comes into focus
  if (t < DOOR) return .15;                                    // the bare voice, low on the line
  if (t > 23.0 && t < 24.17) return .1;                        // the hurried bar
  const lift = Math.min(1, Math.max(.08, (impact - .3) / .6));
  return t > 30.6 && t < 41.6 ? Math.min(1, lift * 1.15) : lift;
}
const amplitude = (t: number): number => {
  const i = times.findIndex((ct) => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const dt = times[k] - (k > 0 ? times[k - 1] : 0);
  return share(times[k], strikes[k][1]) * fullArc(dt);
};

const spec: Spec = {
  ...base,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    // From the drum at 6.71 to the door the approved air and speed are kept as they were.
    air: curve([
      [0,.76],[3.7,.68],[6.45,.58],[6.71,.59],[8.217,.43],[10.295,.49],[11.323,.57],[12.199,.43],[14.626,.39],
      [DOOR,.66],[22.9,.70],[23.2,.50],[24.0,.50],[24.4,.70],[30.6,.72],[41.4,.74],[41.8,.80],[48.0,.78],
      [48.14,.60],[50.291,.56],
    ]),
    speed: curve([
      [0,.56],[3.7,.70],[6.45,.88],[7.0,.64],[10.295,.50],[11.323,.50],[12.2,.64],[14.35,.66],[DOOR,.86],
      [22.9,.88],[23.2,.98],[24.0,.98],[24.4,.88],[30.6,.92],[41.4,.94],[41.8,.86],[48.0,.86],[48.14,.66],[50.291,.56],
    ]),
    amplitude,
  },
};
export default spec;
