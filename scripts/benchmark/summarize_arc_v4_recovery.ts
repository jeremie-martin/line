/** Compact, recomputed evidence for every V4 recovery experiment. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {loadCases,sha} from '../../benchmark/v4/model.ts';
import {summarize} from '../../benchmark/v4/evaluator.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
const read=(path:string)=>{const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(bytes):bytes).toString());};
const baseline=read('benchmark/v4/baseline.json'),baseRun=read(baseline.archive.path),cases=loadCases(),judge=verifyFrozen();
const base=new Map<string,any>(baseRun.rows.filter((r:any)=>r.seed===16).map((r:any)=>[r.sourceId,r]));
const studies:any[]=[],unfinished:any[]=[];
for(const category of ['recovery-final','teachers-final']){
  const root=resolve('generated/benchmark-v4',category);if(!existsSync(root))continue;
  for(const name of readdirSync(root).sort()){
    const directory=resolve(root,name),planPath=resolve(directory,'plan.json'),path=resolve(directory,'run.json.gz');
    if(!existsSync(planPath))continue;
    const plan=read(planPath);assert.equal(plan.suite,'v4');assert.deepEqual(plan.judge,judge);
    if(!existsSync(path)){unfinished.push({category,name,planSha256:sha(readFileSync(planPath)),completedCells:plan.sources.filter((id:string)=>existsSync(resolve(directory,id+'.json.gz'))).length,total:plan.sources.length});continue;}
    const run=read(path);assert.deepEqual(run.plan,plan);assert.equal(plan.seed,16);
    assert.equal(run.rows.length,plan.sources.length);assert.deepEqual(run.rows.map((r:any)=>r.sourceId),plan.sources);
    assert.equal(new Set(plan.sources).size,plan.sources.length);assert.ok(plan.sources.every((id:string)=>base.has(id)));
    const full=plan.sources.length===cases.length;
    if(full)assert.deepEqual(summarize(run.rows,cases,[16]),run.summary);else assert.ok(!('headline' in run.summary));
    const paired=run.rows.map((r:any)=>{const b=base.get(r.sourceId),frames=r.resources.physicalFrames;
      assert.ok(Number.isSafeInteger(frames)&&frames>=0&&frames<=plan.budget);
      return {id:r.sourceId,before:b.score.score,after:r.score.score,delta:Math.round((r.score.score-b.score.score)*10000)/10000,
        valid:r.score.valid,physicalFrames:frames,trackHash:r.trackHash,sameTrack:r.trackHash===b.trackHash,sameFrames:frames===b.resources.physicalFrames,
        failure:r.failure,backtracks:r.backtracks,planningFrames:r.lookaheadStats?.physicsFrames};});
    const patchPath=resolve(directory,'compiler.patch'),patch=readFileSync(patchPath),patchSha=sha(patch);
    let preservedPatch:string|undefined;
    if(patch.length&&patch.length<=100000){preservedPatch=`benchmark/v4/studies/prototypes/${patchSha}.patch`;mkdirSync('benchmark/v4/studies/prototypes',{recursive:true});writeFileSync(preservedPatch,patch);writeFileSync(preservedPatch+'.sha256',patchSha+'\n');}
    studies.push({category,name,path,sha256:sha(readFileSync(path)),planSha256:sha(readFileSync(planPath)),compiler:plan.compiler.candidateFingerprint,
      head:plan.compiler.head,budget:plan.budget,options:plan.options,modelSha256:plan.modelSha256,valueModelSha256:plan.valueModelSha256,
      cases:paired.length,fullSuite:full,...(full?{headline:run.summary.headline}:{}),valid:paired.filter((r:any)=>r.valid).length,
      improved:paired.filter((r:any)=>r.delta>0).length,regressed:paired.filter((r:any)=>r.delta<0).length,
      physicalFrames:paired.reduce((s:number,r:any)=>s+r.physicalFrames,0),paired,
      compilerPatch:{sha256:patchSha,bytes:patch.length,preservedPath:preservedPatch}});
  }
}
const result={schema:'line.arc-v4-recovery-research.v1',baseline:{path:baseline.archive.path,headline:baseline.summary.headline},
  recoveryTarget:baseline.recoveryTarget,suiteFingerprint:baseRun.plan.suiteFingerprint,
  note:'Exposed development research. Partial diagnostics have no headline. Higher-budget teachers do not count toward the 750k recovery goal. All complete experiments and regressions are retained; public canonical confirmation uses all 176 cases and seeds 16/17.',studies,unfinished};
mkdirSync('benchmark/v4/studies',{recursive:true});const out='benchmark/v4/studies/recovery-research.json',body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify(studies.map(s=>({name:s.name,budget:s.budget,cases:s.cases,headline:s.headline,valid:s.valid})),null,2));
