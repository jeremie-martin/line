/** Identical saved tracks/work; compare isolated process CPU and peak RSS. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.argv[3],id=process.argv[4],out=process.env.RESOURCE_STUDY_OUT??'/tmp/line-quality-production-resource-study';
const sources={baseline:'/home/wyss/line/generated/eval/quality-20261005-baseline',candidate:'/tmp/line-quality-final-candidate-20261006/generated/eval/quality-development-remeasured'};
const source=sources[(process.argv[5]??'candidate') as keyof typeof sources];
const plan=JSON.parse(readFileSync(join(source,'run.json'),'utf8'));
if(process.argv[2]==='worker'){
 const module=(p:string)=>import(pathToFileURL(join(root,p)).href);
 const {compilerIdentity}=await module('scripts/lib/compiler_identity.ts'),identity=compilerIdentity(root);
 const {resolveCase}=await module('tools/eval/inputs.ts'),c=plan.panel.find((c:any)=>c.id===id);
 const {spec,music,planned}=await resolveCase(c,plan.jolt);assert.deepEqual(planned,c);
 const {compileHandoff}=await module('scripts/v0/optimizer/handoff.ts'),{productionBudget}=await module('scripts/v0/optimizer/production_budget.ts');
 const cpu=process.cpuUsage(),start=performance.now();
 const cp=compileHandoff(spec,c.seed,{budget:productionBudget(spec.duration),creative:{},impactContract:'line.strike.v3',phraseBoundaries:music.phases.map((p:any)=>p.t0??p.t??p.start).filter(Number.isFinite)});
 const elapsed=performance.now()-start,used=process.cpuUsage(cpu),resource=process.resourceUsage();
 const saved=JSON.parse(readFileSync(join(source,'cells',id+'.json'),'utf8')),hash=createHash('sha256').update(JSON.stringify(cp.track)).digest('hex');
 assert.equal(hash,saved.trackHash);assert.equal(cp.repertoire.physicalFrames,saved.physicalFrames);assert.deepEqual(compilerIdentity(root),identity);
 const name=process.argv[5];writeFileSync(join(out,name,id+'.json'),JSON.stringify({id,identity,hash,physicalFrames:cp.repertoire.physicalFrames,wallMs:elapsed,cpuMs:(used.user+used.system)/1000,maxRssKiB:resource.maxRSS}));
}else{
 const roots={baseline:process.env.RESOURCE_BASELINE??'/tmp/line-quality-catalog-baseline-20261006',candidate:process.env.RESOURCE_CANDIDATE??'/tmp/line-quality-final-candidate-20261006'};
 const ids=['luna_bala_44s~101','amor_na_praia_46s~101','tiki_tiki_48s~101','amour_de_ma_vie_44s~101','luna_bala_44s~101~p1','amour_de_ma_vie_44s~101~p1'];
 for(const k of Object.keys(roots))mkdirSync(join(out,k),{recursive:true});
 writeFileSync(join(out,'plan.json'),JSON.stringify({sources:roots,cases:ids,hypothesis:'Compare the frozen coherent compiler to the campaign original on six identical production inputs, with each side required to reproduce its own saved track/work exactly. Record process CPU, wall time and peak RSS. Two pairs run concurrently; wall time is confounded by machine load. Different behavior means this is total compiler cost, not an isolated structural speed-up.'}));
 await Promise.all(Array.from({length:2},async()=>{while(ids.length){const id=ids.shift()!;await Promise.all(Object.entries(roots).map(([label,root])=>new Promise<void>((resolve,reject)=>{
  const p=spawn(process.execPath,['--max-old-space-size=2048','--import','tsx',import.meta.filename,'worker',root,id,label],{cwd:root,stdio:['ignore','ignore','inherit']});p.once('error',reject);p.once('exit',c=>c===0?resolve():reject(new Error(`${label}/${id}: ${c}`)));
 })));console.log(id,'each side reproduces its saved result');}}));
}
