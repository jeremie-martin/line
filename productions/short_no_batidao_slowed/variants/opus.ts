/** Slowed down, the low pulse becomes a heavy ball: once the bright signal has rung out, the rider bounces once per
 * beat in round, unhurried arcs, slower than before, each landing an even weight so that the two big kicks (5.3 s and
 * 14.2 s) stand out of the gait instead of being two among many. Before it, the bare drummer and words skitter low
 * and quick, hard drum and feather word in turn. The lower singer then lets it drift, flatter and softer, until the
 * return at 31.4 slams down and the rest runs low and driving, strong and light strokes alternating, into a roll
 * that climbs. The approved reading rode everything at one fast pace with landings of many similar weights; this one
 * gives each passage its own gait. Most visible in the bouncing pulse (5–22 s) against the drift after it.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {keyframes} from '../../../scripts/v0/core/curves.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base, {overlayMeta} from './approved.ts';
export {overlayMeta};

const levels = (v: number, steps: Array<[number, number]>) => (steps.find(([min]) => v >= min) ?? steps[steps.length - 1])[1];

function strength(t: number, v: number): number {
  if (t < 5) return levels(v, [[.79, .74], [.7, .66], [.2, .2], [0, .06]]);     // drum against word
  if (t < 22.3) {                                                                  // the bouncing pulse
    if (t > 13.9 && t < 14) return .16;                                            // the pickup leaves room
    return levels(v, [[.9, .97], [.74, .66], [0, .54]]);
  }
  if (t < 31.3) return levels(v, [[.8, .64], [.7, .52], [.5, .36], [.4, .24], [0, .1]]);   // the singer drifts
  if (t < 31.5) return 1;                                                          // the return
  if (t < 40) return levels(v, [[.85, .86], [.7, .7], [.6, .56], [.4, .3], [0, .14]]);
  return [.2, .26, .32, .52][[40.038, 40.177, 40.317, 40.589].indexOf(t)];        // the roll climbs
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact}) => ({t, impact: strength(t, impact ?? 0)})),
  axes: {
    air: curve([[0, .5], [4.3, .52], [4.79, .8], [5.34, .82], [21.9, .8], [22.6, .62], [30.9, .64], [31.42, .5], [39.9, .48], [40.3, .4], [40.78, .4]]),
    speed: curve([[0, .9], [4.3, .88], [4.79, .7], [5.34, .52], [21.9, .54], [22.6, .62], [30.9, .66], [31.42, .94], [39.9, .94], [40.78, .9]]),
    amplitude: keyframes([
      {t: 0, v: .05, ease: 'hold'}, {t: 4.3, v: .3, ease: 'hold'}, {t: 4.8, v: .36, ease: 'hold'},
      {t: 22.3, v: .22, ease: 'hold'}, {t: 31.2, v: .3, ease: 'hold'}, {t: 31.43, v: .06, ease: 'hold'},
    ]),
  },
};
export default spec;
