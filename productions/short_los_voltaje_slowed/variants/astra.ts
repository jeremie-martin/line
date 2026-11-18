/**
 * Each opening call sends the sled a little farther up into the silence.
 * The six answering drum taps bring it down to a quick skim for the rush of words.
 * After the first kick, the strong low notes come in clusters. The sled climbs
 * into the cluster around 23 seconds and its echo nine seconds later, then runs
 * beneath the repeating hook until the last three words lift free.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t >= 11.672 && t <= 15.631 ? impact : impact ** 1.18,
  })),
  axes: {
    air: curve([[0,.37],[1.05,.52],[1.45,.77],[2.66,.65],[3.22,.63],[3.65,.88],[4.85,.72],
      [7.04,.57],[9.24,.64],[10.57,.39],[13.10,.32],[15.77,.44],[19.88,.42],
      [22.34,.73],[24.54,.81],[26.17,.43],[28.91,.44],[31.10,.72],[32.74,.80],
      [34.38,.56],[37.39,.38],[42.04,.48],[46.15,.36],[49.71,.53],[50.83,.78],[51.48,.72]]),
    speed: curve([[0,.25],[5.41,.38],[9.24,.57],[11.41,.72],[15.77,.98],[19.88,.94],
      [23.44,.69],[25.63,.86],[28.91,.96],[32.19,.70],[34.38,.83],[37.39,.97],
      [46.15,.99],[50.25,.85],[51.39,.40]]),
    amplitude: curve([[0,.03],[1.05,.08],[1.6,.36],[2.66,.26],[3.22,.12],[3.8,.56],[4.85,.45],
      [6.48,.08],[9.24,.16],[11.41,.04],[15.77,.03],[19.88,.06],[23.44,.34],
      [24.54,.27],[26.17,.06],[28.91,.04],[32.19,.36],[33.29,.22],[35.47,.06],
      [46.15,.035],[49.71,.14],[51.39,.26]]),
  },
};
