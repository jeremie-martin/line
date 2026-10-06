/** Resume the same frozen catalog worker/plan with a different execution width. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';
const out='/tmp/line-quality-catalog-panel-20261006',worker=new URL('./catalog-panel.ts',import.meta.url).pathname;
const digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const plan=JSON.parse(readFileSync(join(out,'plan.json'),'utf8'));
assert.equal(digest(readFileSync(worker,'utf8')),plan.study,'frozen worker changed');
const release=lockArtifacts(out),failures:string[]=[];
try{
 const queue=plan.work.map((w:any,i:number)=>({w,i}));let done=0;
 writeFileSync(join(out,'execution-resume.json'),JSON.stringify({at:new Date().toISOString(),workerSha256:plan.study,planSha256:digest(plan),pairs:12,reason:'Additional machine memory became available. Resume identical frozen workers and inputs; no remeasurement or relabeling of completed results.'}));
 await Promise.all(Array.from({length:12},async()=>{while(queue.length){
  const {w,i}=queue.shift()!;
  await Promise.all(Object.entries(plan.roots).map(async([label,root])=>{
   const file=join(out,label,`${w.id}~${w.seed}.json`);
   if(existsSync(file)){
    const r=JSON.parse(readFileSync(file,'utf8'));assert.equal(r.planSha256,digest(plan));assert.equal(r.inputSha256,w.inputSha256);
    assert.ok(existsSync(join(out,label,`${w.id}~${w.seed}.checkpoint.json.gz`)));return;
   }
   try{await new Promise<void>((ok,fail)=>{
    const p=spawn(process.execPath,['--max-old-space-size=4096','--import','tsx',worker,'worker',label,String(i)],{cwd:String(root),stdio:['ignore','ignore','inherit']});
    p.once('error',fail);p.once('exit',(c,s)=>c===0?ok():fail(Error(String(c??s))));
   });}catch(e){failures.push(`${label}/${w.id}~${w.seed}: ${e}`);}
  }));
  console.log(`${++done}/${plan.work.length} pairs ${w.id}~${w.seed}`);
 }}));
 assert.deepEqual(failures,[]);console.log('Complete paired catalog; original frozen workers and plan preserved');
}finally{release();}
