/** A high pickup is still in the air when the first kick opens the short. Give that entrance room;
 * then play the unequal kick pairs, snare and small bass replies under the upper voice. At 11.53
 * a much lower, more articulated line enters. Follow the stress and releases of its phrases,
 * borrowing the kicks they lean on and letting intervening hats and snares pass. The rushed
 * consonants at 17.67 and 30.59 each get a short run; the longer C-sharps have room to travel.
 * The small drum roll lifts back to the high register at 41.88. Keep its high notes light even
 * over the renewed groove, and play the last kick and snare. Pitch marks support this change of
 * register; the identity of a voice on the unpitched syllables is uncertain.
 * I prefer this reading for the low singer's changing speech rhythm. The march variant follows
 * the uneven kick pairs and answering snares across that same verse.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import {duration, music, strikes} from './music.ts';
export {overlayMeta} from './music.ts';

const spec: Spec = {
  duration, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,0.73], [1.15,0.69], [10.55,0.64], [12.25,0.44], [17.19,0.4], [19.28,0.56], [25.59,0.49], [30.59,0.37], [32.87,0.53], [40.9,0.49], [41.88,0.66], [43.5,0.73], [52.16,0.68]]),
    speed: curve([[0,0.61], [1.15,0.85], [10.55,0.8], [12.25,0.7], [17.67,0.81], [21.87,0.73], [30.59,0.87], [32.87,0.72], [40.9,0.79], [42.52,0.89], [51.84,0.86]]),
  },
};
export default spec;
