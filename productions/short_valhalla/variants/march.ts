/** The upper pickup and the roll back into the high voice frame a march.
 * Follow the kick and snare through the low verse. Every other kick anticipates the
 * square pulse, and its snare comes early with it. Let the little bass replies through
 * where there's room. A handful of vocal ends complete the holes in the percussion,
 * especially the E3 at 38.66. The quick words move across the march without separate
 * catches. This makes the uneven drum spacing easier to feel, though the singer's
 * phrasing at 17–19 and 30–32 may be missed. I prefer the sung reading there.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import {duration, music, highOpening, highReturn} from '../music.ts';
export {overlayMeta} from '../music.ts';

const march: [number, number][] = [
  [11.529, .87], [12.167, .38], [12.817, .27], [13.142, .91], [13.456, .41],
  [14.106, .78], [14.756, .42], [15.238, .31], [15.732, .86], [16.057, .39],
  [16.376, .25], [16.684, .80], [17.345, .38], [17.990, .48], [18.309, .87], [18.634, .40],
  [19.284, .92], [19.934, .37], [20.608, .49], [21.223, .43], [21.873, .85],
  [22.512, .41], [22.86, .29], [23.487, .88], [23.800, .38], [24.451, .92], [25.101, .40],
  [25.588, .44], [26.064, .85], [26.389, .42], [26.720, .26], [27.040, .79], [27.678, .42],
  [28.340, .47], [28.653, .86], [28.979, .36], [29.617, .81], [30.267, .38],
  [30.755, .43], [31.254, .34], [31.556, .43], [32.206, .83], [32.845, .42],
  [33.808, .92], [34.122, .39], [34.783, .86], [35.422, .47], [36.020, .41],
  [36.374, .85], [36.711, .39], [37.071, .25], [37.349, .80], [37.999, .40],
  [38.661, .51], [38.963, .93], [39.253, .42], [39.938, .85], [40.577, .40], [41.215, .35],
];

const spec: Spec = {
  duration, preroll: 2, music,
  contacts: [...highOpening, ...march, ...highReturn].map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, .73], [1.15, .69], [11.53, .62], [19.28, .60], [30.27, .64], [40.58, .59], [41.88, .66], [43.50, .73], [52.16, .68]]),
    speed: curve([[0, .61], [1.15, .85], [11.53, .83], [24.45, .87], [36.37, .85], [42.52, .89], [51.84, .86]]),
  },
};
export default spec;
