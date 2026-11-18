/** The first words brush the line, then the melody draws a small bow before the three sharp drums.
 * After those drums the rider settles into a rolling backbeat that loosens as the singer holds the high note.
 * The bass pickup leads to the longest, highest breath of the ride and a soft return to the rolling pace.
 * The final bars let the voice draw the rider outward again, with lighter landings and room at the cut.
 */
import {curve} from '../../../scripts/v0/core/measured.ts';
import type {Spec} from '../../../scripts/v0/types.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t,
    impact: t < 3.251 ? impact * .72
      : t <= 3.918 ? impact
      : t < 19.249 ? impact ** 1.23
      : t < 23.591 ? impact * .73
      : t === 25.252 ? .64
      : t < 36.583 ? impact ** 1.19
      : impact ** 1.48,
  })),
  axes: {
    air: curve([
      [0,.29],[.604,.38],[1.28,.72],[1.962,.45],[2.54,.6],[3.065,.27],
      [3.587,.46],[3.918,.49],[4.586,.51],[6.246,.4],[9.253,.52],
      [11.587,.42],[12.574,.58],[16.904,.39],[19.249,.57],[22.256,.65],
      [23.591,.58],[24.242,.7],[24.79,.91],[25.252,.74],[26.924,.44],
      [31.254,.53],[35.921,.42],[39.253,.61],[44.187,.65],
    ]),
    speed: curve([
      [0,.39],[1.28,.45],[2.264,.54],[3.251,.82],[3.918,.87],[5.236,.63],
      [8.58,.72],[11.587,.65],[14.594,.74],[16.904,.73],[19.249,.6],
      [22.256,.53],[23.905,.58],[24.74,.57],[25.252,.67],[28.584,.75],
      [32.914,.78],[36.583,.69],[40.252,.57],[44.187,.46],
    ]),
    amplitude: curve([
      [0,.025],[.604,.03],[1.28,.16],[1.962,.06],[2.56,.085],[3.065,.025],
      [3.918,.05],[5.236,.07],[8.58,.038],[12.08,.11],[16.904,.035],
      [19.249,.07],[22.256,.11],[23.591,.07],[24.242,.15],[24.79,.32],
      [25.252,.19],[26.587,.065],[31.254,.075],[35.921,.045],[39.253,.105],
      [43.584,.09],[44.187,.11],
    ]),
  },
};

export default spec;
