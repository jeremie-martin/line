/** Static verification only: no compiler, candidate score or learned model. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadCases,caseGaps,caseSpec,targets,sha} from '../../benchmark/v4/model.ts';
import {loadCases as loadV3} from '../../benchmark/v3/model.ts';
import {policy} from '../../benchmark/v4/policy.ts';
import {policy as oldPolicy} from '../../benchmark/v3/policy.ts';
import {validateSpec,effectiveAxes} from '../v0/core/substrate.ts';
const cases=loadCases(),old=loadV3(),lock=JSON.parse(readFileSync('benchmark/v4/catalog.lock.json','utf8'));
assert.equal(cases.length,176);assert.deepEqual(cases.slice(0,88),old);
assert.equal(lock.authoringSourceSha256,sha(readFileSync('scripts/benchmark/v4_author.ts')));
assert.equal(lock.policySha256,sha(readFileSync('benchmark/v4/policy.ts')));
for(const key of ['budget','seeds','axisWeights','tolerance','spanWeight','impactWeight','includeTail','material','strata','aggregation'] as const)
  assert.deepEqual(policy[key],oldPolicy[key],key);
let maximumTargetDiscrepancy=0,intervals=0;
const rows=cases.map(c=>{
  const spec=caseSpec(c),gaps=caseGaps(c);validateSpec(spec);
  assert.equal(c.air.length,gaps.length);assert.ok(c.contacts[0].frame>=6);
  assert.ok(c.contacts.at(-1)!.frame<c.durationFrames);
  assert.ok(c.phases.every(p=>p.start>=0&&p.end>=p.start&&p.end<=c.durationFrames/40+1e-9));
  assert.ok(policy.strata.find(s=>s.id===c.stratum)?.groups.some(g=>g.id===c.group));
  for(const values of Object.values(c.samples)){
    assert.equal(values.length,c.durationFrames+1);
    assert.ok(values.every(x=>x===null||Number.isFinite(x)&&x>=0&&x<=1));
  }
  for(const g of gaps){
    intervals++;const a=c.air[g.index],n=g.endFrame-g.startFrame+1;
    assert.equal(a.samples,n);assert.ok(Number.isInteger(a.airborneFrames));assert.equal(a.target,a.airborneFrames/n);
    assert.ok(a.airborneFrames>=(g.endsWithContact?n-1>6?6:1:0)&&a.airborneFrames<=n-2);
    const actual=effectiveAxes(g,spec),frozen=targets(c,g);
    for(const axis of ['air','speed','amplitude'] as const){
      if(frozen[axis]===undefined){assert.equal(actual[axis],undefined);continue;}
      const delta=Math.abs(actual[axis]!-frozen[axis]!);maximumTargetDiscrepancy=Math.max(maximumTargetDiscrepancy,delta);assert.ok(delta<1e-10);
    }
    if(!g.endsWithContact)assert.equal(frozen.impact,undefined);
  }
  return {id:c.id,parentId:c.parentId,group:c.group,stratum:c.stratum,durationSeconds:c.durationFrames/40,
    contacts:c.contacts.length,minimumContactGap:Math.min(...gaps.filter(g=>g.endsWithContact).map(g=>(g.endFrame-g.startFrame)/40)),
    maximumContactGap:Math.max(...gaps.filter(g=>g.endsWithContact).map(g=>(g.endFrame-g.startFrame)/40)),
    endingSeconds:(c.durationFrames-c.contacts.at(-1)!.frame)/40,
    targetHash:sha(JSON.stringify({contacts:c.contacts,samples:c.samples,air:c.air.map(a=>a.target),duration:c.durationFrames})),
    airQuantization:Math.max(...c.air.map(a=>Math.abs(a.requested-a.target)))};
});
assert.equal(new Set(cases.map(c=>c.id)).size,176);assert.equal(new Set(rows.map(r=>r.targetHash)).size,176);
for(const source of old){
  const companion=cases.find(c=>c.id==='stretch_'+source.id)!;assert.ok(companion);
  for(const key of ['parentId','group','stratum'] as const)assert.equal(companion[key],source[key]);
}
const result={schema:'line.benchmark-v4.static-audit.v1',compilerOutcomesConsulted:false,cases:176,unchangedV3Cases:88,
  exactOriginalCaseObjects:true,oneCompanionPerOriginal:true,aggregationParents:new Set(cases.map(c=>c.parentId)).size,
  unchangedScoringAndBudget:true,distinctInputs:176,intervals,maximumTargetDiscrepancy,
  inputSha256:lock.specificationsSha256,rows,
  limits:['Necessary discrete-air/sample conditions do not prove joint physical feasibility.',
    'The 88 companions are related development programs, not 88 independent musical works.',
    'No new audiovisual approval or independent generalization claim.']};
const body=JSON.stringify(result,null,2)+'\n';writeFileSync('benchmark/v4/static-audit.json',body);writeFileSync('benchmark/v4/static-audit.json.sha256',sha(body)+'\n');
console.log(JSON.stringify({cases:176,unchanged:88,intervals,maximumTargetDiscrepancy}));
