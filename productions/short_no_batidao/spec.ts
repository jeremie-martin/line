/** Two singers float, the bass runs, and every big entrance arrives at full pace.
 * The upper singer at the start is light and slow, long in the air, as all three new readings had it, on the
 * approved catches made a little softer (Astra). The drums bring the rider down; the climb stays low and fast and
 * keeps all its lift for one high arc into the bright stab, the arc that came out highest in Sol's ride.
 * Under the bass it runs close to the line on the approved strengths, rising only where the hook leaves its two
 * longest breaths (Sol). The lower singer floats again, slower and rounder, as the new readings had it.
 * My own part: that float gathers pace over its last bar, so the full drums at 34.8 land with the weight the approved
 * ride gave them and the new readings lost; the approved handoff keeps its strong stroke, and the last two drum
 * steps lift away into the loop.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import base from './variants/approved.ts';
export {overlayMeta} from './variants/approved.ts';

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({t, impact: t < 4.774 ? +(impact * .85).toFixed(3) : impact})),
  axes: {
    air: curve([
      [0, .72], [4.19, .70], [5.24, .52], [7.79, .50], [8.47, .45], [11.12, .44], [11.47, .86], [12.16, .88],
      [12.62, .70], [12.98, .46], [13.78, .44], [14.12, .62], [14.82, .46], [21.17, .46], [21.62, .62], [22.21, .48], [26.25, .46],
      [27.40, .66], [28.37, .72], [32.52, .72], [33.40, .68], [34.78, .68], [36.16, .54], [41.24, .58],
      [42.16, .64], [42.63, .64], [43.09, .70], [43.988, .72],
    ]),
    speed: curve([
      [0, .45], [3.16, .48], [4.77, .60], [7.55, .78], [8.47, .88], [11.12, .90], [12.16, .87], [12.98, .92],
      [25.90, .88], [26.94, .76], [28.37, .62], [31.59, .62], [32.93, .80], [33.86, .87], [34.78, .88], [41.47, .92],
      [42.16, .90], [43.09, .86], [43.988, .82],
    ]),
  },
};
export default spec;
