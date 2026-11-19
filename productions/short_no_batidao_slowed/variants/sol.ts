/**
 * Make the bare drummer feel planted, with little words brushing past each beat.
 * The bright signal opens a window above the track, then the low pulse takes off in a long, shallow run.
 * The low singer breaks that run into slow arcs over the bare drums, leaving the last two vowels almost weightless.
 * The returning kick pulls the rider back into stride. The roll folds into four short, low steps.
 */
import { curve } from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export { overlayMeta } from './approved.ts';

const soften = curve([[0, .16], [4.27, .10], [5.34, .26], [12, .43], [14.22, .22],
  [18.66, .36], [22, .22], [23.10, .03], [29.76, .05], [31.42, .02],
  [34.76, .29], [38.09, .33], [39.76, .12], [40.78, .13]]);

export default {
  ...base,
  contacts: base.contacts.map(({ t, impact = 0 }) => ({
    t,
    impact: impact * (1 - soften(t)! * (1 - impact)),
  })),
  axes: {
    air: curve([
      [0, .42], [1.45, .43], [2.56, .36], [4.27, .38], [4.59, .87],
      [4.79, .85], [5.34, .54], [6.45, .42], [9.78, .42], [13.67, .38],
      [14.22, .37], [16.44, .46], [20.88, .37], [21.99, .42], [22.56, .58],
      [23.71, .78], [25.32, .79], [25.93, .62], [26.99, .77], [28.15, .82],
      [29.26, .68], [30.34, .83], [31.17, .66], [31.42, .51], [32.54, .58],
      [34.20, .49], [36.43, .46], [38.09, .40], [39.48, .36], [40.59, .31],
    ]),
    speed: curve([
      [0, .67], [2.56, .73], [3.95, .76], [4.79, .68], [5.89, .81],
      [9.78, .88], [14.22, .99], [16.44, .94], [19.21, .87], [21.99, .83],
      [23.10, .66], [24.28, .50], [25.32, .57], [27.55, .59], [29.26, .48],
      [30.34, .45], [31.42, .85], [33.65, .93], [37.53, .95], [39.76, .89],
      [40.59, .80], [40.783, .78],
    ]),
    amplitude: curve([
      [0, .05], [2.56, .04], [4.27, .028], [4.58, .23], [4.79, .23],
      [5.34, .07], [6.45, .045], [13.67, .044], [14.22, .033], [16.44, .065],
      [21.99, .035], [22.56, .07], [23.71, .21], [25.32, .23], [25.93, .08],
      [26.99, .18], [28.15, .20], [28.65, .10], [29.26, .18], [29.95, .065],
      [30.34, .19], [30.91, .21], [31.42, .045], [32.54, .09], [34.20, .065],
      [36.43, .04], [39.76, .026], [40.59, .012],
    ]),
  },
} satisfies typeof base;
