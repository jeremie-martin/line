/** Catch the clipped words first. From 1.12 s the upper figure counts six close strokes and a delayed seventh.
 * Keep all seven even when their spacing makes the middle strokes feel like a run. Its second half
 * loses weight before the bass swell. The voice briefly has the bar to itself at 15.67.
 * At the return, land the low entrance, the skipping upper replies and their emphatic last stroke.
 * Leave the little rebounds under those replies on the track. The hole around 26 s and the change
 * of cadence at 34.88 are real breaks in the upper pattern. The size of that last double is uncertain.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import {duration, music, strikes} from './music.ts';
export {overlayMeta} from './music.ts';

const spec: Spec = {
  duration, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,0.48], [1.12,0.57], [9.49,0.49], [15.39,0.58], [17.62,0.77], [18.28,0.61], [34.6,0.65]]),
    speed: curve([[0,0.72], [3.315,0.83], [9.49,0.79], [15.39,0.64], [17.62,0.71], [17.86,0.9], [35.15,0.85]]),
  },
};
export default spec;
