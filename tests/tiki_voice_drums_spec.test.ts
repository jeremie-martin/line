import {expect, it} from 'vitest';
import spec from '../productions/tiki_tiki_48s/variants/voice-drums.ts';
import {DROP, DURATION} from '../productions/tiki_tiki_48s/music.ts';

it('Tiki Tiki voice-drums: measured landings in order, the drop the hardest, a ride-out at the end', () => {
  const c = spec.contacts, gaps = c.slice(1).map((k, i) => k.t - c[i].t);
  expect(Math.min(...gaps)).toBeGreaterThan(0.14);
  expect(c.find(k => k.impact === 1)!.t).toBeCloseTo(DROP, 2);
  expect(c[0].t).toBeGreaterThanOrEqual(0.2);
  const air = spec.axes.air!;
  expect(air(DURATION - 0.5)).toBeLessThan(0.2);  // low air held to the end, not a jump
  expect(Math.max(...c.filter(k => k.t < 6.9 || k.t > 42).map(k => k.impact))).toBeLessThanOrEqual(0.12);  // voice alone: barely touched
});
