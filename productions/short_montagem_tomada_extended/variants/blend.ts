/**
 * The same road twice, the second time bigger (Opus, whose ride lands both drum entrances best). The song tells its
 * story two times, a verse, the quick voice, the drum, and the second time everything is taller, faster and heavier.
 * Into that road I put Astra's best gesture, which her ride shows clearly: at the end of each sung pair the rider
 * hangs on the long vowel, and again over the missing beat just before the first drum's second half. The first verse
 * starts low and soft and grows, as you asked, and its hangs are modest; the second verse hangs higher.
 * The quick voice before each drum keeps its light syllable-by-syllable touches as approved. The first drum runs
 * close to the line with modest hops, the break floats slow and high over the upper figure, and the return is the
 * fastest, highest running of the song.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const FIRST_DRUM = 8.616, BREAK = 22.6, SECOND_VERSE = 30.8, RETURN = 38.152;
const quickVoice = (t: number) => (t > 7.45 && t < 8.5) || (t > 37.0 && t < 38.0);

function strength(t: number, impact: number): number {
  if (t < 7.45) return impact * (.72 + .28 * t / 7.45);                  // the first verse grows
  if (t > FIRST_DRUM && t < BREAK && impact < .7) return impact * .88;   // the first drum holds back a little
  return impact;
}
const strikes = base.contacts.map(({t, impact = 0}): [number, number] => [t, Number(strength(t, impact).toFixed(3))]);
const times = strikes.map(([t]) => t);

/** The tallest arc a span of `dt` seconds allows, on the 60 px scale. */
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);
function height(t: number, dt: number): number {
  if (quickVoice(t)) return .05 * fullArc(dt);
  if (t < 7.45) return dt > .85 ? .30 : .3 * fullArc(dt);              // the first verse: modest hangs
  if (t > 15.5 && t < 16.01) return .36;                                 // the missing beat
  if (t <= BREAK) return (dt >= .4 ? .45 : .15) * fullArc(dt);
  if (t < SECOND_VERSE) return .9 * fullArc(dt);                         // the break floats
  if (t < RETURN - .01) return dt > .85 ? .42 : .5 * fullArc(dt);      // the second verse: higher hangs
  return (dt >= .4 ? 1 : .3) * fullArc(dt);                              // the return: the tallest arcs
}
const amplitude = (t: number): number => {
  const i = times.findIndex(ct => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  return height(times[k], times[k] - (k > 0 ? times[k - 1] : 0));
};

const spec: Spec = {
  ...base,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([
      [0,.46],[3.6,.50],[4.45,.76],[5.2,.52],[5.853,.54],[6.3,.78],[6.77,.60],[7.45,.50],[8.45,.50],[FIRST_DRUM,.54],
      [15.164,.56],[15.58,.78],[16.0,.56],[22.4,.54],[23.15,.78],[30.5,.78],[SECOND_VERSE,.60],
      [33.542,.62],[34.0,.86],[34.483,.62],[35.388,.62],[35.85,.86],[36.311,.62],[36.9,.62],[37.0,.52],[38.0,.52],
      [RETURN,.70],[52.6,.70],[52.92,.62],[53.773,.60],
    ]),
    speed: curve([
      [0,.44],[6.77,.66],[7.45,.74],[8.45,.80],[FIRST_DRUM,.80],[22.4,.82],[23.15,.62],[30.5,.60],[SECOND_VERSE,.66],
      [36.9,.78],[38.0,.90],[RETURN,.98],[52.6,.98],[52.92,.86],[53.773,.78],
    ]),
    amplitude,
  },
};
export default spec;
