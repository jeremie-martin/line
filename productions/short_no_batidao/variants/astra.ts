/**
 * Let the opening F hang, then gather speed under the singer until the drums take over.
 * The last three drum steps send the rider up into the bright stab at twelve seconds.
 * The bass catches him and sends him skimming through the hook. He gives up speed
 * for the lower singer, takes off again with the roll and coasts out on the drums.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t < 4.774 ? impact * .84 : impact ** 1.12,
  })),
  axes: {
    air: curve([[0,.81],[3.16,.68],[5.238,.38],[8.007,.34],[10.776,.55],[11.473,.91],
      [12.164,.92],[12.976,.37],[18.514,.4],[19.774,.69],[20.36,.38],[26.246,.34],
      [27.895,.76],[32.516,.78],[34.78,.53],[41.473,.31],[42.164,.42],[43.551,.78]]),
    speed: curve([[0,.36],[3.16,.43],[7.549,.81],[11.473,.89],[14.468,.96],
      [25.898,.88],[28.371,.48],[32.516,.45],[34.78,.77],[41.931,.97],[43.988,.59]]),
    amplitude: curve([[0,.10],[4.774,.07],[8.007,.035],[10.776,.12],[11.473,.43],
      [12.164,.48],[12.976,.045],[26.705,.05],[28.371,.16],[33.863,.14],
      [36.161,.07],[41.931,.03],[43.551,.17]]),
  },
};
