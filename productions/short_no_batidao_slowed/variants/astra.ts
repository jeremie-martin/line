/**
 * The first drummer barely lifts his feet. The bright signal opens the stride,
 * and each bass beat buys a little more time in the air. The pickup halfway
 * through breaks that swing and the second run of beats starts building it again.
 * The low D brings the rider down close enough to brush the words, then the
 * returning beat carries him forward until the four short strokes catch up.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t >= 5.336 && t < 22.565 ? impact ** 1.42 : impact,
  })),
  axes: {
    air: curve([[0,.33],[3.954,.35],[4.79,.77],[5.893,.48],[10.885,.75],
      [13.672,.83],[13.939,.47],[15.332,.49],[18.664,.72],[21.439,.88],
      [22.82,.39],[29.949,.38],[31.168,.65],[33.652,.61],[38.633,.49],[40.038,.29]]),
    speed: curve([[0,.72],[3.687,.8],[5.336,.67],[12,.56],[14.217,.82],
      [20.881,.57],[23.099,.51],[28.648,.47],[31.423,.85],[38.087,.92],[40.589,.7]]),
    amplitude: curve([[0,.035],[3.954,.04],[4.79,.23],[5.893,.09],[12.557,.31],
      [13.672,.29],[14.217,.07],[16.435,.12],[21.439,.34],[22.565,.055],
      [30.912,.045],[31.981,.105],[37.53,.09],[40.038,.025]]),
  },
};
