import {describe,it,expect} from 'vitest';
import {planRepertoire,validateProductionPlan} from '../scripts/v0/optimizer/repertoire_policy.ts';
import {inspectConstruction} from '../scripts/v0/optimizer/repertoire_realization.ts';
const spec={duration:18,contacts:Array.from({length:24},(_,i)=>({t:.5+i*.7}))};
describe('automatic production policy',()=>{
  it('is repeatable, covers endings, and varies actual zero-jitter plans',()=>{
    const plans=Array.from({length:20},(_,s)=>planRepertoire(spec,s));
    expect(plans[3]).toEqual(planRepertoire(spec,3));
    expect(new Set(plans.map(p=>JSON.stringify(p.requests))).size).toBe(20);
    for(const p of plans){expect(validateProductionPlan(spec,p)).toEqual(p);expect(p.requests).toHaveLength(25);}
  });
  it('keeps unguided passages ordinary and honors broad creative amounts',()=>{
    for(let seed=0;seed<30;seed++)for(const r of planRepertoire(spec,seed).requests)
      if(r.guidance==='forbidden')expect(r.construction).toBe('arcs');
    expect(planRepertoire(spec,2,{variation:0}).requests.every(r=>r.construction==='arcs')).toBe(true);
    expect(planRepertoire(spec,2,{guidedBalance:0,variation:0}).requests.slice(1).every(r=>r.guidance==='forbidden')).toBe(true);
    expect(()=>planRepertoire(spec,1,{repertoire:[]})).toThrow();
    expect(planRepertoire(spec,3,{repertoire:['scattered']}).requests.slice(1).every(r=>r.construction==='scattered')).toBe(true);
  });
  it('rejects mismatched timeline and contradictory phrase requests',()=>{
    const p=planRepertoire(spec,3);p.requests[2].frame++;
    expect(()=>validateProductionPlan(spec,p)).toThrow();
    const q=planRepertoire(spec,3);q.phrases[0].count++;
    expect(()=>validateProductionPlan(spec,q)).toThrow();
  });
  it('ends repeated constructions at existing authored phase boundaries',()=>{
    const p=planRepertoire(spec,7,{},[0,4,8,12]);
    for(const t of [4,8,12]){
      const boundary=p.requests.find(r=>r.section>0&&r.frame>=t*40)!.section;
      expect(p.phrases.some(f=>f.first===boundary)).toBe(true);
    }
  });
});
describe('functional construction realization',()=>{
  const lines=[{id:1000,type:0,x1:-10,y1:0,x2:0,y2:0},
    {id:1001,type:0,x1:0,y1:0,x2:30,y2:0},{id:1002,type:0,x1:30,y1:0,x2:60,y2:20},
    {id:1003,type:0,x1:60,y1:20,x2:90,y2:20},{id:1004,type:0,x1:30,y1:-12,x2:0,y2:-12}];
  const request={section:0,frame:1,next:30,construction:'fold' as const,guidance:'required' as const};
  it('distinguishes actual ordered traversal from decorative or bypassed folds',()=>{
    expect(inspectConstruction(request,lines,new Set([1004]),[[1001],[1002,1004],[1003]]).fulfilled).toBe(true);
    expect(inspectConstruction(request,lines,new Set([1004]),[[1001],[1004],[1003]]).reasons).toContain('bypassed-shape');
    expect(inspectConstruction(request,lines,new Set([1004]),[[1001],[1002],[1003]]).reasons).toContain('unused-or-missing-guide');
    expect(inspectConstruction(request,lines,new Set([1004]),[[1003],[1004],[1002],[1001]]).reasons).toContain('bypassed-shape');
  });
});
