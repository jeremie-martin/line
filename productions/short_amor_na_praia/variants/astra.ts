/**
 * The two little taps before the first drum barely brush the ground. The drum sends the rider
 * running low through the dry strokes and the first four kicks. The upper answers gradually
 * pull that run off the ground. When the bass takes over at 32 seconds, the rider hangs back
 * and swings in longer arcs. The quick words bring the feet back down for the last pair.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({t, impact: impact ** 1.22})),
  axes: {
    air: curve([[0,.65],[1.34,.46],[2.23,.31],[7.98,.39],[9.25,.68],[10.47,.32],
      [11.50,.78],[12.61,.42],[19.32,.42],[23.59,.61],[29.08,.70],[31.52,.47],
      [33.35,.80],[40.67,.79],[43.11,.44],[47.99,.48],[49.82,.36],[51.05,.68],[52.35,.78]]),
    speed: curve([[0,.34],[1.79,.48],[3.11,.82],[7.11,.92],[9.25,.51],[10.47,.86],
      [14.43,.91],[21.76,.76],[27.86,.68],[31.52,.88],[33.35,.54],[38.81,.51],
      [41.28,.64],[43.72,.85],[48.58,.89],[51.05,.45],[52.35,.28]]),
    amplitude: curve([[0,.09],[2.23,.03],[7.98,.05],[9.25,.24],[10.47,.04],[11.50,.29],
      [12.61,.05],[20.53,.07],[27.86,.16],[31.52,.12],[33.35,.35],[40.67,.36],
      [43.11,.09],[50.43,.06],[51.05,.18],[52.35,.42]]),
  },
};
