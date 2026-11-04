import {expect, it} from 'vitest';
import {decide, decideCompileCells, pairOrder} from '../tools/measure/engine_decision.ts';
const constant = (delta: number, n = 12) => Array.from({length: n}, () => ({base: 100, candidate: 100 + delta}));
it('uses one declared practical margin, including ties and boundary values', () => {
  expect(decide(constant(-3)).verdict).toBe('FASTER');
  expect(decide(constant(3)).verdict).toBe('SLOWER');
  for (const delta of [-2, 0, 2]) expect(decide(constant(delta)).verdict).toBe('EQUIVALENT');
  expect(decide(constant(0))).toMatchObject({medianDeltaPct: 0, intervalPct: [0, 0], confidence: .95});
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
it('requires a bounded regression in every cell, not merely a failure to detect harm', () => {
  const samples = Array.from({length: 12}, (_, round) => [0, 1].map(arm => ({round, arm,
    iterations: [{rep: 0, cell: 57, compileMs: arm ? 90 : 100}, {rep: 0, cell: 61, compileMs: arm ? 103 : 100}]}))).flat();
  expect(decide(constant(-3.5)).verdict).toBe('FASTER');
  expect(decideCompileCells(samples, [57, 61]).regressionGuardPassed).toBe(false);
  samples.forEach(s => {if (s.arm) s.iterations[1].compileMs = s.round % 2 ? 103 : 97;});
  expect(decideCompileCells(samples, [57, 61]).regressionGuardPassed).toBe(false);
  expect(() => decideCompileCells(samples.slice(1), [57, 61])).toThrow('one sample per arm and round');
  expect(() => decideCompileCells(samples, [57, 57])).toThrow('unique cells');
  expect(() => decideCompileCells(samples, [62])).toThrow('nonempty cell');
});
it('precommits reproducible, balanced random process ordering', () => {
  const orders = pairOrder(24, 1729);
  expect(orders.filter(p => p[0] === 0)).toHaveLength(12);
  expect(orders).toEqual(pairOrder(24, 1729));
  expect(orders).not.toEqual(pairOrder(24, 1730));
  for (const n of [7, 9, 258]) expect(() => pairOrder(n, 1729)).toThrow();
});
