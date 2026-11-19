/** Bookended by soft hills. Under the solo words the rider rolls over low, slow swells, one per brush; the four
 * gathering beats are a staircase, each arc higher than the last, so the drop at 10.4 lands from the top step. In the
 * hook the beat and its answer part ways: the kick on the beat lands full, the short answer between beats only grazes
 * the line, so the hook reads as a clean tick-tock instead of a row of equal strokes. The reset climbs a second
 * staircase into the run, which rides higher than the hook with a lift into each bar's first kick. Under the closing
 * voice the hills come back, growing as the rider slows to the cut. The approved reading made the answers nearly as
 * firm as the beats; most visible in the hook (10.4–24.4 s) and the two staircases.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {keyframes} from '../../../scripts/v0/core/curves.ts';
import base, {overlayMeta} from './approved.ts';
export {overlayMeta};

// On the beat grid of the hook and run (one beat = 0.87 s from the drop), a stroke is either a beat or its answer.
const beatAt = (t: number, from: number) => Math.abs(((t - from) / .8696) - Math.round((t - from) / .8696)) < .2;

// time: [strength, height]. The steps keep the approved order of their weights, each a little lighter as it climbs.
const stairs: Record<number, [number, number]> = {
  6.97: [.6, .3], 7.83: [.55, .42], 8.70: [.52, .54], 9.619: [.48, .66], 10.43: [1, .94],
  24.35: [.68, .3], 25.22: [.5, .42], 26.09: [.48, .54], 26.95: [.46, .66], 27.83: [1, .8],
};

function strength(t: number, v: number): number {
  if (stairs[t]) return stairs[t][0];
  if (t < 6.9) return .02;                                    // the brushes
  if (t < 41.7) {
    const from = t < 24.35 ? 10.43 : 27.83;
    return beatAt(t, from) ? Math.max(.72, v) : .3;           // beat full, answer grazes
  }
  if (t < 41.8) return .58;
  return .03;
}

const times = base.contacts.map((c) => c.t);
function height(t: number): number | undefined {
  const end = times.find((x) => x >= t) ?? times[times.length - 1];
  if (stairs[end]) return stairs[end][1];
  if (end < 6.9) return .22;                                  // the opening swells
  if (end > 41.7) return .16 + .2 * Math.min(1, (end - 41.74) / 5.3);   // the closing hills grow
  const from = end < 24.35 ? 10.43 : 27.83;
  const prev = times[times.indexOf(end) - 1];
  if (end - prev > .7) return end < 24.35 ? .4 : .56;         // the bar's first kick, after a full beat of air
  return beatAt(end, from) ? .1 : .03;
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact}) => ({t, impact: strength(t, impact ?? 0)})),
  axes: {
    amplitude: height,
    air: keyframes([
      {t: 0, v: .5, ease: 'smooth'}, {t: 6.9, v: .56, ease: 'easeIn'}, {t: 10.43, v: .78, ease: 'smooth'},
      {t: 11.3, v: .62, ease: 'smooth'}, {t: 23.5, v: .62, ease: 'smooth'}, {t: 24.35, v: .66, ease: 'smooth'},
      {t: 27.83, v: .8, ease: 'smooth'}, {t: 28.7, v: .72, ease: 'smooth'}, {t: 41, v: .72, ease: 'smooth'},
      {t: 42.7, v: .74, ease: 'smooth'}, {t: 48, v: .7},
    ]),
    speed: keyframes([
      {t: 0, v: .3, ease: 'smooth'}, {t: 6.9, v: .4, ease: 'easeIn'}, {t: 9.619, v: .7, ease: 'easeIn'},
      {t: 10.43, v: .86, ease: 'smooth'}, {t: 23.5, v: .8, ease: 'smooth'}, {t: 24.35, v: .55, ease: 'smooth'},
      {t: 26.95, v: .74, ease: 'easeIn'}, {t: 27.83, v: .9, ease: 'smooth'}, {t: 41, v: .78, ease: 'smooth'},
      {t: 42.7, v: .6, ease: 'smooth'}, {t: 48, v: .42},
    ]),
  },
};
export default spec;
