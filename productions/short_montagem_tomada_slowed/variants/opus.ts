/** Every bar is a dive. The upper figure counts six close strokes and then a delayed seventh, and the strokes grow
 * toward it; the rider rides each bar as one gesture: it starts the bar floating, then each close stroke comes lower
 * and faster, skimming down the staircase, and the delay before the seventh is one tall arc that drops onto it. The
 * same dive runs through the opening figure and through the drum bars, so the two halves of the song rhyme. In the
 * second half of the opening, where the figure loses weight, the dive is gentler and slower; the voice across the
 * swell is ridden as approved; with the drum the dives are deepest and fastest.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const strikes = base.contacts.map(({t, impact = 0}): [number, number] => [t, impact]);
const times = strikes.map(([t]) => t);

type Passage = {from: number; slow: number; fast: number; floatAir: number; skimAir: number; arc: number};
// The dive in each passage: speed from `slow` to `fast` down the close strokes, air from `floatAir` to `skimAir`.
const passages: Passage[] = [
  {from: 0, slow: .70, fast: .72, floatAir: .50, skimAir: .50, arc: .4},
  {from: 1.12, slow: .72, fast: .92, floatAir: .68, skimAir: .50, arc: 1},
  {from: 9.49, slow: .62, fast: .74, floatAir: .70, skimAir: .60, arc: .8},
  {from: 17.85, slow: .80, fast: 1, floatAir: .72, skimAir: .50, arc: 1},
];
const passageAt = (t: number) => [...passages].reverse().find((p) => t >= p.from)!;
const VOICE = [15.6, 17.84] as const;   // the voice across the swell keeps the approved ride

/** The span that ends at contact k, and how many close strokes in a row it closes. */
function stepAt(t: number): {k: number; dt: number; run: number} {
  const i = times.findIndex((ct) => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const dt = times[k] - (k > 0 ? times[k - 1] : 0);
  let run = 0;
  for (let j = k; j > 0 && times[j] - times[j - 1] < .34; j--) run++;
  return {k, dt, run};
}
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);

const air = (t: number): number | undefined => {
  if (t > VOICE[0] && t < VOICE[1]) return base.axes.air?.(t);
  const {dt, run} = stepAt(t);
  const p = passageAt(t);
  if (dt >= .36) return Math.min(.86, p.floatAir + .1);
  return p.floatAir + (p.skimAir - p.floatAir) * Math.min(run, 6) / 6;
};
const speed = (t: number): number | undefined => {
  if (t > VOICE[0] && t < VOICE[1]) return base.axes.speed?.(t);
  const {dt, run} = stepAt(t);
  const p = passageAt(t);
  if (dt >= .36) return p.slow;
  return p.slow + (p.fast - p.slow) * Math.min(run, 6) / 6;
};
const amplitude = (t: number): number => {
  const {dt} = stepAt(t);
  if (t > VOICE[0] && t < VOICE[1]) return .02;
  return (dt >= .36 ? passageAt(t).arc : .2) * fullArc(dt);
};

const spec: Spec = {...base, axes: {air, speed, amplitude}};
export default spec;
