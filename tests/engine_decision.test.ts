import {expect, it} from 'vitest';
import {decide, measuredPairs, pairOrder, summarizePairs} from '../tools/measure/engine_decision.ts';
const constant = (delta: number, n = 12) => Array.from({length: n}, () => ({base: 100, candidate: 100 + delta}));
it('describes partial pairs without inventing an inferential result', () => {
  expect(summarizePairs([])).toEqual({n: 0, medianDeltaPct: null, fasterPairs: 0, slowerPairs: 0, tiedPairs: 0});
  expect(summarizePairs([{base: 100, candidate: 90}, {base: 200, candidate: 220}, {base: 10, candidate: 10}]))
    .toEqual({n: 3, medianDeltaPct: 0, fasterPairs: 1, slowerPairs: 1, tiedPairs: 1});
  expect(summarizePairs([...constant(-4, 1), ...constant(-2, 1), ...constant(0, 1), ...constant(8, 1)]).medianDeltaPct).toBe(-1);
  expect(summarizePairs(constant(-3)).medianDeltaPct).toBe(decide(constant(-3)).medianDeltaPct);
  for (const invalid of [0, -1, NaN, Infinity]) expect(() => summarizePairs([{base: invalid, candidate: 1}])).toThrow();
});
it('uses one declared practical margin, including ties and boundary values', () => {
  expect(decide(constant(-3), .95, 2).verdict).toBe('FASTER');
  expect(decide(constant(3), .95, 2).verdict).toBe('SLOWER');
  for (const delta of [-2, 0, 2]) expect(decide(constant(delta), .95, 2).verdict).toBe('EQUIVALENT');
  expect(decide(constant(0))).toMatchObject({medianDeltaPct: 0, intervalPct: [0, 0], confidence: .95});
});
it('allows a zero margin to test direction without a minimum benefit', () => {
  expect(decide(constant(-.1), .95, 0).verdict).toBe('FASTER');
  expect(decide(constant(.1), .95, 0).verdict).toBe('SLOWER');
  expect(decide(constant(0), .95, 0).verdict).toBe('EQUIVALENT');
  expect(decide([...constant(-1, 6), ...constant(1, 6)], .95, 0).verdict).toBe('INCONCLUSIVE');
  for (const margin of [-1, NaN, Infinity, 100]) expect(() => decide(constant(0), .95, margin)).toThrow();
});
it('has exact conservative coverage under every possible sign pattern, without Monte Carlo', () => {
  // IID continuous observations with true median zero have equiprobable signs.
  for (const n of [8, 10, 12, 16]) {
    let covered = 0;
    for (let mask = 0; mask < 2 ** n; mask++) {
      const pairs = Array.from({length: n}, (_, i) => ({base: 100, candidate: mask & (1 << i) ? 101 : 99}));
      const {intervalPct: [lower, upper]} = decide(pairs);
      covered += lower <= 0 && upper >= 0 ? 1 : 0;
    }
    const actual = covered / 2 ** n;
    expect(actual).toBeGreaterThanOrEqual(.95);
    expect(actual).toBe(decide(constant(0, n)).coverage);
  }
  expect(decide(constant(0)).coverage).toBe(1 - 158 / 4096);
});
it('does not let favorable outliers rescue an uncertain median', () => {
  const pairs = Array.from({length: 24}, (_, i) => ({base: 100, candidate: i < 16 ? 103 : 60}));
  expect(decide(pairs).verdict).toBe('INCONCLUSIVE');
  for (const invalid of [0, -1, NaN, Infinity]) expect(() => decide([{base: invalid, candidate: 1}, ...pairs])).toThrow();
  expect(() => decide(constant(0, 8), .999)).toThrow('too few pairs');
});
it('pairs only rounds finished in both arms, by cell or across cells', () => {
  const sample = (round: number, cell: string, arm: number, nsPerFrame: number) => ({round, cell, arm, nsPerFrame});
  const samples = [sample(0, 'a', 1, 90), sample(0, 'a', 0, 100), sample(0, 'b', 0, 200), sample(0, 'b', 1, 220),
    sample(1, 'a', 0, 100), sample(1, 'a', 1, 100), sample(1, 'b', 0, 200)];
  expect(measuredPairs(samples)).toEqual([{base: 150, candidate: 155}]);
  expect(measuredPairs(samples, 'a')).toEqual([{base: 100, candidate: 90}, {base: 100, candidate: 100}]);
  expect(measuredPairs([])).toEqual([]);
});

it('precommits reproducible, balanced random process ordering', () => {
  const orders = pairOrder(24, 1729);
  expect(orders.filter(p => p[0] === 0)).toHaveLength(12);
  expect(orders).toEqual(pairOrder(24, 1729));
  expect(orders).not.toEqual(pairOrder(24, 1730));
  for (const n of [7, 9, 258]) expect(() => pairOrder(n, 1729)).toThrow();
});
