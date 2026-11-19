/** The growth is drawn in speed, then in one long loping gait.
 * The low phrase and the quiet ticks keep the approved pace and strengths; through the build the arcs stay a little
 * taller than approved, as in Opus's reading. When the strokes double the rider comes down onto the line and gathers
 * speed, and holds it low and fast through the roll, as in Astra's, the roll that came out clearest.
 * The lone high note is the tallest arc of the song, and the return lands out of it.
 * The replies are the same two-bar gait each time: a tall arc through each long breath, a smaller one through the
 * medium, as Opus sized them; my own part is the rush between, where the drum and bass answer close together and the
 * rider runs low and quick (after Astra), so each bar is a float and a dash. The approved strengths stay as they were.
 * The five closing strokes shrink and slow to rest.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {keyframes} from '../../../scripts/v0/core/curves.ts';
import base from '../spec.ts';
export {overlayMeta} from '../spec.ts';

const times = base.contacts.map((c) => c.t);
const gapAt = (t: number) => {
  const i = times.findIndex((x) => x >= t);
  return {gap: i <= 0 ? 0 : times[i] - times[i - 1]};
};
const inReplies = (t: number) => t > 22.45 && t <= 56.483;

const flow = {
  air: keyframes([
    {t: 0, v: .55, ease: 'smooth'}, {t: 1.3, v: .62, ease: 'smooth'}, {t: 11.4, v: .58, ease: 'smooth'},
    {t: 16.9, v: .52, ease: 'smooth'}, {t: 19.67, v: .28, ease: 'smooth'}, {t: 20.88, v: .25, ease: 'smooth'},
    {t: 21.05, v: .95, ease: 'smooth'}, {t: 22.4, v: .95, ease: 'smooth'}, {t: 22.6, v: .66, ease: 'smooth'},
    {t: 56.5, v: .62, ease: 'smooth'}, {t: 58, v: .5, ease: 'smooth'}, {t: 60, v: .34},
  ]),
  speed: keyframes([
    {t: 0, v: .4, ease: 'smooth'}, {t: 1.3, v: .34, ease: 'smooth'}, {t: 11.4, v: .48, ease: 'smooth'},
    {t: 16.9, v: .64, ease: 'smooth'}, {t: 19.67, v: .92, ease: 'smooth'}, {t: 20.88, v: .92, ease: 'smooth'},
    {t: 21.45, v: .48, ease: 'smooth'}, {t: 22.4, v: .64, ease: 'smooth'}, {t: 22.6, v: .74, ease: 'smooth'},
    {t: 55.3, v: .76, ease: 'smooth'}, {t: 56.5, v: .5, ease: 'smooth'}, {t: 60, v: .26},
  ]),
};

const spec: Spec = {
  ...base,
  axes: {
    air: (t: number) => {
      if (!inReplies(t)) return flow.air(t);
      const {gap} = gapAt(t);
      return gap > .9 ? .78 : gap > .55 ? .66 : .55;          // float, step, dash
    },
    speed: (t: number) => {
      if (!inReplies(t)) return flow.speed(t);
      const {gap} = gapAt(t);
      return gap > .9 ? .68 : gap > .55 ? .76 : .82;
    },
  },
};
export default spec;
