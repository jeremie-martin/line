/** The growth is told in height. Through the quiet ticks the rider skims almost flat and slow; with every stroke of
 * the twenty-second build the arcs open a little taller and the touches a little firmer, growing slowly at first
 * and then faster, until the roll pulls it down onto the line at full speed. The lone high note becomes the highest
 * arc of the song, and the return lands out of it. The long reply section then rides as big loping bounds: a tall arc
 * through each long breath, a medium one, and quick flat steps where the drum and bass answer close together, the
 * same two-bar gait each time, swelling a little as the voices join, then shrinking and slowing through the five
 * closing strokes. The approved reading kept one height throughout; here the shape of the song is drawn in the air.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {keyframes} from '../../../scripts/v0/core/curves.ts';
import base, {overlayMeta} from '../spec.ts';
export {overlayMeta};

// The build keeps its strictly rising order; it starts quieter and gathers faster (0 at the first tick, 1 at the roll).
const grow = (t: number) => Math.max(0, Math.min(1, (t - 1.96) / (19.67 - 1.96)));

function strength(t: number, v: number): number {
  if (t < 1.9) return v;                                    // low phrase
  if (t < 19.75) return .06 + .76 * grow(t) ** 1.6;          // ticks to build
  if (t < 21) return v;                                     // the roll, already rising .74 → .92
  if (t < 22.5) return 1;                                   // the return
  if (t < 56) return v > .5 ? (t < 39 ? .74 : .8) : .36;    // bar opener soft, answering drum firm; louder after 39 s
  return v;                                                 // the five closing strokes
}

const times = base.contacts.map((c) => c.t);

// Height per gap: in the build it grows with the music; in the replies it follows the length of each breath.
function height(t: number): number | undefined {
  const i = times.findIndex((x) => x >= t);
  if (i <= 0) return undefined;
  const gap = times[i] - times[i - 1];
  const end = times[i];
  if (end < 1.9) return undefined;
  if (end < 19.75) return gap > .5 ? .05 + .45 * grow(end) : .08;
  if (end < 21) return .03;                                 // the roll hugs the line
  if (end < 22.5) return 1;                                 // the lone high note
  const swell = end < 56 ? .8 + .2 * Math.min(1, (end - 22.4) / 22) : Math.max(.3, 1 - (end - 56) / 4);
  const size = gap > 1.2 ? .72 : gap > .9 ? .5 : gap > .55 ? .26 : .05;
  return size * swell;
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact}) => ({t, impact: strength(t, impact ?? 0)})),
  axes: {
    air: keyframes([
      {t: 0, v: .55, ease: 'smooth'}, {t: 1.3, v: .56, ease: 'smooth'}, {t: 11.4, v: .64, ease: 'smooth'},
      {t: 17, v: .58, ease: 'smooth'}, {t: 19.7, v: .32, ease: 'smooth'}, {t: 20.9, v: .24, ease: 'smooth'},
      {t: 21.6, v: .94, ease: 'smooth'}, {t: 22.4, v: .72, ease: 'smooth'}, {t: 55.3, v: .72, ease: 'smooth'},
      {t: 57, v: .6, ease: 'smooth'}, {t: 60, v: .4},
    ]),
    speed: keyframes([
      {t: 0, v: .4, ease: 'smooth'}, {t: 1.3, v: .3, ease: 'smooth'}, {t: 11.4, v: .42, ease: 'smooth'},
      {t: 17, v: .62, ease: 'smooth'}, {t: 19.7, v: .84, ease: 'smooth'}, {t: 20.9, v: .95, ease: 'smooth'},
      {t: 21.6, v: .5, ease: 'smooth'}, {t: 22.4, v: .7, ease: 'smooth'}, {t: 55.3, v: .72, ease: 'smooth'},
      {t: 57, v: .48, ease: 'smooth'}, {t: 60, v: .28},
    ]),
    amplitude: height,
  },
};
export default spec;
