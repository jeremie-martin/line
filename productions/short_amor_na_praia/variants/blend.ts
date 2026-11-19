/** The approved reading is the shore; the bass answers are the tide coming in.
 * Up to the quick words it is the approved ride: the light opening taps, the dry drums, the kicks.
 * The quick words keep their pace right into the big stroke at 31.5 (no slowing before it), so the
 * last hit of the hook and the first bass answer land as one breaking wave.
 * Then, as in Astra, the rider hangs back: slower, longer in the air, and, as in Opus, it rises
 * over each long step of the bass and stays low on the short ones. The reprise returns to the approved ride.
 * From Opus also the lighter fills under the quick words and the softer weak tails of the bass,
 * so that the downbeats stand clear. The closing vowel is the approved easy coast. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const contacts = base.contacts.map(({t, impact = 0}) => {
  if (t > 21.8 && t < 31.5 && impact < 0.7) return {t, impact: +(impact * 0.85).toFixed(3)};
  if (t > 32.2 && t < 41.8 && impact < 0.4) return {t, impact: +(impact * 0.85).toFixed(3)};
  return {t, impact};
});
const ends = contacts.map((c) => c.t);
/** Length (s) of the gap that contains t, or 0 before the first landing / after the last. */
const gapLen = (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  return i > 0 ? ends[i] - ends[i - 1] : 0;
};

const airLevel = curve([[0,.47],[2.231,.48],[4.675,.69],[6.811,.53],[7.978,.70],[9.557,.52],[10.788,.64],[11.519,.48],
  [11.995,.66],[16.372,.48],[21.26,.64],[21.759,.46],[30.548,.58],[31.517,.60],[32.127,.74],[41.275,.74],[41.891,.44],
  [48.892,.65],[50.54,.40],[52.351,.32]]);

const spec: Spec = {...base, contacts,
  axes: {
    air: (t) => {
      const l = airLevel(t)!;
      if (t <= 32.13 || t >= 41.28) return l;
      return gapLen(t) > 0.5 ? Math.min(0.88, l + 0.08) : l - 0.06;
    },
    speed: curve([[0,.42],[2.231,.76],[4.675,.87],[7.978,.84],[8.646,.52],[9.557,.91],[10.474,.99],[11.995,.89],
      [17.487,.82],[21.759,.93],[30.548,.94],[31.517,.92],[32.127,.82],[33.4,.66],[40.0,.66],[41.275,.76],
      [41.891,.84],[49.681,.91],[50.54,.82],[51.051,.46],[52.351,.31]]),
    amplitude: (t) => {
      if (t > 32.13 && t < 41.28) return gapLen(t) > 0.5 ? 0.38 : 0.06;
      return undefined;
    },
  }};
export default spec;
