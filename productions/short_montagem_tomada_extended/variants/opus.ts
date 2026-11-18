/** The same road twice, the second time higher. The song tells its story two times: a verse, the quick voice, the
 * drum. The first time the rider holds back: the verse starts low and soft and grows, the first drum is ridden close to
 * the line with modest hops. In the break without drums it hangs, slow and high, over the upper figure. Then the second
 * verse and the second drum repeat the same motions, but everything is taller, faster and heavier, so the eye
 * recognises the road and feels the return as the bigger one: the arcs between low beats there are the tallest of the
 * song. The quick voice before each drum keeps its light, syllable-by-syllable touches.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const FIRST_DRUM = 8.616, BREAK = 22.6, SECOND_VERSE = 30.8, RETURN = 38.152;
const quickVoice = (t: number) => (t > 7.45 && t < 8.5) || (t > 37.0 && t < 38.0);

const strikes = base.contacts.map(({t, impact = 0}): [number, number] => {
  // The first verse starts lower and grows into the swell (his crescendo), keeping its pattern.
  if (t < 7.45) return [t, Number((impact * (.72 + .28 * t / 7.45)).toFixed(3))];
  // The first drum holds back a little: its plain strokes soften, its accents stay.
  if (t > FIRST_DRUM && t < BREAK && impact < .7) return [t, Number((impact * .88).toFixed(3))];
  return [t, impact];
});

const times = strikes.map(([t]) => t);
/** The tallest arc a span of `dt` seconds allows (a free flight from landing to landing), on the 60 px scale. */
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);
function share(t: number, dt: number): number {
  if (quickVoice(t)) return .05;
  if (t < 7.45) return .3;
  if (t <= BREAK) return dt >= .4 ? .45 : .15;           // first drum: modest
  if (t < SECOND_VERSE) return .9;                       // the break hangs
  if (t < RETURN - .01) return .5;                       // second verse: taller than the first
  return dt >= .4 ? 1 : .3;                              // the return: the tallest arcs
}
const amplitude = (t: number): number => {
  const i = times.findIndex((ct) => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const dt = times[k] - (k > 0 ? times[k - 1] : 0);
  return share(times[k], dt) * fullArc(dt);
};

const spec: Spec = {
  ...base,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([
      [0,.46],[6.77,.58],[7.45,.50],[8.45,.50],[FIRST_DRUM,.54],[22.4,.54],[23.15,.78],[30.5,.78],[SECOND_VERSE,.60],
      [36.9,.64],[37.0,.52],[38.0,.52],[RETURN,.70],[52.6,.70],[52.92,.62],[53.773,.60],
    ]),
    speed: curve([
      [0,.44],[6.77,.66],[7.45,.74],[8.45,.80],[FIRST_DRUM,.80],[22.4,.82],[23.15,.62],[30.5,.60],[SECOND_VERSE,.66],
      [36.9,.78],[38.0,.90],[RETURN,.98],[52.6,.98],[52.92,.86],[53.773,.78],
    ]),
    amplitude,
  },
};
export default spec;
