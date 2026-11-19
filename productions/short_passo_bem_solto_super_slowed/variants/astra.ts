/**
 * Follow the low vowel up to the high answer at six and a half seconds.
 * On the repeated C the rider gradually trades height for speed, until the
 * exposed calls bring him almost to a walk. Listen for the second drum stroke
 * at 36.64 and again at 45.43. Each throws him up, with just enough time
 * to come down for the reply. The last syllables carry him away at a walk again.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t >= 30.599 ? impact ** 1.28 : impact,
  })),
  axes: {
    air: curve([[0,.39],[3.71,.53],[5.91,.85],[6.868,.83],[10.838,.65],
      [13.033,.77],[16.899,.72],[23.47,.49],[27.87,.32],[28.695,.69],[30.355,.58],
      [31.435,.4],[35.823,.43],[36.636,.84],[37.182,.84],[37.739,.4],
      [44.606,.42],[45.425,.9],[45.97,.9],[46.528,.44],[49.546,.53]]),
    speed: curve([[0,.29],[5.37,.46],[8.371,.74],[13.033,.48],[17.433,.55],
      [24.016,.81],[27.307,.9],[28.996,.32],[29.832,.28],[30.599,.73],
      [35.545,.81],[37.182,.64],[43.776,.81],[45.97,.65],[48.165,.55],[49.778,.31]]),
    amplitude: curve([[0,.04],[3.71,.085],[5.91,.23],[6.868,.2],[10.838,.08],
      [13.602,.21],[19.082,.16],[27.307,.04],[28.695,.11],[30.599,.05],
      [36.09,.05],[36.636,.28],[37.182,.28],[37.599,.055],[44.867,.05],
      [45.425,.32],[45.97,.32],[46.388,.06],[49.778,.055]]),
  },
};
