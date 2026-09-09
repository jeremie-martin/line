/** Compiler research on frozen V3 inputs. Partial pilots never publish a headline. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,openSync,closeSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadCases,caseSpec,sha} from '../../benchmark/v3/model.ts';
import {evaluateTrack,summarize} from '../../benchmark/v3/evaluator.ts';
import {compileArcMotion} from '../v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../v0/optimizer/connected_arcs.ts';
import {compilerCandidateIdentity} from '../v0/benchmark_v2/compiler_identity.ts';

const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const write=(path:string,value:unknown)=>{mkdirSync(dirname(path),{recursive:true});const plain=JSON.stringify(value)+'\n',b=path.endsWith('.gz')?gzipSync(plain):Buffer.from(plain),tmp=path+'.'+process.pid+'.tmp';writeFileSync(tmp,b);renameSync(tmp,path);writeFileSync(path+'.sha256',sha(b)+'\n');};
const read=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(b):b).toString());};
const out=resolve(arg('out')!),all=loadCases();
// Repository-wide status is descriptive metadata, not executable identity.
const compilerIdentity=()=>{const {trackedChanges,...identity}=compilerCandidateIdentity('wasm');return identity;};
if(arg('worker')){
  const plan=read(resolve(out,'plan.json')),c=all.find(c=>c.id===arg('worker'))!;assert.ok(c);
  const spec=caseSpec(c),options={...connectedArcOptions(spec,plan.budget),...plan.options};
  if(options.controlPolicyPath)options.controlPolicy=JSON.parse(readFileSync(options.controlPolicyPath,'utf8'));
  const began=performance.now(),result=compileArcMotion(spec,plan.seed,options),compileMs=performance.now()-began;
  assert.ok(result.stats.sim_frames<=plan.budget);
  const evaluation=evaluateTrack(c,result.track);
  const row={schema:'line.arc-v3-study.cell.v1',sourceId:c.id,seed:plan.seed,planSha256:sha(readFileSync(resolve(out,'plan.json'))),trackHash:sha(JSON.stringify(result.track)),...evaluation,
    compileMs,resources:{physicalFrames:result.stats.sim_frames},...result};
  write(resolve(out,c.id+'.json.gz'),row);
  console.log(JSON.stringify({source:c.id,score:row.score.score,valid:row.score.valid,frames:result.stats.sim_frames,compileMs}));
}else{
  const sources=arg('sources')?.split(',')??all.map(c=>c.id),jobs=Number(arg('jobs')??16),seed=Number(arg('seed')??16),budget=Number(arg('budget')??750000);
  assert.ok(sources.length&&new Set(sources).size===sources.length&&sources.every(id=>all.some(c=>c.id===id)));
  const options=JSON.parse(arg('options')??'{}'),identity=compilerIdentity();
  const judgeFiles=JSON.parse(readFileSync('generated/benchmark-v3/validated-852/plan.json','utf8')).judge.files;
  for(const [p,h] of Object.entries(judgeFiles))assert.equal(sha(readFileSync(p)),h,`judge changed: ${p}`);
  const plan={schema:'line.arc-v3-study.plan.v1',researchOnly:true,sources,seed,budget,options,
    compiler:identity,judgeFiles,scriptSha256:sha(readFileSync(import.meta.filename)),
    ...(options.controlPolicyPath?{modelSha256:sha(readFileSync(options.controlPolicyPath))}:{})};
  mkdirSync(out,{recursive:true});
  if(existsSync(resolve(out,'plan.json')))assert.deepEqual(read(resolve(out,'plan.json')),plan);else write(resolve(out,'plan.json'),plan);
  // Save the compiler diff once per panel; models are already hash-bound by identity.
  writeFileSync(resolve(out,'compiler.patch'),execFileSync('git',['diff','--binary','HEAD','--','scripts/v0/optimizer'],{maxBuffer:128*1024*1024}));
  const queue=sources.slice(),failed:string[]=[];let completed=0;
  await Promise.all(Array.from({length:Math.min(jobs,queue.length)},async()=>{
    while(queue.length){const id=queue.shift()!,path=resolve(out,id+'.json.gz');
      if(!existsSync(path)){
        const log=openSync(resolve(out,id+'.log'),'w');
        try{const code=await new Promise<number|null>((done,reject)=>{const p=spawn(process.execPath,['--import','tsx',import.meta.filename,`--worker=${id}`,`--out=${out}`],{env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore',log,log]});p.once('error',reject);p.once('exit',done);});if(code!==0)failed.push(id);}finally{closeSync(log);}
      }
      completed++;if(completed%8===0)console.log(JSON.stringify({completed,total:sources.length,failures:failed.length}));
    }
  }));
  assert.deepEqual(compilerIdentity(),identity,'compiler changed during study');
  for(const [p,h] of Object.entries(judgeFiles))assert.equal(sha(readFileSync(p)),h);
  assert.equal(sha(readFileSync(import.meta.filename)),plan.scriptSha256);
  if(failed.length){write(resolve(out,'execution-failures.json'),failed);throw new Error(`execution failures: ${failed}`);}
  const rows=sources.map(id=>read(resolve(out,id+'.json.gz')));for(const r of rows)assert.equal(r.planSha256,sha(readFileSync(resolve(out,'plan.json'))));
  const compact=rows.map(({track,report,rows,...r}:any)=>r);
  const summary=sources.length===all.length?summarize(rows,all,[seed]):{pilot:true,cases:rows.map(r=>({id:r.sourceId,score:r.score.score,valid:r.score.valid})),mean:rows.reduce((s,r)=>s+r.score.score,0)/rows.length};
  write(resolve(out,'run.json.gz'),{plan,summary,rows:compact});
  console.log(JSON.stringify(summary));
}
