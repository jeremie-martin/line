/** The singer alone at the start is weightless: the rider floats slowly in high arcs, every catch a whisper.
 * When the drums arrive it comes down to earth, and the climb lifts each arc a little higher than the last,
 * until the long breath before the stab throws it into the biggest loft of the song. From the stab on, with
 * the bass under it, it runs low and fast, close to the line, and the body's strokes fall into a few clear
 * weights instead of many near-equal ones. The lower singer lifts it off the ground again, slower and rounder,
 * before the full drums send it flat and fast to the last four strokes. The approved reading rode the whole
 * song at much the same height and pace; here the two singers float and the bass runs. Most visible at the
 * stab (12.2 s) and when the lower voice takes over (26.9 s).
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {keyframes} from '../../../scripts/v0/core/curves.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import {duration, music, strikes} from '../music.ts';
export {overlayMeta} from '../music.ts';

// Each passage keeps the approved order of its strokes, grouped into a few weights.
const step = (v: number, levels: Array<[number, number]>) => (levels.find(([min]) => v >= min) ?? levels[levels.length - 1])[1];
const climb: Record<number, number> = {
  8.007: .34, 8.472: .40, 8.930: .48, 9.395: .48, 9.853: .48, 10.318: .44, 10.776: .70, 11.124: .30, 11.473: .16,
};
const handoff: Record<number, number> = {41.473: .28, 41.705: .40, 41.931: .56, 42.164: .95, 42.628: .40, 43.087: .58, 43.551: .52};

function strength(t: number, v: number): number {
  if (t < 4.7) return step(v, [[.3, .2], [.13, .1], [0, .04]]);            // the singer alone
  if (t < 8) return step(v, [[.75, .72], [.6, .58], [.44, .42], [0, .24]]); // the drums join
  if (t < 12) return climb[t];
  if (t < 12.7) return t < 12.3 ? 1 : .85;                                  // stab, first low beat
  if (t < 26.9) return step(v, [[.9, .95], [.68, .70], [.5, .46], [.36, .28], [0, .12]]);
  if (t < 34.7) return step(v, [[.8, .78], [.6, .56], [.45, .34], [0, .13]]); // the lower singer
  if (t < 41.4) return step(v, [[.9, .95], [.6, .68], [.45, .42], [0, .2]]);
  return handoff[t];
}

const contacts = strikes.map(([t, v]) => ({t, impact: strength(t, v)}));

const spec: Spec = {
  duration, preroll: 2, music, contacts,
  axes: {
    air: curve([
      [0, .76], [4.4, .74], [5.2, .56], [7.8, .58], [10.8, .74], [11.5, .9], [12.16, .86], [12.7, .42],
      [26.4, .40], [27.4, .66], [34.3, .64], [35.0, .46], [41.2, .46], [42.2, .6], [44, .6],
    ]),
    speed: curve([
      [0, .44], [4.4, .46], [5.2, .62], [8, .66], [11.5, .80], [12.4, .92], [26.4, .90], [27.4, .68],
      [34.3, .72], [35.0, .95], [41.2, .95], [44, .88],
    ]),
    amplitude: keyframes([
      {t: 0, v: .28, ease: 'smooth'}, {t: 4.4, v: .26, ease: 'smooth'}, {t: 5.2, v: .1, ease: 'linear'}, {t: 8, v: .14, ease: 'linear'},
      {t: 11.2, v: .4, ease: 'hold'}, {t: 11.5, v: .85, ease: 'hold'}, {t: 12.2, v: .06, ease: 'hold'},
      {t: 26.95, v: .3, ease: 'hold'}, {t: 34.8, v: .08, ease: 'hold'}, {t: 41.5, v: .14, ease: 'hold'},
    ]),
  },
};
export default spec;
