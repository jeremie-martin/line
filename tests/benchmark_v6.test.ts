import {it,expect} from 'vitest';
import {loadCatalog} from '../benchmark/v6/model.ts';
import {loadCatalog as loadV5} from '../benchmark/v5/model.ts';
import {policy} from '../benchmark/v6/policy.ts';
import {policy as v5Policy} from '../benchmark/v5/policy.ts';
import {caseSpec} from '../benchmark/v4/model.ts';
import {validateProductionPlan} from '../scripts/v0/optimizer/repertoire_policy.ts';
import {planIntentionalRepertoire} from '../scripts/v0/optimizer/intentional_repertoire.ts';
import {requestScore,summarize} from '../benchmark/v6/evaluator.ts';
it('preserves music and balanced layout coverage with disjoint reserved inputs and seeds',()=>{
 const catalog=loadCatalog(),v5=loadV5(),known=new Set(v5.music.map(c=>c.id));
 expect(catalog.cases.filter(c=>c.split==='canonical')).toHaveLength(115);
 expect(catalog.cases.filter(c=>c.split==='confirmation')).toHaveLength(74);
 expect(policy.panelWeights).toEqual(v5Policy.panelWeights);
 expect(policy.confirmationSeeds.every(s=>!policy.seeds.includes(s as any))).toBe(true);
 for(const c of catalog.cases){
  const music=catalog.music.find(m=>m.id===c.sourceId)!;
  if(c.split==='confirmation')expect(known.has(c.sourceId)).toBe(false);
  else expect(music).toEqual(v5.music.find(m=>m.id===c.sourceId));
  const spec=caseSpec(music);
  for(const [seed,plan]of Object.entries(c.plans)){
   expect(validateProductionPlan(spec,plan)).toEqual(plan);
   if(c.panel==='automatic')expect(planIntentionalRepertoire(spec,Number(seed))).toEqual(plan);
   else expect(c.scoredSections[Number(seed)]).toHaveLength(3);
  }
 }
});
it('does not omit bad-motion outcomes from the musical construction headline',()=>{
 const cases=loadCatalog().cases.filter(c=>c.split==='canonical'),seeds=[...policy.seeds];
 const rows=cases.flatMap(c=>seeds.map(seed=>({id:c.id,seed,score:requestScore(900,true,[true]),musicalScore:900,
  valid:true,fulfilled:1,requested:1,trackHash:c.id+seed,motion:{failed:true}})));
 expect(summarize(rows,cases,seeds).headline).toBeCloseTo(900,8);
 expect(()=>summarize(rows.slice(1),cases,seeds)).toThrow();
});
