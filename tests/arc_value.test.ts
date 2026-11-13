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

it('reproduces the reference tree walk bit for bit', () => {
  const reference = (features: number[]) => {
    let value = model.model.initial;
    for (const tree of model.model.trees) {
      let node = 0;
      while (!tree.leaf[node]) node = features[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
      value += tree.value[node];
    }
    return Math.max(0, Math.expm1(value) / 100);
  };
  let state = 0x9e3779b9;
  const next = () => (state = Math.imul(state ^ state >>> 15, 0x2c1b3c6d) + 0x6d2b79f5 | 0, (state >>> 0) / 2 ** 32);
  for (let k = 0; k < 2000; k++) {
    const base = fixtures.cases[k % fixtures.cases.length].features;
    const features = base.map(v => k % 3 ? v + (next() - .5) * 2 : v * (1 + next() - .5));
    expect(Object.is(arcFutureValue(features, model), reference(features))).toBe(true);
  }
  // A threshold-equal feature takes the left branch.
  const tree = {left: [1, 0, 0], right: [2, 0, 0], feature: [0, 0, 0], threshold: [.5, 0, 0], value: [0, 3, 5], leaf: [false, true, true]};
  const artifact = {...model, featureCount: 1, model: {initial: 0, trees: [tree]}};
  expect(arcFutureValue([.5], artifact)).toBe(Math.expm1(3) / 100);
  expect(arcFutureValue([.6], artifact)).toBe(Math.expm1(5) / 100);
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
  expect(ctx.futureValueFeatures(0)).toHaveLength(30);
  expect(ctx.futureValueFeatures(0).slice(0, 26)).toStrictEqual([...targets,
    1, 0, 0, 1, 0, 0, 0, 0, // guided, paired fold
    1, 1, 0, 0, 0, 0, 0, 1, // explicit undefined overrides guides:false
  ]);
  const absent = [0, -1, -1, -1, -1];
  expect(ctx.futureFeatures(0, 4)).toStrictEqual([...targets, 61 / 40, .5, .5, .75, -1, ...absent]);
  expect(ctx.futureFeatures(-1)).toStrictEqual([39 / 40, -1, -1, -1, -1, ...targets.slice(0, 5)]);
  // Past the last contact: nothing ahead, and an empty run (energy 0, speed ask −1, share 0, length 0).
  expect(ctx.futureValueFeatures(3)).toStrictEqual([...absent, ...absent, ...Array(16).fill(0), 0, -1, 0, 0]);
  // The run ahead: energy its asks take per frame, mean speed ask, strong share, seconds.
  const run = ctx.futureValueFeatures(0).slice(26);
  expect(run[0]).toBeGreaterThan(0); expect(run[3]).toBeGreaterThan(0); expect(run[2]).toBeGreaterThanOrEqual(0);
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
