/**
 * Two halves, each with one figure per bar. In the long opening the rider swings with the upper figure: the two wide
 * strokes of every bar are two tall slow arcs and the six close ones a low ripple along the line (Opus, whose ride
 * shows this figure plainly, and an answer to your wish for something more than the same sounds for 17 seconds).
 * The swing changes with the voice: small and slow under the held call, wider when the figure is left alone at 6.2,
 * hushed under the returning voice, the figure there whispering a little more (Opus). The light runs of syllables
 * before each drum downstroke are ridden as approved, the second like the first as you asked.
 * In the drum half the figure turns into a surge: each downstroke lands low and the low rebounds push the rider up
 * through the bar, once per bar (Sol, at whose ride the first downstroke lands hardest; Astra had the same rise).
 * After the last kick the rider coasts out on the bright notes (Sol and Astra).
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import base from './variants/approved.ts';

export {overlayMeta} from './variants/approved.ts';

const DRUM = 20.093, RUN = 28.6, SECOND = 29.949, OPENING_END = 18.6;
const inRun = (t: number) => (t >= OPENING_END && t <= DRUM) || (t >= RUN && t <= SECOND);

const strikes = base.contacts.map(({t, impact = 0}): [number, number] =>
  [t, t > 8.97 && t < 14.5 && impact < .5 ? Number((impact * .8).toFixed(3)) : impact]);
const times = strikes.map(([t]) => t);
/** How wide the swing is in each part of the opening (Opus). */
const swing = (t: number): number => t < 6.23 ? .6 : t < 8.97 ? 1 : t < 14.5 ? .45 : .9;
function span(t: number): {end: number; dt: number} {
  const i = times.findIndex(ct => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  return {end: times[k], dt: times[k] - (k > 0 ? times[k - 1] : 0)};
}
const openingAir = (t: number): number => {
  const {end, dt} = span(t);
  const wide = .62 + .22 * swing(end);
  return dt >= .4 ? wide : wide - .2;
};

// The drum half: low on each downstroke, rising on the rebounds (Sol).
const surgeAir = curve([
  [DRUM, .44], [21.4, .50], [22.55, .69], [23.25, .48], [24.45, .60], [25.02, .72], [26.1, .49], [27.49, .72],
  [28.18, .53], [SECOND, .46], [30.9, .49], [32.41, .69], [33.34, .49], [34.87, .73], [35.81, .48], [37.34, .75],
  [38.3, .52], [39.81, .48], [40.52, .73], [41.361, .72],
]);
const surgeSpeed = curve([
  [DRUM, .88], [22.55, .80], [23.48, .87], [25.02, .81], [26.26, .90], [27.49, .82], [28.4, .88],
  [SECOND, .92], [30.41, .93], [32.41, .83], [33.64, .92], [34.87, .84], [36.11, .94], [37.34, .85], [38.58, .91],
  [39.81, .86], [41.361, .49],
]);
const openingSpeed = curve([[0,.40],[6.0,.46],[6.23,.62],[8.8,.66],[8.97,.52],[14.3,.54],[17.6,.68],[OPENING_END,.74]]);

const air = (t: number): number | undefined =>
  inRun(t) ? base.axes.air?.(t) : t < OPENING_END ? openingAir(t) : surgeAir(t);
const speed = (t: number): number | undefined =>
  inRun(t) ? base.axes.speed?.(t) : t < OPENING_END ? openingSpeed(t) : surgeSpeed(t);

const spec: Spec = {...base, contacts: strikes.map(([t, impact]) => ({t, impact})), axes: {air, speed}};
export default spec;
