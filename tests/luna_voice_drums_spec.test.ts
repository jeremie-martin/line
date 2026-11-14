import {expect, it} from 'vitest';
import spec from '../productions/luna_bala_44s/variants/voice-drums.ts';
import {DROP, DURATION, LAST_KICK} from '../productions/luna_bala_44s/music.ts';

it('Luna Bala voice-drums: measured landings in order, the drop the hardest, a ride-out after the last kick', () => {
  const c = spec.contacts, gaps = c.slice(1).map((k, i) => k.t - c[i].t);
  expect(Math.min(...gaps)).toBeGreaterThan(0.14);
  expect(c.find(k => k.impact === 1)!.t).toBeCloseTo(DROP, 2);
  expect(c.at(-1)!.t).toBeCloseTo(LAST_KICK, 2);
  expect(spec.axes.air!(DURATION - 0.3)).toBeLessThan(0.2);
});
