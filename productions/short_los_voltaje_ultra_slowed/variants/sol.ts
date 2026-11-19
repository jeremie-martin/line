/**
 * Let the low calls gather into a run, then let the first broad drum catch the rider and pull the stride down.
 * The F refrain lifts out of that weight. It crosses the low drum in longer, slower arcs until the bass takes over again.
 * The late downbeats run close to the ground and gain speed into the two big answers.
 * Give the four exposed syllables at the end barely a touch and let the last one trail away.
 */
import base from './approved.ts';
import { curve } from '../../../scripts/v0/core/measured.ts';

export { overlayMeta } from './approved.ts';

const contrast = curve([
  [0, 1.8], [5.016, 1.6], [8.371, 1.35], [10.995, 1.03], [11.331, 1],
  [15.929, 1], [16.289, 1.3], [60, 1.3],
]);

export default {
  ...base,
  contacts: base.contacts.map(({ t, impact = 0 }) => ({
    t,
    impact: impact ** (t >= 58.363 ? 2.25 : contrast(t)!),
  })),
  axes: {
    air: curve([
      [0, .38], [1.08, .41], [2.7, .58], [4.2, .46], [5.7, .57], [8.6, .48],
      [9.67, .33], [11.33, .47], [12.65, .40], [15.55, .26], [16.29, .53],
      [18.5, .51], [20.9, .56], [22.3, .48], [25.45, .68], [26.45, .60],
      [27.6, .79], [28.9, .90], [31.05, .80], [32.45, .73], [34.35, .91],
      [36.1, .85], [37.9, .47], [40.1, .53], [42.45, .42], [44.5, .54],
      [46.55, .72], [48.4, .48], [50.9, .55], [53.4, .45], [55.2, .56],
      [57.35, .77], [58.25, .61], [60, .85],
    ]),
    speed: curve([
      [0, .27], [3, .35], [5.7, .48], [9.4, .59], [11.33, .72], [13.65, .86],
      [16.29, 1], [17.6, .88], [21.6, .94], [23.2, .85], [25.58, .98],
      [27.65, .71], [30.1, .66], [32.2, .80], [34.2, .67], [36.19, .82],
      [37.51, .92], [42.82, .99], [44.82, .88], [46.8, 1], [48.8, .89],
      [51.44, .98], [53.4, .91], [57.41, 1], [58.36, .76], [60, .39],
    ]),
    amplitude: curve([
      [0, .02], [2.7, .085], [4.25, .04], [5.4, .12], [6.8, .04], [7.95, .16],
      [9.67, .03], [11.07, .08], [12.85, .08], [15.6, .02],
      [16.29, .055], [22.3, .04], [25.42, .15], [26.5, .08],
      [28.3, .21], [29.1, .19], [32.2, .08], [33.4, .21], [35.9, .23],
      [37.7, .06], [42.8, .035], [44.2, .06], [46.5, .17], [48.8, .04],
      [51.44, .08], [53.5, .045], [55.4, .085], [57.3, .19], [58.15, .08],
      [59.1, .04], [60, .12],
    ]),
  },
} satisfies typeof base;
