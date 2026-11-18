/** A loose step, from the ground up. The opening sentence is a low ripple: the rider hardly leaves the line and goes
 * slowly, each syllable a light touch, so that the three strokes he marked (7.2, 9.05, 10.9) are the first real weight
 * and kick it off the ground. The high answer rides in the air, the treble dance settles into a springy middle with
 * clear accents and small in-between notes, and the naked call floats on the barest touches, the most airborne
 * stretch of the song and the room before the drums return at 29.35 with the heaviest landing. From there it runs
 * low and fast, a firm beat with light pickups, and loosens as the drum figure frays. The approved reading rode the
 * opening at the height and pace of the rest, with near-equal weights; here the song climbs out of a quiet floor.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base, {overlayMeta} from '../spec.ts';
export {overlayMeta};

const tier = (v: number, steps: Array<[number, number]>) => (steps.find(([min]) => v >= min) ?? steps[steps.length - 1])[1];

// The strokes he cared about, and the big catches the approved reading built around them, in their order.
const marked: Record<number, number> = {7.202: .8, 9.048: .95, 10.894: .9, 12.74: .95, 14.58: .95, 29.348: 1};

function strength(t: number, v: number): number {
  if (marked[t] !== undefined) return marked[t];
  if (t < 6.7) return tier(v, [[.45, .3], [.38, .2], [.3, .13], [0, .08]]);           // the ripple
  if (t < 7) return .36;                                                              // the lead into 7.2
  if (t < 14.5) return tier(v, [[.75, .7], [.6, .5], [.5, .4], [.4, .26], [.2, .14], [0, .06]]);
  if (t < 27.5) return tier(v, [[.62, .62], [.52, .44], [.4, .26], [0, .12]]);        // the dance
  if (t < 29.3) return v * .75;                                                       // the naked call
  if (t < 45) return tier(v, [[.75, .82], [.6, .64], [.5, .48], [.4, .28], [0, .16]]);  // the run
  return tier(v, [[.5, .5], [.4, .36], [0, .2]]);                                     // fraying
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact}) => ({t, impact: strength(t, impact ?? 0)})),
  axes: {
    air: curve([
      [0, .34], [6.5, .36], [7.2, .52], [9.04, .64], [14.3, .64], [14.6, .52], [27, .52], [27.7, .78], [29.1, .74],
      [29.35, .5], [44.8, .46], [46.5, .6],
    ]),
    speed: curve([
      [0, .5], [6.5, .52], [7.2, .66], [9.04, .72], [14.3, .72], [14.6, .8], [27, .78], [27.7, .78], [28.9, .84],
      [29.35, .9], [44.8, .94], [46.5, .72],
    ]),
    // Kept flat where the rider should hug the line: the ripple and the run. Elsewhere the height is free.
    amplitude: (t: number) => (t < 6.9 ? .03 : t > 29.4 && t < 45 ? .05 : undefined),
  },
};
export default spec;
