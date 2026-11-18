/** The cut is already inside the stomp. Carry its light tom pair into the pickup and downbeat,
 * then let the three guitar answers speak in the stop. The triplets at 10.15–12.99 belong to
 * one breath of voice. Repeated little catches there should feel like diction, with only a few stresses.
 * The last snare leaves a whole beat empty. Cross it to two isolated bass hits and land “Pain!”
 * on the next downbeat. Leave the pickup before that word in the air so it gets a full arrival.
 * Across the chorus the quarter beats carry the chant. Its upbeat syllables and the second drummer's
 * fills enter the spaces between them. The late snares at 35.13 and 44.74 cut across the chant.
 * How much of the late fill can be felt beneath the voice is the open question.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import {duration, music, strikes} from './music.ts';
export {overlayMeta} from './music.ts';

const spec: Spec = {
  duration, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,0.48], [5.36,0.52], [10.15,0.4], [12.99,0.44], [19.76,0.52], [20.76,0.76], [21.72,0.85], [22.65,0.89], [23.60,0.54], [35.13,0.61], [44.74,0.64]]),
    speed: curve([[0,0.69], [5.36,0.75], [10.15,0.88], [13.53,0.77], [19.76,0.69], [21.72,0.86], [22.65,0.9], [36.05,0.94]]),
  },
};
export default spec;
