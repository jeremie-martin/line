/** The opening stomp runs close to the line and makes space for each answering guitar chord.
 * The triplets skim by as one quick breath, then the returning drums climb toward the break.
 * The two bass notes land at the foot of tall, separate flights. The first shout drives the rider
 * low again, and the second drummer gradually sends it higher, with a clear swing into the late snares.
 * The final chant gathers speed and carries that forward motion through the cut.
 */
import {curve} from '../../../scripts/v0/core/measured.ts';
import type {Spec} from '../../../scripts/v0/types.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t,
    impact: t >= 10.148 && t < 13.526 ? impact * .58
      : t === 20.765 ? .9
      : t === 21.717 ? .98
      : t === 35.127 ? .95
      : t === 44.74 ? .99
      : impact ** 1.38,
  })),
  axes: {
    air: curve([
      [0,.38],[1.539,.38],[2.479,.66],[3.437,.37],[4.401,.63],[5.364,.54],
      [7.297,.43],[9.196,.49],[10.473,.28],[12.824,.28],[13.526,.49],
      [16.876,.51],[19.761,.63],[20.765,.88],[21.717,.9],[22.483,.87],
      [23.604,.4],[26.489,.43],[27.928,.61],[28.404,.64],[30.32,.48],
      [33.199,.51],[35.127,.78],[36.055,.68],[38.958,.53],[41.849,.6],
      [43.776,.68],[44.74,.82],[45.68,.58],[48.553,.48],[51.084,.52],
    ]),
    speed: curve([
      [0,.62],[1.539,.79],[2.479,.58],[3.437,.81],[4.401,.63],[5.364,.79],
      [9.196,.9],[10.473,.75],[12.824,.77],[14.002,.72],[17.839,.78],
      [19.761,.72],[20.765,.61],[21.717,.79],[22.646,.97],[24.561,.98],
      [27.928,.85],[28.404,.93],[32.247,.9],[35.127,.92],[36.055,.88],
      [39.916,.8],[42.783,.83],[44.74,.94],[46.632,.89],[51.084,.99],
    ]),
    amplitude: curve([
      [0,.025],[1.539,.035],[2.479,.11],[3.437,.035],[4.401,.095],[5.364,.06],
      [9.196,.055],[10.473,.018],[12.824,.018],[13.526,.07],[16.876,.06],
      [19.761,.11],[20.24,.31],[21.717,.34],[22.483,.29],[23.604,.045],
      [27.423,.05],[28.404,.12],[30.32,.05],[33.199,.08],[35.127,.17],
      [36.055,.13],[38.958,.085],[41.849,.095],[43.776,.14],[44.74,.19],
      [46.632,.07],[51.084,.06],
    ]),
  },
};

export default spec;
