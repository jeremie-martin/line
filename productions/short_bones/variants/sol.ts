/** The spoken bridge barely brushes the line. The lower sung notes stretch it into slow,
 * suspended arcs, with a quick tightening as the pickups drive into the first crash.
 * In the chorus the rider stays low through the drum-and-bass exchanges so the backbeats stand out.
 * The held lower voice widens the next turn, then the clipped notes pull it back to the line.
 * The last drum fill lifts the rider once more, and the resonance carries a long, settling coast.
 */
import {curve} from '../../../scripts/v0/core/measured.ts';
import type {Spec} from '../../../scripts/v0/types.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t,
    impact: t < 4.583 ? impact * .67
      : t < 11.224 ? impact ** 1.26
      : t < 13.302 ? impact
      : t === 22.23 ? .95
      : t === 23.263 ? .85
      : t === 25.411 ? .63
      : t < 45.671 ? impact ** 1.55
      : t === 45.671 ? impact
      : impact ** 1.48,
  })),
  axes: {
    air: curve([
      [0,.3],[2.632,.41],[3.55,.88],[4.583,.58],[5.918,.76],[6.986,.84],
      [7.985,.52],[9.087,.64],[10.214,.79],[10.922,.69],[12.234,.41],
      [13.302,.61],[14.846,.48],[18.306,.41],[20.407,.61],[21.986,.42],
      [23.263,.57],[25.411,.56],[27.478,.41],[28.824,.59],[30.136,.7],
      [31.715,.68],[32.522,.47],[34.502,.4],[35.616,.62],[37.253,.68],
      [38.565,.74],[40.667,.55],[43.569,.44],[44.869,.62],[45.671,.83],
      [46.425,.39],[48.423,.19],
    ]),
    speed: curve([
      [0,.3],[2.957,.32],[4.107,.36],[4.885,.43],[6.986,.38],[9.087,.47],
      [10.214,.45],[11.224,.65],[12.501,.9],[13.302,.99],[15.403,.94],
      [19.618,.98],[22.23,.96],[25.411,.87],[28.824,.95],[30.659,.74],
      [32.249,.76],[34.351,.92],[36.452,.86],[38.565,.77],[40.667,.82],
      [43.569,.92],[45.136,.98],[45.671,.91],[46.425,.6],[48.423,.24],
    ]),
    amplitude: curve([
      [0,.025],[2.632,.05],[3.56,.31],[4.583,.1],[5.918,.18],[6.986,.27],
      [7.985,.075],[9.087,.13],[10.214,.2],[10.922,.13],[12.234,.035],
      [13.302,.065],[15.403,.055],[18.306,.035],[20.407,.09],[22.23,.045],
      [25.411,.07],[27.478,.04],[28.824,.09],[30.659,.14],[31.715,.13],
      [32.522,.07],[34.502,.04],[35.616,.1],[37.253,.11],[38.565,.13],
      [40.667,.075],[43.569,.055],[44.869,.11],[45.671,.16],[46.425,.065],
      [48.423,.035],
    ]),
  },
};

export default spec;
