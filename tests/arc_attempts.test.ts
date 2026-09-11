import {expect, it} from 'vitest';
import {runArcAttempts} from '../scripts/v0/optimizer/arc_attempts.ts';
import type {Spec} from '../scripts/v0/types.ts';

const spec: Spec = {duration: 4, jitter: 0, contacts: [{t: 1}], axes: {air: () => .5}};
it('retains a completed incumbent, reuses its controls, and records each attempt on the shared clock', () => {
  const reference = {control: {entry: 0, turn: 0, exit: 0, support: 8, bias: 0, offset: .1}, incoming: 3, span: 40};
  let calls = 0;
  const result = runArcAttempts(spec, 17, {budget: 75000, policyPreview: true, previewWarmStart: true,
    controlPolicy: {rolloutPolicy: {}}}, (_spec, _seed, options, continueMeter) => {
    const first = calls++ === 0;
    expect(continueMeter).toBe(!first);
    expect(options.budget).toBe(first ? 3750 : 75000);
    if (!first) expect(options.trajectoryControls).toEqual([reference]);
    return {track: {lines: [first ? 1 : 2]}, report: {terminus: {reason: 'endOfSpec'}, off_beat_landings: [], contacts: [{status: 'hit'}]} as any,
      rows: [{...reference, frame: 1, spent: first ? 60 : 900}], failure: null,
      trajectoryLoss: first ? .1 : .2, constructionFrames: first ? 60 : 900,
      samples: first ? 1 : 50, searchBudgetExhausted: false,
      lookaheadStats: {probes: first ? 0 : 10}, planningDecisions: [],
      stats: {sim_frames: first ? 100 : 1000, viable_candidate_samples: first ? 1 : 30, gap_commits: 1}};
  });
  expect(calls).toBe(2); expect(result.selected).toBe(0);
  expect(result.firstCompletionFrame).toBe(100);
  expect(result.records.map(r => [r.start, r.constructionEnd, r.end])).toEqual([[0, 60, 100], [100, 900, 1000]]);
  expect(result.records.map(r => r.lookahead)).toEqual([{probes: 0}, {probes: 10}]);
  expect(result.records.map(r => r.selected)).toEqual([true, false]);
});
