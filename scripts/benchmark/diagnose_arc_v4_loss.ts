/** Frozen-score counterfactuals identify remaining loss, never compiler results. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {loadCases,sha} from '../../benchmark/v4/model.ts';
import {scoreObservations,summarize} from '../../benchmark/v4/evaluator.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
const read=(path:string)=>{const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(bytes):bytes).toString());};
const baseline=read('benchmark/v4/baseline.json'),run=read(baseline.archive.path),cases=loadCases();
assert.equal(run.plan.suiteFingerprint,sha(JSON.stringify(verifyFrozen())));
assert.deepEqual(summarize(run.rows,cases,[16,17]),run.summary);
const original=cases.slice(0,88),extension=cases.slice(88);
const panels={all:cases,v3:original,extension};
const counterfactuals=[];
for(const selected of ['air','speed','impact','amplitude','tail']){
  const rows=run.rows.map((r:any)=>({...r,score:scoreObservations(r.observations.map((o:any)=>
    (selected==='tail'?o.tail:o.axis===selected)?{...o,error:0,achieved:o.target}:o),r.score.hardFailures)}));
  const scores=Object.fromEntries(Object.entries(panels).map(([name,panel])=>{
    const ids=new Set(panel.map(c=>c.id)),before=summarize(run.rows.filter((r:any)=>ids.has(r.sourceId)),panel,[16,17]).headline;
    const after=summarize(rows.filter((r:any)=>ids.has(r.sourceId)),panel,[16,17]).headline;
    return [name,{before,hypothetical:after,potentialDifference:Math.round((after-before)*10000)/10000}];
  }));
  counterfactuals.push({errorsSetToZero:selected,panels:scores});
}
const byCase=run.rows.filter((r:any)=>r.seed===16).map((r:any)=>{
  const loss=(tailOnly:boolean)=>Object.entries(r.score.components).reduce((sum,[axis,c]:[string,any])=>{
    const numerator=r.observations.filter((o:any)=>o.axis===axis&&(!tailOnly||o.tail))
      .reduce((s:number,o:any)=>s+o.error**2*(axis==='impact'?1:o.endFrame-o.startFrame),0);
    return sum+c.weight*numerator/c.weightSum;
  },0);
  const total=loss(false),tail=loss(true);assert.ok(Math.abs(total-r.score.weightedAxisRms**2)<1e-10);
  return {id:r.sourceId,score:r.score.score,squaredLoss:total,tailSquaredLoss:tail,tailShare:total?tail/total:0,
    components:r.score.components,physicalFrames:r.resources.physicalFrames};
});
const result={schema:'line.arc-v4-baseline-loss-diagnosis.v1',baselinePath:baseline.archive.path,baselineSha256:sha(readFileSync(baseline.archive.path)),
  suiteFingerprint:run.plan.suiteFingerprint,scriptSha256:sha(readFileSync(import.meta.filename)),counterfactuals,
  note:'These optimistic frozen-score counterfactuals set selected observed errors to zero. They do not establish joint attainability or a compiler score, and potential differences cannot be added.',
  casePooledTailShare:byCase.reduce((s:number,r:any)=>s+r.tailSquaredLoss,0)/byCase.reduce((s:number,r:any)=>s+r.squaredLoss,0),
  poolingNote:'The pooled tail fraction is diagnostic, not the hierarchical headline weight.',byCase};
const out='benchmark/v4/studies/baseline-loss-diagnosis.json',body=JSON.stringify(result,null,2)+'\n';mkdirSync('benchmark/v4/studies',{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({counterfactuals,casePooledTailShare:result.casePooledTailShare},null,2));
