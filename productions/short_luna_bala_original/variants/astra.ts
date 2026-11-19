/**
 * The singer lets the sled go with a whisper. The broken drum bars pick up
 * speed in bursts, and the bass takes those bursts into one sustained run.
 * Keep the four bare drums moving fast right to the edge of the sung answer.
 * Each low A-sharp then gives the sled a fresh push up toward the higher voice;
 * the replies touch lightly, and the last one has time to drift away.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t >= 18.459 && t < 31.375 ? impact ** 1.28 : impact,
  })),
  axes: {
    speed: curve([[0,.43],[1.41,.50],[3.49,.61],[5.53,.69],[7.15,.93],[7.73,.74],
      [9.22,.76],[10.84,.97],[11.77,.71],[13.61,.77],[14.54,.92],[15.46,.74],
      [16.61,.78],[18.46,.95],[24,.97],[29.54,.92],[32.76,.97],[33.71,.47],
      [35.08,.56],[36.32,.39],[36.93,.50],[39.37,.22]]),
    air: curve([[0,.47],[1.41,.52],[3.49,.33],[4.85,.66],[6.69,.64],[7.15,.39],
      [8.54,.67],[10.15,.48],[10.84,.36],[12.23,.67],[14.54,.45],[15.92,.66],
      [18,.39],[20.30,.37],[24,.44],[27.69,.53],[29.54,.59],[31.38,.45],
      [32.76,.43],[33.71,.81],[34.39,.84],[35.08,.62],[35.61,.86],
      [36.32,.78],[36.93,.63],[37.63,.90],[38.67,.84],[39.37,.73]]),
    amplitude: curve([[0,.035],[1.41,.085],[3.49,.025],[4.85,.15],[7.15,.055],
      [8.54,.15],[10.84,.04],[12.23,.16],[14.54,.06],[15.92,.14],[18,.045],
      [24,.055],[29.54,.14],[32.76,.07],[33.23,.11],[33.71,.30],[34.39,.24],
      [35.08,.10],[35.61,.35],[36.32,.18],[36.93,.12],[37.63,.48],[38.67,.29],[39.37,.18]]),
  },
};
