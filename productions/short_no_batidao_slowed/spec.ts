/** Slowed down, the low pulse is a heavy ball, and the song is the story of how it gets rolling again.
 * The bare drummer and his words keep the approved quick, even stride; the bright signal is one high float.
 * From the first bass catch the rider bounces once per beat in round, unhurried arcs, every landing one of two
 * weights so the two big kicks stand out of the gait: Opus's idea, the cleanest ride of the four here.
 * The lower singer lets it drift lower and flatter, softer than the ball, as Opus and Sol had it.
 * My own part: over the singer's last bar the rider gathers speed again, so the return at 31.4 lands with the
 * weight the slowed readings lost there; from it on, the approved fast, low run with its own strengths and roll,
 * which held the returning drums best of the four.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import base from './variants/approved.ts';
export {overlayMeta} from './variants/approved.ts';

// The pulse in two weights (Opus): the two big kicks on top, beats that rise in the mix, and the rest.
function strength(t: number, v: number): number {
  if (t < 5.3 || t > 22.3) return v;
  if (t > 13.9 && t < 14) return .16;                 // the pickup leaves room for the kick after it
  return v >= .9 ? .97 : v >= .74 ? .66 : .54;
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({t, impact: strength(t, impact)})),
  axes: {
    air: curve([
      [0, .64], [4.27, .64], [4.79, .80], [5.34, .82], [21.9, .80], [22.6, .58], [28.65, .60], [29.95, .54],
      [30.91, .50], [31.42, .56], [39.9, .56], [40.04, .34], [40.59, .32], [40.783, .36],
    ]),
    speed: curve([
      [0, .94], [4.27, .93], [4.79, .72], [5.34, .53], [21.9, .54], [22.6, .62], [29.26, .64], [30.34, .80],
      [31.17, .90], [31.42, .94], [39.9, .94], [40.04, .72], [40.59, .86], [40.783, .90],
    ]),
  },
};
export default spec;
