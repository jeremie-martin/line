/** The loved approved ride, with the hook given a visible period.
 * The verse, the hats, the break with its five even notes and the full groove are as approved, strengths included.
 * In the hook all three new readings found the same gesture, and their rides show it: the words skim
 * low and close together, and the rider vaults the hole at the end of each line to come down on the bass.
 * Its own: the vault is one stroke recurring every two bars, from the first stroke of the hook to the last line,
 * always the same height, so the hook reads as a juggler's beat; between the vaults the rider stays low.
 * From Opus and Astra: the held note near the end is one slow high lob, landing softly, and the last
 * stroke is thrown once more into the cut. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const ends = base.contacts.map((c) => c.t);
/** The landing that ends the gap containing t (s), or undefined after the last landing. */
const endOf = (t: number) => ends.find((e) => e >= t);
const near = (end: number | undefined, at: number) => end !== undefined && Math.abs(end - at) < 0.01;
/** The vaulted strokes: the hook's line ends, every two bars. */
const vault = (end: number | undefined) => [18.693, 21.886, 25.091, 28.283].some((v) => near(end, v));
const lob = (end: number | undefined) => near(end, 51.492) || near(end, 57.099);
const inHook = (t: number) => t > 18.2 && t <= 29.5;

const approvedAir = curve([[0, 0.58], [5.89, 0.54], [18.69, 0.59], [29.948, 0.79], [31.499, 0.79], [50.758, 0.66]]);

const spec: Spec = {...base,
  axes: {
    air: (t) => {
      const end = endOf(t);
      if (inHook(t)) return vault(end) ? 0.86 : 0.48;
      if (lob(end)) return 0.88;
      if (t > 29.5 && t < 29.948) return 0.6; // Out of the low hook toward the break.
      return approvedAir(t);
    },
    speed: curve([[0, 0.72], [5.89, 0.84], [18.69, 0.9], [29.948, 0.98], [31.499, 0.97], [50.11, 0.9], [50.758, 0.84],
      [51.91, 0.84], [57.262, 0.88]]),
  }};
export default spec;
