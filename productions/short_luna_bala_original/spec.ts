/**
 * Down into the drive, then out into the open (Opus's shape, whose ride lands the downbeats harder than the others).
 * The breathy pickup glides slowly almost on the line, its touches lighter still. Under the broken percussion the
 * rider gathers pace bar by bar, low and close, with no reach for height where the strokes come too close together
 * to show it; when the low answers come in it runs lowest and fastest, the hardest part of the ride.
 * Then it opens up: where the upper strokes thin out over the bass the hops grow tall and the touches between the
 * downbeats turn lighter, so each downbeat stands alone (Sol's contrast there). The four bare drums are four high
 * leaps, slowing, and the three pitched calls at the end are wide, slow arcs with their fine answers barely
 * touched (Opus).
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import base from './variants/approved.ts';

export {overlayMeta} from './variants/approved.ts';

function strength(t: number, impact: number): number {
  if (t < 3.6) return impact * .75;                                  // the pickup: lighter still
  if (t < 25.8 && impact < .52) return impact * .85;                 // the weakest stroke of each bar eases (Opus)
  if (t >= 25.8 && t < 31.3) return impact ** 1.42;                  // the thinning: lighter between downbeats (Sol)
  return impact;
}
const contacts = base.contacts.map(({t, impact = 0}) => ({t, impact: Number(strength(t, impact).toFixed(3))}));

const spec: Spec = {
  ...base,
  contacts,
  axes: {
    air: curve([
      [0,.32],[3.3,.32],[3.69,.56],[18.2,.62],[18.45,.52],[25.6,.52],[25.84,.68],[31.1,.72],[31.375,.82],
      [33.0,.84],[33.23,.82],[39.373,.80],
    ]),
    speed: curve([
      [0,.48],[3.3,.54],[3.69,.74],[18.2,.90],[18.45,1],[25.6,1],[25.84,.92],[31.1,.86],[31.375,.76],
      [33.0,.62],[33.23,.50],[39.373,.42],
    ]),
  },
};
export default spec;
