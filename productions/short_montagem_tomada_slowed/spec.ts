/**
 * Every bar is a dive (Opus, whose ride is also the only one that lands the returning drum at 17.86 with its weight).
 * The upper figure counts six close strokes and a delayed seventh: the rider starts each bar floating, skims lower
 * and faster down the close strokes, and the delay before the seventh is one tall arc that drops onto it. The same
 * dive runs through the opening figure and through the drum bars, so the two halves rhyme, and the missing strokes
 * after 25.5 become its longest leap. From Astra and Sol: the lift before the seventh grows bar by bar through the
 * opening, and the second half of the opening loses weight before the swell (Astra). The voice across the swell is
 * ridden as approved. My own ending: after the last double the dives stop and the rider coasts out slowly on the
 * three replies.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import base from './variants/approved.ts';

export {overlayMeta} from './variants/approved.ts';

const strikes = base.contacts.map(({t, impact = 0}): [number, number] =>
  [t, t >= 9.492 && t < 15.668 ? Number((impact * .85).toFixed(3)) : impact]);
const times = strikes.map(([t]) => t);

type Passage = {from: number; slow: number; fast: number; floatAir: number; skimAir: number};
const passages: Passage[] = [
  {from: 0, slow: .70, fast: .72, floatAir: .50, skimAir: .50},
  {from: 1.12, slow: .72, fast: .92, floatAir: .68, skimAir: .50},
  {from: 9.49, slow: .62, fast: .74, floatAir: .70, skimAir: .60},
  {from: 17.85, slow: .80, fast: 1, floatAir: .72, skimAir: .50},
];
const passageAt = (t: number) => [...passages].reverse().find(p => t >= p.from)!;
const VOICE = [15.6, 17.84] as const;   // the voice across the swell keeps the approved ride
const COAST = 35.2;                      // after the last double

/** The span that ends at contact k, and how many close strokes in a row it closes. */
function stepAt(t: number): {dt: number; run: number} {
  const i = times.findIndex(ct => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const dt = times[k] - (k > 0 ? times[k - 1] : 0);
  let run = 0;
  for (let j = k; j > 0 && times[j] - times[j - 1] < .34; j--) run++;
  return {dt, run};
}
/** In the opening figure the lift before the seventh grows with each bar. */
const growth = (t: number) => t >= 1.12 && t < 9.49 ? (t < 3.4 ? 0 : t < 5.6 ? .05 : .1) : .03;

const air = (t: number): number | undefined => {
  if (t > VOICE[0] && t < VOICE[1]) return base.axes.air?.(t);
  if (t > COAST) return .72;
  const {dt, run} = stepAt(t);
  const p = passageAt(t);
  if (dt >= .36) return Math.min(.86, p.floatAir + .07 + growth(t));
  return p.floatAir + (p.skimAir - p.floatAir) * Math.min(run, 6) / 6;
};
const speed = (t: number): number | undefined => {
  if (t > VOICE[0] && t < VOICE[1]) return base.axes.speed?.(t);
  if (t > COAST) return .82 - .3 * Math.min(1, (t - COAST) / 1.1);
  const {dt, run} = stepAt(t);
  const p = passageAt(t);
  if (dt >= .36) return p.slow;
  return p.slow + (p.fast - p.slow) * Math.min(run, 6) / 6;
};

const spec: Spec = {...base, contacts: strikes.map(([t, impact]) => ({t, impact})), axes: {air, speed}};
export default spec;
