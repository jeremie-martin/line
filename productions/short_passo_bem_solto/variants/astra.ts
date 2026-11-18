/**
 * The rider takes the opening syllables in quick, shallow steps. When the treble
 * starts dancing, he skips over the same hole in each phrase, landing back
 * among the little answers. The bare call takes the spring out of his step.
 * When the drums come back he spends that energy on one long accelerating run,
 * easing off as the last word breaks up the beat.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t < 14.58 ? impact ** 1.22 : impact,
  })),
  axes: {
    air: curve([[0,.41],[6.494,.38],[9.048,.61],[13.901,.47],
      [15.288,.86],[15.973,.88],[16.519,.44],[18.284,.44],[18.98,.87],[19.665,.89],
      [20.211,.43],[22.057,.46],[22.672,.88],[23.357,.88],[23.903,.43],
      [25.668,.47],[26.364,.88],[27.049,.91],[27.699,.46],[28.907,.32],
      [31.194,.55],[38.59,.43],[44.127,.35],[46.322,.55]]),
    speed: curve([[0,.63],[6.494,.75],[10.894,.84],[14.58,.68],[25.668,.68],
      [27.699,.42],[28.466,.36],[29.348,.67],[34.433,.82],[41.817,.98],[44.127,.94],[46.438,.57]]),
    amplitude: curve([[0,.035],[9.048,.08],[14.58,.06],
      [15.288,.36],[15.973,.36],[16.2,.055],[18.644,.06],[18.98,.36],[19.665,.36],
      [19.897,.055],[22.336,.06],[22.672,.36],[23.357,.36],[23.584,.055],
      [26.028,.06],[26.364,.39],[27.049,.39],[27.699,.035],[29.348,.04],
      [35.815,.09],[43.663,.055],[46.438,.04]]),
  },
};
