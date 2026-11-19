/**
 * Two worlds and a door between them. The distant words begin low and slow and gather pace and weight together up to
 * the drum at 6.7, so the motion makes the same crescendo you asked of the strokes (Astra and Sol both found it).
 * The bare voice after the drum is exactly the approved one. Then the first upper stroke at 15.4, now the strongest
 * landing of the song as you asked, throws the rider up into the strokes. The hurried short bar near 23 s runs low
 * and fast for a moment (Astra and Opus). When the low replies come back after 30.7 the rider swings highest, a
 * little slower than before so those arcs read (Sol), and when the bass falls away it settles.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import base from './variants/approved.ts';

export {overlayMeta} from './variants/approved.ts';

const DOOR = 15.444, DRUM = 6.713;
function strength(t: number, impact: number): number {
  if (t === DOOR) return 1;
  if (t < DRUM) return impact * (.75 + .25 * t / DRUM);   // the distant words: a gentler start to the crescendo
  return impact;
}
const strikes = base.contacts.map(({t, impact = 0}): [number, number] => [t, Number(strength(t, impact).toFixed(3))]);

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
  },
};
export default spec;
