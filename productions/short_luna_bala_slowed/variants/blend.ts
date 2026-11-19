/**
 * Two worlds and a door between them. The distant words begin low and slow and gather pace and weight together up to
 * the drum at 6.7, so the motion makes the same crescendo you asked of the strokes (Astra and Sol both found it).
 * The bare voice after the drum is exactly the approved one. Then the first upper stroke at 15.4, now the strongest
 * landing of the song as you asked, throws the rider up into the strokes, and from there every arc is as tall as the
 * stroke it falls onto is strong: the big strokes are seen coming from high, the light ones are low quick steps
 * (Opus). The hurried short bar near 23 s runs low and fast for a moment (Astra and Opus). When the low replies come
 * back after 30.7 the rider swings highest, a little slower than before so those arcs read (Sol), and when the
 * bass falls away it settles.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const DOOR = 15.444, DRUM = 6.713;
function strength(t: number, impact: number): number {
  if (t === DOOR) return 1;
  if (t < DRUM) return impact * (.75 + .25 * t / DRUM);   // the distant words: a gentler start to the crescendo
  return impact;
}
const strikes = base.contacts.map(({t, impact = 0}): [number, number] => [t, Number(strength(t, impact).toFixed(3))]);
const times = strikes.map(([t]) => t);

/** The tallest arc a span of `dt` seconds allows, on the 60 px scale. */
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);
/** From the door on, the arc's height follows the strength of the landing it falls onto (Opus). */
const amplitude = (t: number): number | undefined => {
  if (t < DOOR - .2) return undefined;
  const i = times.findIndex(ct => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const end = times[k];
  if (end > 23.0 && end < 24.17) return .1 * fullArc(end - times[k - 1]);   // the hurried bar
  const lift = Math.min(1, Math.max(.08, (strikes[k][1] - .3) / .6));
  return (end > 30.6 && end < 48.1 ? Math.min(1, lift * 1.15) : lift) * fullArc(end - times[k - 1]);
};

const spec: Spec = {
  ...base,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    // From the drum to the door the approved air and speed, untouched.
    air: curve([
      [0,.40],[3.73,.46],[6.45,.58],[6.71,.59],[8.217,.43],[10.295,.49],[11.323,.57],[12.199,.43],[14.626,.39],
      [DOOR,.66],[22.9,.68],[23.2,.48],[24.0,.48],[24.4,.68],[30.4,.68],[31.0,.76],[48.0,.74],
      [48.14,.58],[50.291,.54],
    ]),
    speed: curve([
      [0,.42],[2.366,.52],[6.45,.87],[7.0,.64],[10.295,.50],[11.323,.50],[12.2,.64],[14.35,.66],[DOOR,.86],
      [22.9,.88],[23.2,.98],[24.0,.98],[24.4,.88],[30.4,.90],[31.0,.84],[48.0,.84],[48.14,.68],[50.291,.58],
    ]),
    amplitude,
  },
};
export default spec;
