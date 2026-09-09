/** Compact successful and adverse V3 campaign evidence; raw studies stay local. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {loadCases,sha} from '../../benchmark/v3/model.ts';
import {summarize} from '../../benchmark/v3/evaluator.ts';
const root='generated/benchmark-v3/arc-900';
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse((p.endsWith('.gz')?gunzipSync(b):b).toString());};
const cases=loadCases(),baseline=read('benchmark/v3/runs/initial-after.json.gz');
const base=new Map(baseline.rows.filter((r:any)=>r.seed===16).map((r:any)=>[r.sourceId,r]));
const studies=readdirSync(root).sort().flatMap(name=>{
  const path=`${root}/${name}/run.json.gz`;if(!existsSync(path))return[];
  const run=read(path);assert.equal(run.plan.seed,16);assert.equal(run.plan.budget,750000);
  const full=run.rows.length===cases.length,summary=full?summarize(run.rows,cases,[16]):null;
  if(full)assert.deepEqual(summary,run.summary);
  const paired=run.rows.map((r:any)=>({id:r.sourceId,score:r.score.score,delta:r.score.score-(base.get(r.sourceId) as any).score.score,valid:r.score.valid,
    physicalFrames:r.stats.sim_frames,trackHash:r.trackHash}));
  assert.ok(paired.every((r:any)=>r.physicalFrames<=750000));
  return [{name,path,sha256:sha(readFileSync(path)),compiler:run.plan.compiler.candidateFingerprint,head:run.plan.compiler.head,
    options:run.plan.options,modelSha256:run.plan.modelSha256??null,valueModelSha256:run.plan.valueModelSha256??null,cases:paired.length,valid:paired.filter((r:any)=>r.valid).length,
    headline:summary?.headline??null,strata:summary?.strata??null,
    arithmeticMean:paired.reduce((s:number,r:any)=>s+r.score,0)/paired.length,
    improved:paired.filter((r:any)=>r.delta>0).length,regressed:paired.filter((r:any)=>r.delta<0).length,
    totalPhysicalFrames:paired.reduce((s:number,r:any)=>s+r.physicalFrames,0),paired,
    finalizationRecovery:run.finalizationRecovery??null}];
});
const record={schema:'line.arc-v3-900-research.v1',status:'active',target:900,
  baseline:{headline:baseline.summary.headline,commit:baseline.plan.compiler.commit,seeds:baseline.plan.seeds,suiteFingerprint:baseline.plan.suiteFingerprint},
  note:'These are exposed development studies. Single-seed full-suite readings require canonical two-seed confirmation through the public compiler. Partial panels have no headline. Failed physical runs retain zero scores. Search/model choices must be tested together, not added arithmetically.',
  bestFullSuiteResearch:Math.max(...studies.flatMap(s=>s.headline===null?[]:[s.headline])),studies,
  constraints:['Frozen V3 inputs, scorer, detector, physics and actual-frame allowance.','Substantial coherent normal arcs; no acceleration or isolated controls.','No new owner audiovisual approval.','Large raw studies and models remain local until a selected compiler artifact is published.']};
mkdirSync('benchmark/v3/studies',{recursive:true});
const body=JSON.stringify(record,null,2)+'\n',out='benchmark/v3/studies/arc-900-research.json';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({studies:studies.length,best:record.bestFullSuiteResearch,out}));
