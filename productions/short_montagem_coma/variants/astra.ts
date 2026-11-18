/**
 * Let the drums race along the ground. The singer pulls the rider up out of that rhythm, first in short answers,
 * then all the way up on the long B around 25 seconds. Each turn down through A and G-sharp brings the rider
 * closer to the track. The last burst grows out of those low steps and runs straight through to the little
 * vocal bridge, where the rider takes a breath before gathering speed again.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(c => c.t >= 22.607 && c.t <= 31.813 && c.impact! < .61
    ? {...c, impact: c.impact! * .86} : c),
  axes: {
    air: curve([[0,.69],[3.601,.66],[5.586,.76],[7.595,.82],[8.593,.47],[13.098,.43],
      [15.594,.61],[16.093,.74],[16.616,.26],[17.591,.26],[18.09,.74],[19.588,.47],
      [22.096,.45],[23.605,.72],[25.138,.83],[25.72,.94],[26.31,.69],[27.843,.51],
      [29.259,.43],[31.813,.35],[33.09,.52],[38.605,.49],[39.371,.74],[39.859,.68],
      [40.602,.50],[44.097,.49],[47.591,.57],[48.019,.36]]),
    speed: curve([[0,.48],[4.1,.45],[6.097,.54],[7.595,.60],[9.093,.89],[14.596,.92],
      [16.093,.94],[16.616,.82],[17.591,.82],[18.09,.94],[21.597,.88],[23.605,.50],
      [25.72,.38],[27.843,.54],[29.654,.71],[32.092,.95],[38.605,.91],[39.604,.55],
      [41.09,.86],[46.593,.94],[47.591,.83],[48.019,.55]]),
    amplitude: curve([[0,.09],[4.1,.07],[7.595,.18],[8.593,.048],[15.095,.045],
      [16.093,.12],[16.616,.018],[17.591,.018],[18.09,.12],[19.588,.05],[22.096,.045],
      [23.605,.14],[25.138,.23],[25.62,.53],[26.31,.16],[27.843,.075],[31.813,.018],
      [33.09,.06],[38.605,.065],[39.604,.09],[40.602,.04],[47.591,.055],[48.019,.014]]),
  },
};
