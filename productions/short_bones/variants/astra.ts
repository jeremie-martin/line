/**
 * The bridge moves at speaking pace. The long lower vowels lift the rider, then the tightening
 * syllables send it down into the crash. The chorus runs in four sentences. The first stays low,
 * the second takes longer strides on the bass replies, and the third eases back for the held voice.
 * The last line picks up speed into the fill and spends the two seconds of ringing sound coasting out.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t < 11.224 ? impact * .78 : impact ** 1.16,
  })),
  axes: {
    air: curve([[0,.35],[2.63,.49],[3.43,.78],[4.58,.55],[5.92,.79],[7.37,.56],
      [9.32,.76],[10.92,.71],[12.77,.34],[13.30,.47],[19.62,.42],[21.72,.53],
      [23.26,.71],[27.48,.69],[29.72,.51],[31.72,.70],[32.88,.41],[35.15,.65],
      [37.25,.69],[38.57,.53],[42.77,.41],[44.87,.62],[45.67,.71],[46.43,.47],[48.42,.25]]),
    speed: curve([[0,.32],[4.11,.28],[6.99,.47],[10.21,.37],[11.22,.55],[13.30,.94],
      [19.62,.91],[21.72,.84],[25.93,.72],[28.82,.86],[30.14,.65],[34.35,.55],
      [37.25,.72],[38.57,.65],[42.77,.82],[45.67,.99],[46.43,.63],[48.42,.27]]),
    amplitude: curve([[0,.04],[2.96,.15],[3.54,.54],[4.58,.12],[6.38,.44],[7.37,.11],
      [9.32,.26],[10.21,.39],[11.22,.18],[12.77,.04],[19.62,.06],[21.72,.13],
      [23.26,.27],[28.82,.24],[30.14,.12],[31.72,.24],[32.88,.04],[35.15,.18],
      [37.25,.26],[39.37,.13],[42.77,.06],[45.67,.23],[46.43,.10],[48.42,.04]]),
  },
};
