/** Predeclared extra-seed panel; same strict production workers and measurements. */
import assert from 'node:assert/strict';
import {mkdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {compilerIdentity} from '../../scripts/lib/compiler_identity.ts';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';
import {SONGS,resolveCase,evaluatorIdentity} from '../../tools/eval/inputs.ts';
import {readPlan,readCells,atomicWrite,loadRun,type RunPlan} from '../../tools/eval/records.ts';
const arg=(key:string, fallback:string)=>process.argv.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3)??fallback;
const seeds=[3001,3011,3019,3023,3037,3041,3049,3061],perturbations=[13,14,15,16];
const definitions=[...SONGS.flatMap(song=>seeds.map(seed=>({id:`${song}~${seed}`,song,seed,perturbation:null}))),
 ...SONGS.flatMap(song=>perturbations.map(p=>({id:`${song}~3001~p${p}`,song,seed:3001,perturbation:p})))];
const out=resolve('generated/eval',arg('name','quality-final-baseline')),jobs=Number(arg('jobs','8'));
assert.ok(Number.isSafeInteger(jobs)&&jobs>0&&jobs<=64);
const planned=async():Promise<RunPlan>=>({schema:'line.eval.v2',identity:compilerIdentity('.'),evaluator:evaluatorIdentity(),
 jolt:-15,mode:'strike3',budget:'standard',panelName:'quality-20261006-passive-confirmation',panel:await Promise.all(definitions.map(async c=>(await resolveCase(c,-15)).planned))});
const plan=await planned();mkdirSync(join(out,'cells'),{recursive:true});const release=lockArtifacts(out);
try{
 if(existsSync(join(out,'run.json')))assert.deepEqual(readPlan(out),plan);else atomicWrite(join(out,'run.json'),JSON.stringify(plan));
 const present=readCells(out,plan),queue=plan.panel.filter(c=>!present.has(c.id)),failures:string[]=[];let done=present.size;
 await Promise.all(Array.from({length:Math.min(jobs,queue.length)},async()=>{while(queue.length){const c=queue.shift()!;
 try{await new Promise<void>((ok,fail)=>{const p=spawn(process.execPath,['--import','tsx','tools/eval/eval.ts','worker',`--case=${c.id}`,`--name=${out}`],{env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore','ignore','inherit']});p.once('error',fail);p.once('exit',(code,signal)=>code===0?ok():fail(Error(String(code??signal))))});console.log(`${++done}/48 ${c.id}`)}catch(e){failures.push(`${c.id}: ${e}`)}
 }}));
 assert.deepEqual(await planned(),plan);assert.deepEqual(failures,[],'failed workers');console.log(`${loadRun(out).cells.size}/48 complete records`);
}finally{release()}
