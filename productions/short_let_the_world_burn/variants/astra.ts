/** The first two calls lift the rider up to the chorus, then the drums pull
 * the words into a low, urgent run. When the singer holds the G the rider
 * stretches out ahead of the drums. The upper C is the summit, slower and
 * higher, with time to fall all the way back to the three drum answers.
 * The last word lifts off again on its own. */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t < 24.462 ? impact ** 1.24 : t >= 44.745 ? impact * .82 : impact,
  })),
  axes: {
    air: curve([[0,.53],[2.252,.43],[3.646,.80],[4.481,.84],[5.457,.40],
      [10.356,.39],[14.187,.49],[19.969,.43],[23.835,.50],[24.462,.70],
      [25.321,.79],[28.758,.78],[31.985,.64],[34.006,.62],[34.865,.86],
      [35.48,.94],[39.091,.94],[40.310,.86],[42.028,.76],[43.514,.49],
      [44.478,.38],[45.906,.75],[46.98,.84]]),
    speed: curve([[0,.28],[2.252,.38],[3.646,.72],[4.481,.90],[8.348,.82],
      [13.514,.89],[16.091,.76],[21.258,.94],[23.835,.87],[25.321,.79],
      [28.758,.78],[31.985,.51],[34.145,.62],[35.48,.54],[39.091,.49],
      [40.31,.60],[43.514,.86],[44.478,.83],[45.906,.45],[46.98,.40]]),
    amplitude: curve([[0,.15],[2.252,.12],[3.646,.37],[4.481,.43],[5.457,.09],
      [13.514,.06],[19.969,.12],[23.835,.08],[25.321,.50],[28.758,.55],
      [29.466,.25],[33.123,.32],[34.006,.17],[34.865,.57],[35.48,.97],
      [39.091,.97],[40.31,.63],[42.028,.43],[43.514,.17],[44.478,.06],
      [45.906,.36],[46.98,.43]]),
  },
};
