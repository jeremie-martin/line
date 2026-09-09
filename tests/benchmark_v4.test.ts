import {describe,it,expect} from 'vitest';
import {loadCases,caseGaps,caseSpec,targets} from '../benchmark/v4/model.ts';
import {loadCases as loadV3} from '../benchmark/v3/model.ts';
import {policy} from '../benchmark/v4/policy.ts';
import {policy as oldPolicy} from '../benchmark/v3/policy.ts';
import * as v3 from '../benchmark/v3/evaluator.ts';
import * as v4 from '../benchmark/v4/evaluator.ts';
import {verifyFrozen} from '../benchmark/v4/contract.ts';
import {validateSpec,effectiveAxes} from '../scripts/v0/core/substrate.ts';

describe('V4 frozen superset',()=>{
  it('preserves every original case and balances companions within each original parent',()=>{
    const cases=loadCases(),old=loadV3();expect(cases).toHaveLength(176);
    expect(cases.slice(0,88)).toEqual(old);
    for(const original of old){
      const added=cases.find(c=>c.id==='stretch_'+original.id)!;
      expect(added).toBeDefined();expect(added.parentId).toBe(original.parentId);
      expect(added.group).toBe(original.group);expect(added.stratum).toBe(original.stratum);
      expect(added.contacts).not.toEqual(original.contacts);
    }
  });
  it('uses the exact V3 scorer, physics contract and weighting',()=>{
    expect(v4.evaluateTrack).toBe(v3.evaluateTrack);expect(v4.scoreObservations).toBe(v3.scoreObservations);
    expect(v4.summarize).toBe(v3.summarize);
    for(const key of ['axisWeights','strata','budget','seeds','tolerance','spanWeight','impactWeight','includeTail'] as const)
      expect(policy[key]).toEqual(oldPolicy[key]);
    expect(()=>verifyFrozen()).not.toThrow();
  });
  it('adapts every new authored request exactly through the existing compiler API',()=>{
    for(const c of loadCases().slice(88)){
      const spec=caseSpec(c);expect(()=>validateSpec(spec)).not.toThrow();
      for(const gap of caseGaps(c)){
        const expected=targets(c,gap),actual=effectiveAxes(gap,spec);
        for(const axis of ['air','speed','amplitude'] as const){
          if(expected[axis]===undefined)expect(actual[axis]).toBeUndefined();
          else expect(actual[axis]).toBeCloseTo(expected[axis]!,10);
        }
        if(!gap.endsWithContact)expect(expected.impact).toBeUndefined();
      }
    }
  });
  it('includes the requested long supported intervals without an invented ending beat',()=>{
    const cases=loadCases().slice(88),seconds=cases.flatMap(c=>caseGaps(c).map(g=>(g.endFrame-g.startFrame)/40));
    for(const duration of [7,8,9,10,11,12,15])expect(seconds).toContain(duration);
    expect(cases.every(c=>c.contacts.at(-1)!.frame<c.durationFrames)).toBe(true);
  });
  it('requires all 352 planned records and rejects duplicate seed records',()=>{
    const cases=loadCases(),score=v3.scoreObservations([{gap:0,startFrame:0,endFrame:40,tail:false,axis:'speed',target:.5,achieved:.5,error:0}],[]);
    const rows=cases.flatMap(c=>[16,17].map(seed=>({sourceId:c.id,seed,score,trackHash:c.id})));
    expect(v4.summarize(rows,cases,[16,17]).headline).toBe(1000);
    expect(()=>v4.summarize(rows.slice(1),cases,[16,17])).toThrow(/incomplete/);
    rows[1].seed=16;expect(()=>v4.summarize(rows,cases,[16,17])).toThrow(/duplicate/);
  });
});
