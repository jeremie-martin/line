import {expect, it} from 'vitest';
import {runArcAttempts} from '../scripts/v0/optimizer/arc_attempts.ts';
import type {Spec} from '../scripts/v0/types.ts';

const spec: Spec = {duration: 4, jitter: 0, contacts: [{t: 1}], axes: {air: () => .5}};
it('retains a completed incumbent, reuses its controls, and records each attempt on the shared clock', () => {
  const reference = {control: {entry: 0, turn: 0, exit: 0, support: 8, bias: 0, offset: .1}, incoming: 3, span: 40, features: Array(57).fill(0)};
  let calls = 0;
  const result = runArcAttempts(spec, 17, {budget: 75000, policyPreview: true, previewMemory: true, searchAfterPreview: 'always',
    controlPolicy: {rolloutPolicy: {}}}, (_spec, _seed, options, continueMeter) => {
    const first = calls++ === 0;
    expect(continueMeter).toBe(!first);
    expect(options.budget).toBe(first ? 3750 : 75000);
    if (!first) expect(options.controlExamples).toEqual([reference]);
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

it.each(['missed', 'offbeat', 'terminated', 'complete'] as const)(
  'uses the actual report to decide whether a %s proposal needs general search', condition => {
    let calls = 0;
    const result = runArcAttempts(spec, 17, {budget: 75000, policyPreview: true, controlPolicy: {rolloutPolicy: {}}},
      (_spec, _seed, _options, continueMeter) => {
        const first = calls++ === 0;
        expect(continueMeter).toBe(!first);
        return {track: {}, rows: [], failure: null, trajectoryLoss: 0,
          report: {terminus: {reason: first && condition === 'terminated' ? 'crash' : 'endOfSpec'},
            contacts: [{status: first && condition === 'missed' ? 'miss' : 'hit'}],
            off_beat_landings: first && condition === 'offbeat' ? [1] : []} as any,
          constructionFrames: 50, samples: 1, searchBudgetExhausted: false,
          lookaheadStats: {}, planningDecisions: [],
          stats: {sim_frames: calls * 100, viable_candidate_samples: 1, gap_commits: 1}};
      });
    expect(calls).toBe(condition === 'complete' ? 1 : 2);
    expect(result.records[result.selected].complete).toBe(true);
    expect(result.firstCompletionFrame).toBe(condition === 'complete' ? 100 : 200);
  });

it.each([.0001, .02, undefined, NaN])('only accepts a valid proposal with sufficiently small measured loss (%s)', loss => {
  let calls = 0;
  const result = runArcAttempts(spec, 17, {budget: 75000, policyPreview: true, controlPolicy: {rolloutPolicy: {}}}, () => {
    calls++;
    return {track: {}, rows: [], failure: null, trajectoryLoss: loss,
      report: {terminus: {reason: 'endOfSpec'}, contacts: [{status: 'hit'}], off_beat_landings: []} as any,
      constructionFrames: 50, samples: 1, searchBudgetExhausted: false, lookaheadStats: {}, planningDecisions: [],
      stats: {sim_frames: calls * 100, viable_candidate_samples: 1, gap_commits: 1}};
  });
  expect(calls).toBe(loss === .0001 ? 1 : 2);
  expect(result.proposalDecision?.reason).toBe(loss === .0001 ? 'accepted' : 'above-error-limit');
});

it.each([true,false])('validates a reference continuation before spending the full search allowance (accepted=%s)',accepted=>{
  let calls=0;
  const fork={section:1,continuation:[{control:{},incoming:0,span:40}]} as any;
  const result=runArcAttempts(spec,17,{budget:75000,referencePreview:true,fork},(_spec,_seed,options,continueMeter)=>{
    const first=calls++===0;
    expect(continueMeter).toBe(!first);expect(options.fork).toBe(fork);
    expect(options.budget).toBe(first?3750:75000);
    if(first){expect(options.samples).toBe(0);expect(options.guidance).toBeUndefined();expect(options.lookaheadWidth).toBe(0);}
    return {track:{},rows:[],failure:null,trajectoryLoss:first && !accepted ? .04 : 0,
      report:{terminus:{reason:'endOfSpec'},contacts:[{status:'hit'}],off_beat_landings:[]} as any,
      constructionFrames:50,samples:1,searchBudgetExhausted:false,lookaheadStats:{},planningDecisions:[],
      stats:{sim_frames:calls*100,viable_candidate_samples:1,gap_commits:1}};
  });
  expect(calls).toBe(accepted?1:2);expect(result.proposalDecision?.source).toBe('reference');
  expect(result.records.at(-1)?.end).toBe(accepted?100:200);
});
