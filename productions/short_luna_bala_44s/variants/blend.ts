/**
 * One bow per bar. The solo voice is slower and lower than approved, with touches lighter still, and the rider
 * hangs once, high, in the breath between the singer's two sentences (Astra, whose ride holds that breath best).
 * Under the five upper strokes every bar draws the same bow: the rider rises into the long fourth stroke and comes
 * down through the short fifth onto the downbeat (Astra's bow), at the approved reading's full pace rather than
 * Astra's slower one. The uncovered drums and the bass entrance after them are the approved ones: their ride lands
 * that entrance hardest. The bass runs level and fast as approved. When the bass withdraws under the refrain the bow
 * returns, wider, and the touches between the downbeats turn lighter while the downbeats keep their weight (Opus).
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const REFRAIN = 34.7;
function strength(t: number, impact: number): number {
  if (t < 8.6) return impact * .75;                                  // the solo voice: lighter still
  if (t > REFRAIN && t < 43.5 && impact < .7) return impact * .8;    // the refrain's in-between touches
  return impact;
}

const contacts = base.contacts.map(({t, impact = 0}) => ({t, impact: Number(strength(t, impact).toFixed(3))}));

const bow = (bars: [down: number, fourth: number][], low: number, high: number) =>
  bars.flatMap(([d, f]): [number, number][] => [[d, low], [f, high]]);

const spec: Spec = {
  ...base,
  contacts,
  axes: {
    air: curve([
      [0,.42],[2.85,.40],[3.48,.56],[3.75,.90],[4.25,.90],[4.66,.44],[5.93,.50],[7.74,.42],
      ...bow([[8.615,9.985],[10.791,12.167],[12.974,14.344]], .50, .82),
      [15.157,.50],[16.521,.58],[17.334,.48],
      ...bow([[17.4,18.704],[19.516,20.881],[21.693,23.063]], .50, .82),
      [23.487,.70],[23.870,.76],[25.797,.76],[26.053,.68],[34.232,.66],
      ...bow([[34.778,36.148],[36.955,38.33],[39.137,40.513],[41.314,42.69]], .56, .84),
      [42.957,.80],[43.2,.36],[44,.32],
    ]),
    speed: curve([
      [0,.44],[3.48,.42],[4.50,.36],[5.93,.48],[7.52,.56],[8.069,.90],[8.615,.94],[23.487,.94],[23.870,.74],
      [25.507,.74],[25.797,.86],[26.053,.98],[34.5,.98],[34.9,.90],[42.957,.90],[43.2,.40],[44,.38],
    ]),
  },
};
export default spec;
