/**
 * Let the first words slide by almost silently, with three equally sharp knocks across them.
 * The backbeat has a lazy swing. The rider takes a little more sky each time the drums leave
 * a beat empty, until the held word at 24 seconds can carry a whole flight. The return runs
 * close to the ground for four bars, then the beat softens and the rider drifts on past it.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t < 4.586 ? impact : impact * (t < 25.252 ? .87 : t < 36.583 ? 1 : .73),
  })),
  axes: {
    air: curve([[0,.39],[1.63,.62],[3.07,.34],[3.92,.64],[5.91,.46],[6.78,.70],
      [7.58,.45],[11.25,.44],[12.10,.76],[12.92,.47],[16.59,.46],[17.47,.82],
      [18.25,.51],[20.60,.63],[23.59,.55],[24.24,.82],[24.85,.91],[25.93,.38],
      [35.59,.40],[37.25,.61],[41.25,.73],[44.19,.78]]),
    speed: curve([[0,.32],[1.96,.39],[3.25,.80],[3.92,.79],[5.24,.57],[14.26,.54],
      [20.60,.63],[24.24,.47],[25.25,.60],[27.60,.80],[35.59,.78],[39.25,.54],[44.19,.43]]),
    amplitude: curve([[0,.06],[1.63,.14],[3.07,.03],[4.59,.09],[6.25,.08],[6.84,.28],
      [7.58,.07],[11.59,.08],[12.13,.40],[12.92,.07],[16.90,.09],[17.43,.51],[18.25,.10],
      [23.59,.13],[24.24,.38],[24.70,.78],[25.25,.49],[25.93,.05],[35.59,.08],
      [39.25,.24],[44.19,.29]]),
  },
};
