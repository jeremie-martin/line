/** Follow the singer already in flight at the cut. The F4 at .65 hangs; the repeated G-sharps have
 * separate attacks and the A-sharp lifts out of them. Let the voice lead across the first drum strokes.
 * The drum climb breaks off before a bright stab at 12.164. Land it separately from the first low
 * beat at 12.622. Across the body follow the syncopations above that beat, leaving their faint shoulders
 * and the bass pumping under them alone. At 26.94 the lower singer takes the bar away from the hook.
 * Keep the sparse drum answers, then carry the words into the full return. Four closely spaced strokes
 * turn it over to drums alone at the end. The small articulations around 1–2 s are my least certain
 * choice; their timing comes from the vocal attacks even where the pitch detector is silent.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import {duration, music, strikes} from '../music.ts';
export {overlayMeta} from '../music.ts';

const spec: Spec = {
  duration, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,0.47], [4.78,0.48], [7.79,0.54], [11.47,0.69], [12.16,0.74], [14.47,0.58], [26.71,0.48], [29.24,0.57], [34.78,0.68], [41.24,0.43], [42.16,0.65]]),
    speed: curve([[0,0.66], [4.78,0.72], [10.78,0.84], [12.62,0.89], [26.94,0.75], [34.78,0.87], [41.47,0.93], [42.16,0.88]]),
  },
};
export default spec;
