/** Full or explicitly partial compiler studies against a versioned frozen judge. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,openSync,closeSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadArcCases,requestedArcSuite,caseSpec,sha} from './arc_suite.ts';
import {evaluateTrack,summarize} from '../../benchmark/v3/evaluator.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const write=(path:string,value:unknown)=>{
  mkdirSync(dirname(path),{recursive:true});const plain=JSON.stringify(value)+'\n';
  const bytes=path.endsWith('.gz')?gzipSync(plain):Buffer.from(plain),tmp=path+'.'+process.pid+'.tmp';
  writeFileSync(tmp,bytes);renameSync(tmp,path);writeFileSync(path+'.sha256',sha(bytes)+'\n');
};
const read=(path:string)=>{const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(bytes):bytes).toString());};
const suite=requestedArcSuite(),out=resolve(arg('out')!),all=loadArcCases(suite);
const identity=(root:string)=>JSON.parse(execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',
  'import {compilerCandidateIdentity} from "./scripts/v0/benchmark_v2/compiler_identity.ts"; const {trackedChanges,...identity}=compilerCandidateIdentity("wasm"); console.log(JSON.stringify(identity));'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}));
const judge=()=>suite==='v4'?verifyFrozen():{
  files:JSON.parse(readFileSync('generated/benchmark-v3/validated-852/plan.json','utf8')).judge.files};
if(arg('worker')){
  const plan=read(resolve(out,'plan.json')),c=all.find(c=>c.id===arg('worker'))!;assert.ok(c);assert.equal(plan.suite,suite);
  const {compileArcMotion}=await import(pathToFileURL(resolve(plan.compilerRoot,'scripts/v0/optimizer/arc_motion.ts')).href);
  const {connectedArcOptions,parseArcPolicyArtifact}=await import(pathToFileURL(resolve(plan.compilerRoot,'scripts/v0/optimizer/connected_arcs.ts')).href);
  const spec=caseSpec(c),options={...connectedArcOptions(spec,plan.budget),...plan.options};
  for(const [option,target,hash] of [['controlPolicyPath','controlPolicy','modelSha256'],['valueModelPath','futureValueModel','valueModelSha256']] as const){
    if(options[option]){
      const bytes=readFileSync(options[option]);assert.equal(sha(bytes),plan[hash]);
      const artifact=JSON.parse(bytes.toString());
      options[target]=artifact.schema==='line.arc-compressed-policy.v1'?
        parseArcPolicyArtifact(bytes,pathToFileURL(resolve(options[option]))):artifact;
    }
  }
  const replay=options.replayControlPath?read(options.replayControlPath):undefined;
  if(replay){assert.equal(sha(readFileSync(options.replayControlPath)),plan.replaySha256);options.replayControls=replay.cases[c.id].controls;}
  const start=performance.now(),result=compileArcMotion(spec,plan.seed,options),compileMs=performance.now()-start;
  assert.ok(result.stats.sim_frames<=plan.budget);
  const trackHash=sha(JSON.stringify(result.track));if(replay)assert.equal(trackHash,replay.cases[c.id].trackHash,'teacher changed student replay');
  const row={schema:'line.arc-study.cell.v2',suite,sourceId:c.id,seed:plan.seed,planSha256:sha(readFileSync(resolve(out,'plan.json'))),
    trackHash,...evaluateTrack(c,result.track),compileMs,resources:{physicalFrames:result.stats.sim_frames},...result};
  write(resolve(out,c.id+'.json.gz'),row);
}else{
  assert.ok(arg('compiler-root'),'research requires an explicit compiler checkout');
  const compilerRoot=resolve(arg('compiler-root')!),sources=arg('sources')?.split(',')??all.map(c=>c.id);
  const jobs=Number(arg('jobs')??16),seed=Number(arg('seed')??16),budget=Number(arg('budget')??750000),options=JSON.parse(arg('options')??'{}');
  assert.ok(Number.isSafeInteger(jobs)&&jobs>0&&jobs<=48&&Number.isSafeInteger(seed)&&Number.isSafeInteger(budget)&&budget>0);
  assert.ok(sources.length&&new Set(sources).size===sources.length&&sources.every(id=>all.some(c=>c.id===id)));
  const compiler=identity(compilerRoot),frozen=judge();
  for(const [path,digest] of Object.entries(frozen.files))assert.equal(sha(readFileSync(path)),digest,path);
  // Reuse is explicit and audited after an authoring erratum. It is allowed only
  // for byte-identical cases, the identical compiler/options/work allowance and
  // unchanged scoring code. Every imported track receives a fresh cold grade.
  const reuseRoot=arg('reuse-from')?resolve(arg('reuse-from')!):undefined;
  let reusePlan:any,reuseCases:any[]|undefined;
  if(reuseRoot){
    assert.ok(arg('reuse-catalog'),'reuse requires the original case catalog');
    reusePlan=read(resolve(reuseRoot,'plan.json'));
    const catalogBytes=readFileSync(arg('reuse-catalog')!),raw=gunzipSync(catalogBytes);reuseCases=JSON.parse(raw.toString());
    assert.equal(sha(raw),reusePlan.judge.inputSha256);assert.deepEqual(reusePlan.compiler,compiler);
    assert.equal(reusePlan.seed,seed);assert.equal(reusePlan.budget,budget);assert.deepEqual(reusePlan.options,options);
    assert.equal(reusePlan.judge.engineSha256,(frozen as any).engineSha256);
    for(const [path,digest] of Object.entries(reusePlan.judge.files))
      if(!['benchmark/v4/catalog.lock.json','benchmark/v4/specifications.json.gz'].includes(path))
        assert.equal((frozen.files as any)[path],digest,'reuse judge changed: '+path);
  }
  const plan={schema:'line.arc-study.plan.v2',researchOnly:true,suite,compilerRoot,compiler,sources,seed,budget,options,judge:frozen,
    scriptSha256:sha(readFileSync(import.meta.filename)),suiteAdapterSha256:sha(readFileSync('scripts/benchmark/arc_suite.ts')),
    ...(options.controlPolicyPath?{modelSha256:sha(readFileSync(options.controlPolicyPath))}:{}),
    ...(options.valueModelPath?{valueModelSha256:sha(readFileSync(options.valueModelPath))}:{}),
    ...(options.replayControlPath?{replaySha256:sha(readFileSync(options.replayControlPath))}:{}),
    ...(reuseRoot?{reuse:{path:reuseRoot,planSha256:sha(readFileSync(resolve(reuseRoot,'plan.json'))),catalogPath:arg('reuse-catalog'),catalogSha256:sha(readFileSync(arg('reuse-catalog')!))}}:{})};
  mkdirSync(out,{recursive:true});
  if(existsSync(resolve(out,'plan.json')))assert.deepEqual(read(resolve(out,'plan.json')),plan);else write(resolve(out,'plan.json'),plan);
  writeFileSync(resolve(out,'compiler.patch'),execFileSync('git',['-C',compilerRoot,'diff','--binary','HEAD','--','scripts/v0/optimizer'],{maxBuffer:128*1024*1024}));
  let reused=0;
  if(reuseRoot)for(const id of sources){
    const target=resolve(out,id+'.json.gz'),path=resolve(reuseRoot,id+'.json.gz');
    if(existsSync(target)||!existsSync(path)||!existsSync(path+'.sha256'))continue;
    const oldCase=reuseCases!.find(c=>c.id===id),current=all.find(c=>c.id===id)!;
    if(JSON.stringify(oldCase)!==JSON.stringify(current))continue;
    const previous=read(path);assert.equal(previous.planSha256,plan.reuse!.planSha256);
    assert.equal(previous.seed,seed);assert.equal(previous.sourceId,id);assert.equal(previous.trackHash,sha(JSON.stringify(previous.track)));
    assert.ok(previous.resources.physicalFrames<=budget);const grade=evaluateTrack(current,previous.track);
    assert.deepEqual(grade.score,previous.score);
    write(target,{...previous,...grade,planSha256:sha(readFileSync(resolve(out,'plan.json'))),
      reusedFrom:{path,sha256:sha(readFileSync(path)),planSha256:previous.planSha256,note:'Exact input/compiler/options parity; fresh cold grade, original compilation work and time retained.'}});reused++;
  }
  if(reuseRoot)console.log(JSON.stringify({reused,remaining:sources.length-reused}));
  const queue=sources.slice(),failed:string[]=[];let completed=0;
  await Promise.all(Array.from({length:Math.min(jobs,queue.length)},async()=>{
    while(queue.length){
      const id=queue.shift()!;
      if(!existsSync(resolve(out,id+'.json.gz'))){
        const log=openSync(resolve(out,id+'.log'),'w');
        try{
          const code=await new Promise<number|null>((done,reject)=>{const child=spawn(process.execPath,['--import','tsx',import.meta.filename,`--suite=${suite}`,`--worker=${id}`,`--out=${out}`],{env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore',log,log]});child.once('error',reject);child.once('exit',done);});
          if(code!==0)failed.push(id);
        }finally{closeSync(log);}
      }
      completed++;if(completed%16===0)console.log(JSON.stringify({completed,total:sources.length,failures:failed.length}));
    }
  }));
  assert.deepEqual(identity(compilerRoot),compiler,'compiler changed during study');assert.deepEqual(judge(),frozen);
  assert.equal(sha(readFileSync(import.meta.filename)),plan.scriptSha256);assert.equal(sha(readFileSync('scripts/benchmark/arc_suite.ts')),plan.suiteAdapterSha256);
  for(const [option,hash] of [['controlPolicyPath','modelSha256'],['valueModelPath','valueModelSha256'],['replayControlPath','replaySha256']] as const)
    if(options[option])assert.equal(sha(readFileSync(options[option])),(plan as any)[hash]);
  if(options.controlPolicyPath){
    const artifact=JSON.parse(readFileSync(options.controlPolicyPath,'utf8'));
    if(artifact.schema==='line.arc-compressed-policy.v1')
      assert.equal(sha(readFileSync(resolve(dirname(options.controlPolicyPath),artifact.file))),artifact.compressedSha256);
  }
  if(failed.length){write(resolve(out,'execution-failures.json'),failed);throw new Error('execution failures; no headline: '+failed.join(','));}
  const rows=sources.map(id=>read(resolve(out,id+'.json.gz')));for(const row of rows)assert.equal(row.planSha256,sha(readFileSync(resolve(out,'plan.json'))));
  const summary=sources.length===all.length?summarize(rows,all,[seed]):{pilot:true,cases:rows.map(r=>({id:r.sourceId,score:r.score.score,valid:r.score.valid}))};
  write(resolve(out,'run.json.gz'),{plan,summary,rows:rows.map(({track,report,rows,...rest}:any)=>rest)});
  console.log(JSON.stringify('headline' in summary?{headline:summary.headline,valid:summary.valid,runs:summary.runs}:summary));
}
