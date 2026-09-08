import { expect, it } from 'vitest';
import { arcArrivalFeatures, arcFutureValue } from '../scripts/v0/optimizer/arc_value.ts';
import model from '../scripts/v0/optimizer/arc_value_model.json' with { type: 'json' };
import fixtures from './fixtures/arc_value_predictions.json' with { type: 'json' };

it('matches independently exported Python model predictions', () => {
  for (const row of fixtures.cases) {
    expect(arcFutureValue(row.features, model)).toBeCloseTo(row.prediction, 13);
  }
  expect(() => arcFutureValue(fixtures.cases[0].features.slice(1), model)).toThrow('feature mismatch');
  expect(() => arcFutureValue(fixtures.cases[0].features.map(() => NaN), model)).toThrow('feature mismatch');
});

it('describes physical arrival independently of absolute track position', () => {
  const ids = ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
  const state = { points: Object.fromEntries(ids.map((id, i) => [id, { x: 2 * i, y: -i, vx: 4 + i / 10, vy: 3 }])) };
  const translated = { points: Object.fromEntries(Object.entries(state.points).map(([id, p]) => [id, { ...p, x: p.x + 12000, y: p.y - 7000 }])) };
  const describe = (s: typeof state) => arcArrivalFeatures(s, 30, 5, 15, .03, 12);
  expect(describe(state)).toHaveLength(47);
  expect(describe(translated)).toEqual(describe(state));
  expect(describe(state).every(Number.isFinite)).toBe(true);
});
