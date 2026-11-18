/**
 * Let the first three calls leave three rising arcs across the rests, then keep the quick words close to the track.
 * The first full kick cuts through that low rush. The words in its wake get a lighter touch.
 * The beat moves in waves, opening up around the paired kicks and the long downbeats at 23 and 32 seconds.
 * The repeating hook runs lower and faster until one last lift into the kick, then the bare words let the ride settle.
 */
import base from '../spec.ts';
import { curve } from '../../../scripts/v0/core/measured.ts';

export { overlayMeta } from '../spec.ts';

const contrast = curve([
  [0, 1.65], [5.4, 1.35], [11.4, 1.13], [15.631, 1.4],
  [16, 1.5], [34.38, 1.5], [46, 1.65], [51.479, 1.55],
]);

export default {
  ...base,
  contacts: base.contacts.map(({ t, impact = 0 }) => ({ t, impact: impact ** contrast(t)! })),
  axes: {
    air: curve([
      [0, .50], [1.1, .58], [1.8, .88], [2.8, .55], [3.95, .93], [4.9, .56],
      [5.65, .66], [6.6, .37], [8.8, .58], [10.05, .29], [11.4, .35], [14.9, .24],
      [15.65, .31], [16.35, .57], [17.6, .43], [19.4, .73], [20.4, .43],
      [22.5, .57], [23.25, .79], [24.6, .68], [26.35, .43], [28.3, .74],
      [29.5, .43], [31.9, .77], [33.3, .62], [34.5, .39], [37.05, .64],
      [37.9, .40], [40.8, .69], [42.1, .55], [43.3, .36], [45.7, .54],
      [46.7, .39], [49.5, .75], [50.3, .53], [51.479, .27],
    ]),
    speed: curve([
      [0, .37], [4.5, .45], [6.5, .59], [8.7, .67], [11.4, .77], [13.4, .89],
      [15.77, 1], [16.8, .88], [19.6, .94], [20.75, .80], [23.45, .97],
      [25.1, .79], [28.9, .94], [30, .79], [32.3, .97], [34.4, .89],
      [36.7, .99], [38.2, .92], [40.94, 1], [42.3, .90], [45.8, .99],
      [47.5, .88], [49.7, .98], [51.479, .48],
    ]),
    amplitude: curve([
      [0, .015], [1.7, .18], [2.65, .05], [3.95, .33], [4.85, .07], [5.65, .11],
      [7.95, .07], [9.15, .14], [10.3, .045], [12.51, .035], [15.77, .01],
      [16.87, .07], [19.6, .16], [20.7, .04], [23.4, .19], [25.6, .035],
      [28.35, .15], [30, .035], [32.15, .19], [34.6, .035], [37.1, .09],
      [38.8, .025], [40.7, .1], [43.1, .02], [45.85, .065], [47.5, .03],
      [49.6, .15], [51.479, .025],
    ]),
  },
} satisfies typeof base;
