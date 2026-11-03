import {expect, it} from 'vitest';
import {decide, decideCompileCells, random, signTail} from '../tools/measure/engine_decision.ts';
it('handles wins, losses and ties without inventing evidence', () => {
  expect(decide(Array.from({length: 12}, () => ({base: 100, candidate: 99})), .95, 1000).verdict).toBe('KEEP');
  expect(decide(Array.from({length: 12}, () => ({base: 100, candidate: 101})), .95, 1000).verdict).toBe('REJECT');
  const ties = decide(Array.from({length: 12}, () => ({base: 100, candidate: 100})), .95, 1000);
  expect(ties).toMatchObject({verdict: 'INCONCLUSIVE', ties: 12, bootstrapSupportFaster: .5, fasterSignP: 1});
  expect(signTail(10, 12)).toBeCloseTo(79 / 4096, 14);
});
it('does not keep a change rescued by a few favorable outliers', () => {
  const pairs = Array.from({length: 24}, (_, i) => ({base: 100, candidate: i < 16 ? 101 : 60}));
  expect(decide(pairs, .95, 2000).verdict).toBe('INCONCLUSIVE');
  expect(() => decide([{base: 0, candidate: 1}, ...pairs])).toThrow();
});
it('blocks a compile-cell regression even when the aggregate improves', () => {
  const samples = Array.from({length: 12}, (_, round) => [0, 1].map(arm => ({round, arm,
    measurements: [{cell: 57, compileMs: arm ? 90 : 100}, {cell: 61, compileMs: arm ? 102 : 100}]}))).flat();
  expect(decide(Array.from({length: 12}, () => ({base: 200, candidate: 192}))).verdict).toBe('KEEP');
  const result = decideCompileCells(samples, [57, 61]);
  expect(result.regressionGuardPassed).toBe(false);
  expect(result.decisions.map(c => c.decision.verdict)).toEqual(['KEEP', 'REJECT']);
  expect(() => decideCompileCells(samples.slice(1), [57, 61])).toThrow('one sample per arm and round');
});
it('sign safeguard bounds false keeps in symmetric null simulations', () => {
  const rng = random(175), n = 24;
  let falseKeeps = 0;
  for (let trial = 0; trial < 2000; trial++) {
    let wins = 0;
    for (let i = 0; i < n; i++) wins += rng() < .5 ? 1 : 0;
    if (signTail(wins, n) <= .05) falseKeeps++;
  }
  // This tests the conservative sign prerequisite, not bootstrap calibration
  // or timing-noise independence on the host. The real A/A run is an additional
  // host sanity check, not a proof of those assumptions.
  expect(falseKeeps / 2000).toBeLessThan(.055);
  expect(falseKeeps / 2000).toBeGreaterThan(.015);
});
