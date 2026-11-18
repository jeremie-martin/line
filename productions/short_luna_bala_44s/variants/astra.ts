/**
 * The solo voice barely brushes the snow. In the breath between its two
 * sentences the sled hangs for a moment, then slips back under the words.
 * Hear the five upper strokes as a bow: the sled rises into the long fourth
 * and comes down through the clipped fifth. The bare drums cut that bow short.
 * Bass answers send the sled along the ground until the refrain opens out again.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t >= 8.615 && t < 43.566 ? impact ** 1.24 : impact,
  })),
  axes: {
    air: curve([[0,.40],[2.85,.37],[3.48,.55],[3.75,.92],[4.25,.90],[4.66,.43],
      [5.93,.54],[7.74,.37],[8.62,.47],[9.99,.82],[10.79,.49],[12.17,.82],
      [12.97,.49],[14.34,.82],[15.16,.48],[16.52,.56],[17.33,.45],[18.70,.80],
      [19.52,.48],[20.88,.82],[21.69,.49],[23.06,.79],[23.88,.41],[25.51,.31],
      [26.05,.46],[33.97,.40],[34.78,.57],[36.15,.76],[36.96,.53],[38.33,.78],
      [39.14,.52],[40.51,.79],[41.31,.54],[42.69,.77],[43.57,.49],[44,.33]]),
    speed: curve([[0,.42],[3.48,.40],[4.50,.33],[5.93,.49],[8.41,.76],[10.79,.79],
      [15.16,.83],[16.79,.96],[18.70,.76],[22.52,.84],[23.88,.68],[25.25,.56],
      [26.88,.94],[32.60,.98],[34.78,.86],[38.33,.71],[42.96,.77],[44,.36]]),
    amplitude: curve([[0,.04],[3.48,.035],[3.78,.47],[4.20,.53],[4.66,.05],[5.93,.13],
      [8.41,.035],[8.62,.07],[9.99,.28],[10.79,.08],[12.17,.28],[12.97,.08],
      [14.34,.30],[15.16,.08],[16.79,.10],[17.33,.065],[18.70,.27],[19.52,.08],
      [20.88,.30],[21.69,.08],[23.06,.28],[23.88,.065],[25.51,.04],[34.23,.055],
      [36.15,.25],[36.96,.08],[38.33,.27],[39.14,.08],[40.51,.27],[41.31,.09],
      [42.69,.24],[43.76,.05]]),
  },
};
