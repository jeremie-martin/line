/** Immutable-option research panels; no benchmark policy or promotion changes. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, openSync, closeSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { developmentCases } from '../../benchmark/v2/catalog.ts';
import { summarizeDevelopmentBudget } from '../v0/benchmark_v2/evaluator.ts';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const out=resolve(arg('out')!), mode=arg('mode')??'compile', jobs=Number(arg('jobs')??12);
const options=JSON.parse(arg('options')??'{}'), sourceIds=arg('sources')?.split(',')??developmentCases.map(e=>e.case.metadata.id).sort();
const inputs=arg('inputs')??'generated/benchmark-v2/arc-motion-650/full-v12';
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const files=mode==='ablation'?['scripts/benchmark/arc_guidance_ablation.ts']:['scripts/benchmark/arc_motion_study.ts','scripts/v0/optimizer/arc_geometry.ts','scripts/v0/optimizer/arc_motion.ts','scripts/v0/optimizer/arc_guidance.ts','scripts/v0/optimizer/arc_refinement.ts','scripts/v0/optimizer/arc_response.ts','scripts/v0/optimizer/arc_value.ts','scripts/v0/optimizer/arc_value_model.json','scripts/v0/optimizer/connected_arcs.ts'];
if(options.valueModelPath)files.push(resolve(options.valueModelPath));
const implementation=Object.fromEntries(files.map(p=>[p,hash(readFileSync(p))]));
const suite=JSON.parse(readFileSync('benchmark/v2/compat/suite-manifest.json','utf8'));
const budget=Number(options.budget??750000), seed=Number(arg('seed')??260908011);
const plan={schema:'line.arc-guidance-panel.v1',researchOnly:true,mode,...(arg('defaults')?{defaults:arg('defaults')}:{}),options,sourceIds,budget,seed,implementation,suiteSha256:hash(readFileSync('benchmark/v2/compat/suite-manifest.json')),judgeSha256:hash(readFileSync('engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm'))};
const write=(path:string,value:unknown)=>{const b=JSON.stringify(value)+'\n';writeFileSync(path,b);writeFileSync(path+'.sha256',hash(b)+'\n');};
const read=(path:string)=>{const b=readFileSync(path);if(hash(b)!==readFileSync(path+'.sha256','utf8').trim())throw new Error('checksum '+path);return JSON.parse(b.toString());};
mkdirSync(out,{recursive:true});
if(existsSync(resolve(out,'plan.json'))){if(JSON.stringify(read(resolve(out,'plan.json')))!==JSON.stringify(plan))throw new Error('plan changed');}else write(resolve(out,'plan.json'),plan);
mkdirSync(resolve(out,'source'),{recursive:true});for(const p of files)copyFileSync(p,resolve(out,'source',p.split('/').at(-1)!));
const queue=sourceIds.slice(), failed:string[]=[];
await Promise.all(Array.from({length:Math.min(jobs,queue.length)},async()=>{
  while(queue.length){
    const source=queue.shift()!, path=resolve(out,source+'.json');
    if(existsSync(path)){read(path);continue;}
    if(files.some(p=>hash(readFileSync(p))!==implementation[p]))throw new Error('implementation changed during panel');
    const log=openSync(resolve(out,source+'.log'),'w');
    try{
      const args=mode==='ablation'?['scripts/benchmark/arc_guidance_ablation.ts',`--input=${resolve(inputs,source+'.json')}`]:['scripts/benchmark/arc_motion_study.ts',`--source=${source}`,`--seed=${seed}`,...(arg('defaults')?[`--defaults=${arg('defaults')}`]:[]),`--options=${JSON.stringify(options)}`];
      const code=await new Promise<number|null>((done,reject)=>{const child=spawn(process.execPath,['--import','tsx',...args,`--out=${path}`],{env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore',log,log]});child.on('error',reject);child.on('exit',done);});
      if(code!==0){failed.push(source);continue;}
      const r=read(path);process.stderr.write(JSON.stringify(mode==='ablation'?{source,rails:r.rows.length,unused:r.rows.filter((x:any)=>!x.contactedSegments).length,combinedExact:r.combinedTrim.identical}:{source,score:r.score.score,valid:r.score.valid,frames:r.stats.sim_frames})+'\n');
    }finally{closeSync(log);}
  }
}));
if(failed.length)throw new Error('worker failures '+failed.join(','));
const rows=sourceIds.map(source=>read(resolve(out,source+'.json')));
const summary=mode==='ablation'?{sources:rows.length,rails:rows.reduce((s,r)=>s+r.rows.length,0),unused:rows.reduce((s,r)=>s+r.rows.filter((x:any)=>!x.contactedSegments).length,0),identicalCombined:rows.filter(r=>r.combinedTrim.identical).length,removedSegments:rows.reduce((s,r)=>s+r.combinedTrim.removedSegments,0),auditPhysicsFrames:rows.reduce((s,r)=>s+r.auditPhysicsFrames,0)}:
 {sources:rows.length,valid:rows.filter(r=>r.score.valid).length,score:rows.length===developmentCases.length?summarizeDevelopmentBudget(rows.map(r=>({sourceId:r.sourceId,budget,seedSlot:0,actualSeed:seed,score:r.score})),budget,suite):null,exploratoryMean:rows.reduce((s,r)=>s+r.score.score,0)/rows.length,maxFrames:Math.max(...rows.map(r=>r.stats.sim_frames)),totalFrames:rows.reduce((s,r)=>s+r.stats.sim_frames,0),perSource:rows.map(r=>({source:r.sourceId,score:r.score.score,valid:r.score.valid,frames:r.stats.sim_frames,failure:r.failure}))};
write(resolve(out,'summary.json'),summary);console.log(JSON.stringify(summary));
