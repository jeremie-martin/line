/** Preserve complete and adverse research against an explicit frozen V4 reference. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {loadCases,sha} from '../../benchmark/v4/model.ts';
import {loadCases as loadV3} from '../../benchmark/v3/model.ts';
import {summarize} from '../../benchmark/v4/evaluator.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const read=(path:string)=>{const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(bytes):bytes).toString());};
const name=arg('name')!,target=Number(arg('target'));assert.match(name,/^[a-z][a-z0-9-]+$/);assert.ok(Number.isFinite(target)&&target>0&&target<=1000);
const baselinePath=arg('baseline')!,baseRun=read(baselinePath),cases=loadCases(),judge=verifyFrozen(),fingerprint=sha(JSON.stringify(judge));
assert.equal(baseRun.plan.suiteFingerprint,fingerprint);assert.equal(baseRun.plan.profile,'canonical');
assert.deepEqual(summarize(baseRun.rows,cases,baseRun.plan.seeds),baseRun.summary);
const originalIds=new Set(loadV3().map(c=>c.id));
const base=new Map<string,any>(baseRun.rows.filter((r:any)=>r.seed===16).map((r:any)=>[r.sourceId,r]));
const studies:any[]=[],unfinished:any[]=[],aborted:any[]=[];
for(const category of ['full','pilots','teachers']){
  const root=resolve('generated/benchmark-v4',name,category);if(!existsSync(root))continue;
  for(const studyName of readdirSync(root).sort()){
    const directory=resolve(root,studyName),planPath=resolve(directory,'plan.json'),path=resolve(directory,'run.json.gz');
    if(!existsSync(planPath))continue;
    const plan=read(planPath);assert.equal(plan.suite,'v4');assert.deepEqual(plan.judge,judge);
    const planSha256=sha(readFileSync(planPath));
    if(!existsSync(path)){
      const record={category,name:studyName,planSha256,completedCells:plan.sources.filter((id:string)=>existsSync(resolve(directory,id+'.json.gz.sha256'))).length,total:plan.sources.length};
      const abortPath=resolve(directory,'aborted.json');
      if(existsSync(abortPath))aborted.push({...record,reason:JSON.parse(readFileSync(abortPath,'utf8')).reason,abortSha256:sha(readFileSync(abortPath))});
      else unfinished.push(record);
      continue;
    }
    const run=read(path);assert.deepEqual(run.plan,plan);assert.equal(plan.seed,16);
    assert.equal(run.rows.length,plan.sources.length);assert.deepEqual(run.rows.map((r:any)=>r.sourceId),plan.sources);
    assert.equal(new Set(plan.sources).size,plan.sources.length);assert.ok(plan.sources.every((id:string)=>base.has(id)));
    const full=plan.sources.length===cases.length;
    if(full)assert.deepEqual(summarize(run.rows,cases,[16]),run.summary);else assert.ok(!('headline' in run.summary));
    const panels=full?Object.fromEntries([['v3',true],['extension',false]].map(([panelName,original])=>{
      const selected=cases.filter(c=>originalIds.has(c.id)===original),ids=new Set(selected.map(c=>c.id));
      const summary=summarize(run.rows.filter((r:any)=>ids.has(r.sourceId)),selected,[16]);
      return [panelName,{headline:summary.headline,valid:summary.valid,runs:summary.runs}];
    })):undefined;
    const paired=run.rows.map((r:any)=>{const b=base.get(r.sourceId),frames=r.resources.physicalFrames;
      assert.ok(Number.isSafeInteger(frames)&&frames>=0&&frames<=plan.budget);
      return {id:r.sourceId,before:b.score.score,after:r.score.score,delta:Math.round((r.score.score-b.score.score)*10000)/10000,
        valid:r.score.valid,physicalFrames:frames,trackHash:r.trackHash,sameTrack:r.trackHash===b.trackHash,
        failure:r.failure,backtracks:r.backtracks,planningFrames:r.lookaheadStats?.physicsFrames};});
    const patch=readFileSync(resolve(directory,'compiler.patch')),patchSha=sha(patch);
    let preservedPatch:string|undefined;
    if(patch.length&&patch.length<=100000){preservedPatch=`benchmark/v4/studies/prototypes/${patchSha}.patch`;mkdirSync('benchmark/v4/studies/prototypes',{recursive:true});writeFileSync(preservedPatch,patch);writeFileSync(preservedPatch+'.sha256',patchSha+'\n');}
    studies.push({category,name:studyName,path,sha256:sha(readFileSync(path)),planSha256,compiler:plan.compiler.candidateFingerprint,
      head:plan.compiler.head,budget:plan.budget,options:plan.options,modelSha256:plan.modelSha256,valueModelSha256:plan.valueModelSha256,
      fixedStudentReplay:!!plan.options.replayControlPath,
      ...(plan.options.replayControlPath?{headlineMeaning:'Fixed student replay, not the score of the queried controls.'}:{}),
      cases:paired.length,fullSuite:full,...(full?{headline:run.summary.headline,panels}:{}),valid:paired.filter((r:any)=>r.valid).length,
      improved:paired.filter((r:any)=>r.delta>0).length,regressed:paired.filter((r:any)=>r.delta<0).length,
      physicalFrames:paired.reduce((s:number,r:any)=>s+r.physicalFrames,0),paired,
      compilerPatch:{sha256:patchSha,bytes:patch.length,preservedPath:preservedPatch}});
  }
}
const result={schema:'line.arc-v4-campaign-research.v1',name,target,baseline:{path:baselinePath,sha256:sha(readFileSync(baselinePath)),headline:baseRun.summary.headline},
  suiteFingerprint:fingerprint,scriptSha256:sha(readFileSync(import.meta.filename)),
  note:'Development research. Partial diagnostics have no headline. Higher-budget teachers do not qualify. Public confirmation requires all 176 specifications and seeds 16/17 at 750k actual physics frames. Unfinished studies are not results.',studies,unfinished,aborted};
mkdirSync('benchmark/v4/studies',{recursive:true});const out=`benchmark/v4/studies/${name}-research.json`,body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({studies:studies.map(s=>({name:s.name,budget:s.budget,cases:s.cases,headline:s.headline,valid:s.valid})),unfinished},null,2));
