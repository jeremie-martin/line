import {expect, it} from 'vitest';
import {fragmentInterval} from '../scripts/v0/optimizer/contact_interval.ts';

const line = {id: 1000, type: 0, x1: 0, y1: 0, x2: 20000, y2: 0} as any;
const contacts = (n: number) => {
  const positions = new Float64Array(3 * n);
  for (let k = 0; k < n; k++) positions.set([line.id, 1 + k * 1.5, 0], 3 * k);
  return positions;
};

it('fragments each separated contact footprint into its own line', () => {
  const result = fragmentInterval([line], contacts(3))!;
  expect(result.lines).toHaveLength(3);
  expect(result.lines.map(l => l.id)).toEqual([1000, 1001, 1002]);
});

it('refuses fragments that would not fit the section line ids, instead of failing the compile', () => {
  // A very long interval (2026-11-07: two training cases with gaps of several seconds) can touch a
  // carrier in more than 10000 separate places; the candidate is then not buildable as fragments.
  expect(fragmentInterval([line], contacts(9999))).not.toBeNull();
  expect(fragmentInterval([line], contacts(10001))).toBeNull();
});
