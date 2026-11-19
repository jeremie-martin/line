/**
 * Let the rider rock along with the opening words and lean forward on the two low beats.
 * Give the paired syllables one easy, loping stride. Twice the little drum fill
 * pulls him sharply down and through, and twice he settles back into that stride.
 * The shared word and drum near 29 seconds sets a heavier tread that lasts
 * until the voice lets go and the upper reply lifts clear of the ground.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t >= 29.316 && t < 44.467 ? impact + .12 * impact * (1 - impact) : impact,
  })),
  axes: {
    air: curve([[0,.54],[4.052,.62],[5.625,.76],[7.942,.45],[10.043,.51],[12.342,.71],
      [15.198,.77],[15.982,.48],[16.382,.34],[17.27,.72],[23.482,.78],[24.265,.46],
      [24.521,.33],[25.554,.73],[26.332,.79],[28.683,.55],[29.705,.32],
      [39.283,.39],[43.428,.32],[45.535,.54],[46.284,.86],[47.029,.9]]),
    speed: curve([[0,.45],[5.12,.50],[8.197,.81],[11.065,.52],[14.942,.54],
      [16.231,.85],[17.27,.54],[23.22,.56],[24.521,.87],[25.554,.53],
      [27.679,.39],[28.921,.72],[35.138,.82],[43.428,.79],[46.852,.37]]),
    amplitude: curve([[0,.06],[5.625,.16],[8.197,.065],[12.342,.16],[14.942,.23],
      [16.121,.035],[17.27,.21],[23.22,.23],[24.37,.035],[25.554,.2],
      [27.063,.085],[29.316,.045],[44.467,.055],[45.895,.09],[46.284,.27]]),
  },
};
