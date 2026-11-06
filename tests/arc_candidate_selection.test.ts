import {expect, it, vi} from 'vitest';
import {distinctArrival, distinctCandidates, valueRank} from '../scripts/v0/optimizer/arc_candidates.ts';
import * as value from '../scripts/v0/optimizer/arc_value.ts';
import model from '../scripts/v0/optimizer/arc_value_model.json' with {type: 'json'};
import fixtures from './fixtures/arc_value_predictions.json' with {type: 'json'};

const options = {futureValueModel: model, valueWeight: .45} as any;
function candidates(count: number, seed: number) {
  let state = seed;
  const next = () => (state = Math.imul(state ^ state >>> 15, 0x2c1b3c6d) + 0x6d2b79f5 | 0, (state >>> 0) / 2 ** 32);
  return Array.from({length: count}, (_, k) => {
    const localCost = next() * 2, features = fixtures.cases[k % fixtures.cases.length].features.map(v => v + (next() - .5) * .2);
    return {localCost, cost: localCost + next() * .4, headingPrior: k % 3 ? next() * .1 : undefined, valueFeatures: k % 5 ? features : undefined,
      heading: Math.round(next() * 8) * 5, endSpeed: next() * 2, pose: next() * 30, release: k % 2 ? Math.round(next() * 6) : undefined} as any;
  });
}
/** Every rank computed, then a stable sort: the definition this selection must keep. */
function reference(all: any[], width: number) {
  const result: any[] = [];
  for (const candidate of all.slice().sort((a, b) => valueRank(options, a) - valueRank(options, b))) {
    if (result.every(a => distinctArrival(a, candidate))) result.push(candidate);
    if (result.length >= width) break;
  }
  return result;
}

it('selects exactly what ranking every candidate would select', () => {
  for (let seed = 1; seed <= 200; seed++) for (const width of [1, 4, 8]) {
    const all = candidates(40 + seed % 80, seed);
    expect(distinctCandidates(options, all, width)).toEqual(reference(all, width));
  }
});

it('keeps original order between equal ranks', () => {
  const twin = (heading: number) => ({localCost: 1, cost: 1, heading, endSpeed: 0, pose: 0} as any);
  expect(distinctCandidates(options, [twin(0), twin(10), twin(20)], 3).map(c => c.heading)).toEqual([0, 10, 20]);
});

it('predicts only the candidates that could be selected', () => {
  const spy = vi.spyOn(value, 'arcFutureValue');
  const all = candidates(120, 7).map(c => ({...c, localCost: c.localCost * 40}));
  distinctCandidates(options, all, 2);
  expect(spy.mock.calls.length).toBeLessThan(all.length / 2);
  spy.mockRestore();
});
