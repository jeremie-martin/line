import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {hypot2} from '../scripts/lib/hypot2.ts';

function same(x: number, y: number) {
  assert.ok(Object.is(hypot2(x, y), Math.hypot(x, y)), `hypot2(${x}, ${y})`);
  assert.ok(Object.is(hypot2(y, x), Math.hypot(y, x)), `hypot2(${y}, ${x})`);
}

describe('two-dimensional norm preserves the builtin numerical contract', () => {
  it('handles signed zero, nonfinite inputs, subnormals and exponent boundaries', () => {
    const values = [0, -0, NaN, Infinity, -Infinity, Number.MIN_VALUE, -Number.MIN_VALUE,
      2 ** -1022, -(2 ** -1022), Number.MAX_VALUE, -Number.MAX_VALUE,
      Number.EPSILON, 1, -1, 1 + Number.EPSILON, 1 - Number.EPSILON / 2,
      3, 4, 1e-160, 1e160, 1e308];
    for (let exponent = -1074; exponent <= 1023; exponent += 17) values.push(2 ** exponent, -(2 ** exponent));
    for (const x of values) for (const y of values) same(x, y);
  });

  it('agrees for arbitrary binary64 inputs and NaN payloads in both orders', () => {
    let seed = 0x6a09e667;
    const next = () => {seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0;};
    const data = new DataView(new ArrayBuffer(8));
    const number = () => {data.setUint32(0, next()); data.setUint32(4, next()); return data.getFloat64(0);};
    for (let i = 0; i < 200_000; i++) same(number(), number());
  });

  it('preserves rounding for nearby magnitudes and ordinary geometry inputs', () => {
    let seed = 0xbb67ae85;
    const next = () => {seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0;};
    const data = new DataView(new ArrayBuffer(8));
    for (let i = 0; i < 100_000; i++) {
      const high = next() & 0x7fefffff, low = next();
      data.setUint32(0, high); data.setUint32(4, low);
      const x = data.getFloat64(0);
      data.setUint32(4, (low + 1) >>> 0);
      same(x, data.getFloat64(0));
      same((next() / 2 ** 32 - .5) * 1000, (next() / 2 ** 32 - .5) * 1000);
    }
  });
});
