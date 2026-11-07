import {createHash} from 'node:crypto';
import {expect, it} from 'vitest';
import {exactPow} from '../scripts/lib/exact_pow.ts';

/** The bits of `power` over the domains the compiler uses, from a fixed sequence. */
function digest(power: (x: number, y: number) => number) {
  let state = 88172645463325252n;
  const mask = (1n << 64n) - 1n, uniform = () => {
    state ^= (state << 13n) & mask; state ^= state >> 7n; state ^= (state << 17n) & mask;
    return Number(state >> 11n) / 2 ** 53;
  };
  const values = new Float64Array(300000);
  for (let i = 0; i < values.length; i += 3) {
    values[i] = power(uniform(), 1 + uniform() * 6);
    values[i + 1] = power(1 + uniform() * 500, uniform() * 6 - 3);
    values[i + 2] = power(uniform() < .5 ? .65 : .6, Math.floor(uniform() * 40));
  }
  return createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex');
}

it('keeps the bits of Node 22 Math.pow, which every committed track depends on', () => {
  expect(digest(exactPow)).toBe('f0e74c333d6aee27a1533d71f1b0489c320f80f27225d4ac619e65b11caf91cf');
});

it('leaves results without a rounding question to Math.pow', () => {
  for (const [x, y] of [[0, 1.5], [0, -1], [-2, 3], [-2, .5], [Infinity, 2], [2, Infinity], [NaN, 1], [1, NaN], [3, 0], [1, 7], [2, 2000], [2, -2000]])
    expect(exactPow(x, y)).toBe(Math.pow(x, y));
});
