import {expect, it} from 'vitest';
import {runArcAttempts} from '../scripts/v0/optimizer/arc_attempts.ts';
import type {Spec} from '../scripts/v0/types.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';

const spec: Spec = {duration: 4, jitter: 0, contacts: [{t: 1}], axes: {air: () => .5}};
it('makes a bounded first completion, then preserves it if further shared-budget search fails',()=>{
 let calls=0;
 const control={entry:0,turn:0,exit:0,support:8,bias:0,offset:0};
 const result=runArcAttempts(spec,17,{budget:100000,completionFirstFraction:.4},(_s,seed,options,continueMeter)=>{
  const first=calls++===0;expect(seed).toBe(17);expect(continueMeter).toBe(!first);
  expect(options.budget).toBe(first?40000:100000);
  if(!first)expect(options.warmReferences).toEqual([{control,incoming:0,span:20}]);
  return {track:{first},rows:[{control,incoming:0,span:20,features:[],frame:1,spent:100}],
   report:{terminus:{reason:'endOfSpec'},off_beat_landings:[],contacts:[{status:first?'hit':'miss'}]} as any,
   failure:first?null:'budget',trajectoryLoss:first?.2:.1,constructionFrames:first?100:400,
   samples:1,searchBudgetExhausted:!first,lookaheadStats:{},planningDecisions:[],
   stats:{sim_frames:first?300:700,viable_candidate_samples:1,gap_commits:first?1:0}};
 });
 expect(result.selected).toBe(0);expect(result.firstCompletionFrame).toBe(300);
 expect(result.records.map(r=>[r.name,r.start,r.end])).toEqual([['completion',0,300],['search',300,700]]);
});

it('meters both native completion attempts against one hard limit',()=>{
 const input:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
 const result=compileArcMotion(input,17,{budget:60000,samples:80,channel:12,radius:24,bidirectional:true,
  impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,
  completionFirstFraction:.4,memoryScope:'construction',memorySamples:4,budgetAdaptiveLocal:true});
 expect(result.attempts).toHaveLength(2);expect(result.stats.sim_frames).toBe(result.attempts[1].end);
 expect(result.stats.sim_frames).toBeLessThanOrEqual(60000);expect(result.attempts[0].end).toBeLessThanOrEqual(24000);
 expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
 expect(result.completionFirstStats.totalFrames).toBe(result.stats.sim_frames);
});
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
