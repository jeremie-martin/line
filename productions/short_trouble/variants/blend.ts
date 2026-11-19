/** The verse limps, the chorus bounds, and the opening crash already shows the bound to come.
 * Under the words the rider glides level on the approved quiet catches, except in the three long silences, where the
 * crash lets go into one long bow each (Sol and Astra).
 * When the three stresses arrive it takes up their long-long-short lilt, two arcs and a skip, and once
 * the little drum strokes fill the spaces it runs flat beneath them, as Opus had it; every strength there, the little
 * strokes he marked included, is the approved one. The exposed E and G hang slow and high.
 * In the chorus each heavy release throws the rider into a tall bound through the gap after it, with the close
 * answering pairs taken low and quick (Opus, the chorus that kept its heavy kicks best). My own part: the rider
 * gathers speed up each of the two climbing triples, so they drive into their heavy kick rather than float.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';
export {overlayMeta} from '../spec.ts';

const times = base.contacts.map((c) => c.t);
const gapAt = (t: number) => {
  const i = times.findIndex((x) => x >= t);
  return {end: i <= 0 ? times[0] : times[i]};
};
const bows = [3.518, 5.793, 12.539];          // the long silences between the words

const flow = {
  air: curve([[0, .45], [12.539, .45], [14.7, .54], [18.3, .54], [18.6, .5], [27.5, .5], [27.9, .8], [28.8, .78], [29.03, .72],
    [43.7, .74], [44.65, .7]]),
  speed: curve([[0, .38], [12.539, .49], [14.7, .72], [27.5, .72], [27.9, .62], [28.8, .76], [29.03, .88], [33.9, .86], [34.18, .88],
    [35.08, .97], [35.6, .86], [41.1, .86], [41.34, .88], [42.243, .97], [42.6, .9], [43.781, .55]]),
};

const spec: Spec = {
  ...base,
  axes: {
    air: (t: number) => (bows.includes(gapAt(t).end) ? .72 : flow.air(t)),
    speed: flow.speed,
  },
};
export default spec;
