/** Paired research evidence against the published V3 baseline; no rebaselining. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {loadCases,sha} from '../../benchmark/v3/model.ts';
import {summarize,scoreObservations} from '../../benchmark/v3/evaluator.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse((p.endsWith('.gz')?gunzipSync(b):b).toString());};
const baseline=read('benchmark/v3/runs/initial-after.json.gz'),cases=loadCases(),entries=[];
for(const path of arg('runs')!.split(',')){
  const run=read(path),rows=run.rows,seed=run.plan.seed;
  const base=baseline.rows.filter((r:any)=>r.seed===seed&&rows.some((x:any)=>x.sourceId===r.sourceId));
  assert.equal(base.length,rows.length);assert.equal(new Set(rows.map((r:any)=>r.sourceId)).size,rows.length);
  const paired=rows.map((r:any)=>{const b=base.find((b:any)=>b.sourceId===r.sourceId)!;return {id:r.sourceId,before:b.score.score,after:r.score.score,delta:r.score.score-b.score.score,valid:r.score.valid,physicalFrames:r.resources.physicalFrames};}).sort((a:any,b:any)=>a.delta-b.delta);
  const full=rows.length===cases.length,summary=full?summarize(rows,cases,[seed]):null;
  const perfect=(predicate:(o:any)=>boolean)=>full?summarize(rows.map((r:any)=>({...r,score:scoreObservations(r.observations.map((o:any)=>predicate(o)?{...o,error:0}:o),r.score.hardFailures)})),cases,[seed]).headline:null;
  entries.push({path:resolve(path),sha256:sha(readFileSync(path)),options:run.plan.options,compilerFingerprint:run.plan.compiler.candidateFingerprint,
    cases:rows.length,seed,fullSuite:full,summary,improved:paired.filter((r:any)=>r.delta>0).length,regressed:paired.filter((r:any)=>r.delta<0).length,
    arithmeticMeanDelta:paired.reduce((s:number,r:any)=>s+r.delta,0)/paired.length,paired,
    counterfactuals:{note:'Analytical zeroing of observed errors, not attainable tracks; gains are not additive.',perfectTails:perfect(o=>o.tail),perfectAxes:Object.fromEntries(['air','speed','amplitude','impact'].map(a=>[a,perfect(o=>o.axis===a)]))}});
}
const evidence={schema:'line.arc-v3-research-comparison.v1',note:'Single-seed development studies. Partial panels have no headline. Full panels require canonical confirmation through the public compiler.',entries};
if(arg('out')){const p=arg('out')!,b=JSON.stringify(evidence,null,2)+'\n';mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b);writeFileSync(p+'.sha256',sha(b)+'\n');}
console.log(JSON.stringify(entries.map(({path,options,cases,summary,improved,regressed,arithmeticMeanDelta,counterfactuals})=>({path,options,cases,headline:summary?.headline,valid:summary?.valid,improved,regressed,arithmeticMeanDelta,counterfactuals})),null,2));
