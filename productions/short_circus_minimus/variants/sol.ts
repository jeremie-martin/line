/**
 * Let the bass swing the rider through wide arcs in the verse, with softer touches for the answering words.
 * When the hook starts catching on every little syllable, gather speed and skim low until each phrase opens up.
 * In the break, the five upper notes climb lightly toward the hardest bass return.
 * Give the full groove its swing back, then let the held voice lift the rider once more before the last bar.
 */
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

const pace = curve([
  [0, .56], [4.69, .60], [8.29, .77], [17.89, .78],
  [19.09, .96], [21.89, .87], [23.09, .96], [25.09, .87], [26.30, .98], [28.28, .88],
  [29.49, .84], [30.12, .52], [30.69, .58], [31.50, .92],
  [33.49, .84], [39.10, .80], [43.09, .88], [47.50, .79], [50.11, .82],
  [51.49, .61], [52.69, .68], [55.09, .79], [57.10, .90],
]);

const softTouch = curve([
  [0, .74], [5.89, .84], [17.89, .78], [19.09, .58], [29.49, .58],
  [30.69, .76], [32.29, .67], [39.10, .78], [44.31, .75],
  [50.70, .84], [51.49, .66], [53.49, .70], [57.10, .74],
]);

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t,
    impact: impact < .5 ? impact * softTouch(t)! : impact,
  })),
  axes: {
    air: curve([
      [0, .70], [5.30, .76], [7.09, .62], [16.69, .63], [18.69, .48],
      [19.09, .32], [21.09, .38], [21.89, .70], [22.28, .34],
      [24.29, .41], [25.09, .72], [25.49, .36], [27.49, .42], [28.28, .73],
      [28.89, .39], [29.49, .44], [30.12, .52], [30.69, .60], [31.50, .75],
      [33.49, .69], [37.91, .58], [41.10, .67], [46.29, .64], [49.89, .68],
      [50.70, .74], [51.49, .87], [52.69, .68], [55.09, .56], [57.10, .62],
    ]),
    speed: pace,
    amplitude: curve([
      [0, .20], [1.49, .29], [4.69, .32], [7.09, .21], [16.69, .19], [18.69, .10],
      [19.09, .035], [21.09, .06], [21.49, .26], [22.15, .04],
      [24.29, .06], [24.68, .29], [25.33, .04], [27.49, .07], [27.89, .31], [28.52, .045],
      [29.49, .055], [30.12, .07], [30.69, .085], [31.50, .13],
      [33.49, .20], [37.91, .13], [41.10, .21], [46.29, .17], [50.11, .22],
      [51.09, .39], [51.91, .24], [53.49, .14], [57.10, .16],
    ]),
  },
};
