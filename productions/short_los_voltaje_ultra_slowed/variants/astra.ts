/**
 * The opening gathers speed syllable by syllable until the first heavy drum
 * seems to stop the rush. Give that whole answer slow, high rebounds.
 * When the F starts answering back, the sled slips lower and quicker between
 * the two sounds. The heavy beats gradually win back the height, spending it
 * all on the last drum before the four soft syllables coast out together.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => {
    if (t < 5.7) return {t, impact: impact * .80};
    if (t >= 27.028 && impact < .50) return {t, impact: impact * .78};
    return {t, impact};
  }),
  axes: {
    speed: curve([[0,.20],[3.74,.31],[5.70,.44],[9.67,.57],[11.33,.72],[15.48,.94],
      [16.29,.76],[18.29,.44],[24.25,.52],[25.58,.63],[27.03,.81],[31.87,.91],
      [36.19,.87],[37.51,.69],[42.82,.66],[46.80,.58],[51.44,.68],[57.41,.57],
      [58.36,.41],[60,.26]]),
    air: curve([[0,.32],[3.04,.43],[5.70,.51],[8.37,.62],[10.99,.49],[13.65,.36],
      [15.72,.34],[16.29,.84],[18.29,.90],[25.58,.89],[27.03,.51],[31.87,.40],
      [36.19,.45],[37.51,.60],[42.82,.67],[46.80,.78],[51.44,.72],[57.41,.89],
      [58.07,.86],[58.78,.49],[60,.36]]),
    amplitude: curve([[0,.025],[5.70,.11],[8.37,.22],[10.99,.08],[15.72,.035],
      [16.29,.30],[18.29,.50],[24.25,.44],[25.58,.55],[27.03,.12],[31.87,.055],
      [36.19,.08],[40.16,.20],[46.80,.38],[51.44,.27],[57.41,.53],[58.07,.43],
      [58.78,.08],[60,.04]]),
  },
};
