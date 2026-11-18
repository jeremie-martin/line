/**
 * The bass sends the sled racing close to the ground. Each time the seven
 * bright notes answer, the fourth and fifth carry it up over the beat.
 * The second answer stays aloft into the hush, crossing it at speed on the
 * faintest touches. The bare drums take the height away in one stroke.
 * When the bass returns it has farther to run before that last little lift.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t >= 21.213 && t <= 26.205 ? impact * .76 : impact,
  })),
  axes: {
    air: curve([[0,.42],[3.25,.38],[4.63,.60],[5.41,.37],[9.61,.36],[10.98,.51],
      [12.11,.80],[12.78,.41],[16.88,.35],[18.25,.54],[19.38,.83],[21.21,.88],
      [25.87,.78],[26.21,.82],[27.34,.61],[27.80,.33],[32.79,.35],[34.38,.53],
      [34.61,.66],[35.52,.47],[39.60,.41],[41.66,.68],[43.70,.40],[46.88,.36],
      [47.57,.54],[48.48,.79],[49.69,.65]]),
    speed: curve([[0,.98],[3.25,.96],[4.63,.86],[5.52,1],[10.52,.99],[12.11,.86],
      [12.78,.99],[17.79,1],[19.38,.89],[21.21,.95],[26.21,.95],[27.34,1],
      [33.47,.98],[34.38,.88],[34.61,.96],[35.52,1],[40.40,.99],[41.66,.88],
      [43.70,1],[47.34,1],[48.48,.91],[49.69,.83]]),
    amplitude: curve([[0,.075],[3.25,.04],[4.05,.16],[5.41,.025],[10.52,.04],
      [11.32,.09],[12.11,.27],[12.78,.055],[17.79,.045],[18.59,.12],[19.38,.33],
      [20.40,.59],[21.21,.40],[22.58,.20],[25.87,.18],[26.80,.51],[27.34,.29],
      [27.80,.04],[34.16,.035],[35.06,.19],[36.43,.07],[40.07,.055],[41.66,.18],
      [43.70,.055],[47.34,.045],[48.48,.29],[49.69,.15]]),
  },
};
