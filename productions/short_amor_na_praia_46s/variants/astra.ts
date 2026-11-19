/**
 * The opening boom loses its weight in a string of tiny mouth sounds. Eight dry strokes
 * set off a single long jump into the band. The kicks swing in pairs of bars, the first
 * stretching out and the second drawing the rider back down. At the big kick near 27 seconds
 * that rocking motion straightens into a fast glide. Only the last two echoes lift out of it.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t < 4.458 || t > 43.241 ? impact : impact ** 1.30,
  })),
  axes: {
    air: curve([[0,.62],[.61,.44],[3.61,.27],[4.46,.49],[6.93,.45],[7.755,.56],
      [8.12,.89],[9.13,.87],[10.78,.68],[13.53,.39],[15.73,.73],[17.93,.39],
      [20.13,.73],[22.33,.39],[24.53,.75],[26.73,.52],[28.93,.34],[40.48,.38],
      [43.24,.48],[44.34,.51],[45.72,.86]]),
    speed: curve([[0,.62],[1.13,.33],[3.36,.26],[4.46,.74],[6.93,.84],[8.51,.55],
      [9.13,.63],[13.53,.75],[15.73,.57],[17.93,.77],[20.13,.57],[22.33,.77],
      [24.53,.57],[26.73,.91],[38.84,.93],[43.24,.72],[44.34,.47],[45.72,.25]]),
    amplitude: curve([[0,.09],[1.13,.03],[4.46,.04],[7.34,.10],[8.15,.71],[9.13,.56],
      [10.78,.20],[13.53,.05],[15.73,.29],[17.93,.06],[20.13,.29],[22.33,.06],
      [24.53,.32],[26.73,.14],[28.93,.04],[42.68,.05],[44.34,.09],[45.72,.33]]),
  },
};
