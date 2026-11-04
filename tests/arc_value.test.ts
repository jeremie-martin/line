import { expect, it } from 'vitest';
import { arcArrivalFeatures, arcFutureValue } from '../scripts/v0/optimizer/arc_value.ts';
import {createArcCompileContext} from '../scripts/v0/optimizer/arc_compile_context.ts';
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

it('keeps the learned future feature order, missing values and construction overrides', () => {
  const ctx = createArcCompileContext({duration: 4, preroll: 0,
    contacts: [{t: 1, impact: .3}, {t: 2, impact: .4}, {t: 3, impact: .5}],
    axes: {air: () => .5, speed: () => .75}}, {
    budget: 200_000, guides: false, railLayout: 'transfer',
    sectionStyles: {1: {guides: true, railLayout: 'paired'}, 2: {guides: undefined}},
    constructionRequests: {
      1: {section: 1, frame: 40, next: 80, construction: 'fold', guidance: 'required'},
      2: {section: 2, frame: 80, next: 120, construction: 'scattered', guidance: 'optional'},
    },
  });
  const targets = [1, .3, .5, .75, -1, 1, .4, .5, .75, -1];
  expect(ctx.futureFeatures(0)).toStrictEqual(targets);
  expect(ctx.futureValueFeatures(0)).toStrictEqual([...targets,
    1, 0, 0, 1, 0, 0, 0, 0, // guided, paired fold
    1, 1, 0, 0, 0, 0, 0, 1, // explicit undefined overrides guides:false
  ]);
  const absent = [0, -1, -1, -1, -1];
  expect(ctx.futureFeatures(0, 4)).toStrictEqual([...targets, 61 / 40, .5, .5, .75, -1, ...absent]);
  expect(ctx.futureFeatures(-1)).toStrictEqual([39 / 40, -1, -1, -1, -1, ...targets.slice(0, 5)]);
  expect(ctx.futureValueFeatures(3)).toStrictEqual([...absent, ...absent, ...Array(16).fill(0)]);
  // A study fork owns its vectors; editing an exported vector cannot affect
  // another candidate, interval or context.
  ctx.futureValueFeatures(0).fill(99);
  expect(ctx.forkForStudy().futureValueFeatures(0)).toStrictEqual(ctx.futureValueFeatures(0));
  // Construction fallback can change a later section between searches. The
  // next search must prepare current inputs, without altering the old vector.
  const before = ctx.futureValueFeatures(0);
  ctx.options.sectionStyles![2].guides = false;
  const after = ctx.futureValueFeatures(0);
  expect(before[18]).toBe(1);
  expect(after).toStrictEqual(before.map((v, i) => i === 18 ? 0 : v));
});
