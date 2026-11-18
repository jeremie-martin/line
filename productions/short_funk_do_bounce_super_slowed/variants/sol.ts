/**
 * Curl the last words into a low drum roll, then let the bass restart send the rider out in long, easy rebounds.
 * Ease off for the exposed calls and come down hard on the first drum step. The lone drum keeps a lower stride.
 * When the high replies arrive, the rider skips into the drum and brushes each reply as part of the same step.
 * Open the skip into wider leaps for the upper tune, give the low double a sharp landing, and leave on light treble steps.
 */
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const rollAndVoice = curve([
  [0, .68], [1.283, .92], [2.06, .57], [3.117, .76], [3.419, .95],
]);

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t,
    impact: t < 3.721 ? impact * rollAndVoice(t)!
      : t === 13.473 ? 1
      : t >= 22.192 && t < 32.688 && impact < .5 ? impact * .58
      : t >= 11.975 && t < 13.473 ? impact * .72
      : t === 37.262 ? .92
      : t === 37.436 ? .76
      : t >= 43.078 ? impact * .71
      : impact,
  })),
  axes: {
    air: curve([
      [0, .56], [.96, .52], [1.45, .28], [2.82, .22], [3.42, .40],
      [3.72, .73], [4.95, .81], [6.17, .68], [8.61, .87], [11.66, .71],
      [11.98, .59], [12.57, .74], [13.17, .80], [14.09, .43],
      [17.75, .46], [19.57, .58], [21.40, .48], [22.19, .63], [26.88, .61],
      [28.10, .72], [32.37, .61], [33.51, .70], [35.43, .77],
      [36.66, .84], [37.26, .79], [37.56, .47], [39.10, .60],
      [40.30, .88], [41.53, .86], [42.07, .77], [43.69, .50], [45.98, .51],
    ]),
    speed: curve([
      [0, .44], [.96, .50], [1.90, .64], [3.12, .76], [3.72, .92],
      [4.95, .61], [6.79, .62], [8.61, .78], [11.66, .64], [12.57, .38],
      [13.17, .66], [13.47, .91], [14.69, .82], [17.75, .75], [19.57, .88],
      [21.40, .78], [23.23, .91], [26.28, .85], [28.10, .97], [32.37, .86],
      [33.51, .65], [35.93, .69], [37.26, .91], [38.49, .68],
      [40.30, .61], [42.07, .58], [43.69, .50], [45.98, .58],
    ]),
    amplitude: curve([
      [0, .10], [1.28, .08], [1.90, .018], [3.12, .025], [3.72, .08],
      [4.35, .21], [5.56, .24], [6.33, .12], [8.61, .31], [11.66, .21],
      [12.25, .07], [12.87, .19], [13.47, .15], [14.69, .10], [18.35, .11],
      [19.57, .16], [21.40, .10], [23.23, .12], [27.50, .12], [28.10, .16],
      [32.37, .12], [33.51, .20], [34.22, .12], [35.93, .24],
      [37.26, .34], [37.56, .05], [39.10, .12], [40.30, .32], [41.53, .36],
      [42.07, .26], [43.08, .36], [44.01, .08], [45.98, .065],
    ]),
  },
};
