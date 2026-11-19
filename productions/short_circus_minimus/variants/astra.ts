/** The low stroke sets the stride. When the hats come in, the rider leans forward.
 * In the hook the words skim along close together, then the rider vaults the hole
 * at the end of each line and comes down on the bass. The five exposed notes take
 * the pace right back. The full band opens the stride again, widest on the held word. */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({t, impact: impact ** 1.22})),
  axes: {
    air: curve([[0,.64],[5.893,.65],[9.092,.44],[17.492,.42],[18.693,.37],
      [21.085,.38],[21.35,.87],[21.886,.86],[22.153,.38],
      [24.289,.38],[24.56,.87],[25.091,.86],[25.334,.38],
      [27.494,.38],[27.76,.89],[28.283,.87],[28.516,.39],
      [29.491,.41],[29.944,.66],[31.29,.68],[32.695,.58],
      [39.905,.53],[46.29,.64],[50.702,.77],[51.492,.88],[53.907,.60],[57.099,.53]]),
    speed: curve([[0,.53],[5.893,.57],[12.291,.80],[18.693,.91],[28.283,.91],
      [29.491,.76],[30.118,.42],[31.081,.41],[32.695,.72],[39.905,.84],
      [46.29,.83],[50.702,.64],[51.91,.57],[57.099,.78]]),
    amplitude: curve([[0,.19],[5.893,.21],[13.492,.10],[18.693,.04],
      [21.085,.03],[21.35,.45],[21.886,.45],[22.153,.03],
      [24.289,.03],[24.56,.46],[25.091,.46],[25.334,.03],
      [27.494,.03],[27.76,.48],[28.283,.48],[28.516,.03],
      [31.29,.05],[33.485,.19],[43.086,.13],[50.702,.30],[51.492,.49],[53.907,.18],[57.099,.11]]),
  },
};
