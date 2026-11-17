import {expect, it} from 'vitest';
import {locate} from '../tools/music/source.ts';

it('finds an excerpt inside its recording to the sample, and scores another sound low', () => {
  const noise = (n: number, seed: number) => Float32Array.from({length: n}, (_, i) => {const v = Math.sin(i * 12.9898 + seed) * 43758.5453; return 2 * (v - Math.floor(v)) - 1;});
  const whole = noise(40000, 7), probe = whole.slice(12345, 12345 + 8000);
  const found = locate(whole, probe);
  expect(found.at).toBe(12345); expect(found.match).toBeCloseTo(1, 6);
  expect(locate(whole, noise(8000, 99)).match).toBeLessThan(0.2);
});
