/** Slowed, the centre of the song is a swing, and the rest is the approved ride he loved.
 * The two sung sentences at the start and their two low strokes are the approved reading.
 * In the centre each measure has two long breaths, and the rider uses them as Opus did: a high, round arc into every
 * strong syllable, then quick low steps through the answer and its small neighbours, the strokes in three clear weights.
 * The exposed words float (Opus) before the shared word and drum at 28.9; the broken drums keep the approved even run
 * and strengths, which held their heavy bar heads best of the four.
 * My own part: the swing's last echo, one rise as the upper reply lifts clear at the very end.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';
export {overlayMeta} from '../spec.ts';

// The centre in three weights (Opus): the strong syllable, its answer, the small neighbours.
function strength(t: number, v: number): number {
  if (t < 12.3 || t > 26.8) return v;
  if (t < 12.4) return .95;
  return v >= .6 ? .70 : v >= .45 ? .40 : .14;
}

// The long breath before each strong syllable of the centre (Opus).
const lofts = [13.903, 15.982, 18.054, 20.121, 22.187, 24.265, 26.332];
const halfLofts = [14.942, 17.003, 19.081, 21.154, 23.22, 25.293];
const times = base.contacts.map((c) => c.t);
const end = (t: number) => times.find((x) => x >= t) ?? times[times.length - 1];

const flow = {
  air: curve([[0, .47], [6.12, .64], [12.34, .64], [26.6, .66], [27.1, .76], [28.7, .72], [29.32, .56], [44.47, .53], [46.28, .55],
    [46.6, .80], [47.029, .80]]),
  speed: curve([[0, .66], [6.12, .73], [12.34, .76], [26.6, .76], [27.1, .80], [28.9, .88], [29.32, .89], [44.47, .77], [46.28, .66],
    [47.029, .60]]),
};

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({t, impact: strength(t, impact)})),
  axes: {
    air: flow.air,
    speed: flow.speed,
    amplitude: (t: number) => {
      if (t > 46.35) return .24;                     // the upper reply lifts clear
      if (t < 12.4 || t > 26.8) return undefined;
      const e = end(t);
      if (lofts.includes(e)) return .40;
      return halfLofts.includes(e) ? .14 : .04;
    },
  },
};
export default spec;
