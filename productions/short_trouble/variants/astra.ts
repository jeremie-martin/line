/**
 * The opening crash throws a long shadow. Let the rider drift through the gaps
 * between the words, then tuck low as the three uneven stresses take over.
 * The quick drum answers barely lift. When the bass comes in, the rider bounds
 * away from the heavy kicks twice, gathering speed into each climbing triple.
 * One long glide carries the last kick out to the two exposed words.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t < 14.7 ? impact ** 1.24 : t < 27.725 && impact <= .22 ? impact * .7 : impact,
  })),
  axes: {
    air: curve([[0,.48],[2.18,.64],[3.52,.83],[5.79,.86],[8.02,.60],[11.12,.63],
      [12.54,.76],[14.70,.43],[16.05,.55],[18.29,.40],[21.87,.31],[27.24,.34],
      [27.73,.67],[28.75,.56],[29.03,.47],[29.93,.86],[33.51,.81],[35.08,.42],
      [36.19,.83],[40.68,.86],[42.24,.43],[42.47,.48],[43.00,.89],[43.78,.86],[44.65,.50]]),
    speed: curve([[0,.64],[2.18,.38],[5.79,.32],[11.12,.39],[12.54,.34],[14.70,.75],
      [18.29,.82],[24.33,.88],[27.24,.85],[27.93,.45],[28.60,.40],[29.03,.82],
      [30.60,.67],[33.51,.78],[35.08,.95],[36.19,.69],[40.68,.81],[42.24,.98],
      [43.78,.46],[44.65,.28]]),
    amplitude: curve([[0,.12],[2.18,.10],[3.00,.43],[4.60,.62],[5.79,.48],[6.68,.11],
      [11.12,.12],[11.65,.38],[12.54,.38],[14.70,.12],[17.84,.15],[18.52,.04],
      [27.24,.04],[28.10,.11],[28.75,.06],[29.03,.09],[29.38,.52],[29.93,.52],
      [30.82,.14],[32.61,.17],[33.05,.49],[33.51,.49],[35.08,.08],[35.70,.45],
      [37.09,.46],[37.99,.12],[39.78,.17],[40.10,.53],[40.68,.53],[42.24,.07],
      [42.47,.08],[42.90,.64],[43.78,.56],[44.23,.13],[44.65,.06]]),
  },
};
