/** The faint clock hangs in the air. Each echo brings it a little closer until
 * the singer and the drums can pass the beat between them at ground level.
 * The bass at eighteen seconds pulls the whole ride forward in shallow strokes.
 * It coasts over the missing weight at twenty-seven, then slowly gets its
 * bounce back as the high sound comes through over the motor. */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t < 4.181 ? impact * .76 : t === 26.809 ? .22 : impact,
  })),
  axes: {
    air: curve([[0,.80],[3.624,.83],[5.319,.75],[7.583,.62],[8.581,.35],
      [9.278,.54],[12.389,.52],[13.12,.34],[13.655,.42],[15.512,.49],
      [17.196,.36],[17.776,.33],[25.682,.35],[26.251,.54],[26.809,.86],
      [27.378,.73],[28.527,.37],[33.612,.38],[39.835,.59],[44.932,.67]]),
    speed: curve([[0,.25],[3.624,.29],[7.583,.52],[8.72,.69],[12.668,.70],
      [13.655,.54],[15.512,.51],[17.196,.76],[18.902,.94],[25.682,.95],
      [26.809,.69],[27.378,.66],[29.096,.87],[35.307,.89],[40.404,.80],[44.932,.76]]),
    amplitude: curve([[0,.28],[4.181,.30],[7.583,.17],[8.581,.04],[12.389,.09],
      [13.248,.04],[15.512,.08],[17.776,.05],[25.682,.05],[26.251,.16],[26.809,.31],
      [27.378,.24],[28.527,.06],[33.612,.06],[39.835,.20],[44.932,.26]]),
  },
};
