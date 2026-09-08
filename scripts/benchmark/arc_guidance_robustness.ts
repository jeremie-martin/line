/** Separate jitter stress study; does not modify the canonical benchmark. */
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { developmentCases } from '../../benchmark/v2/catalog.ts';
import { benchmarkPolicy } from '../../benchmark/v2/policy.ts';
import { applyJolt } from '../produce/seed.ts';
import { buildAxisContract, scoreV2Report } from '../v0/benchmark_v2/evaluator.ts';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const out=resolve(arg('out')!),compilerRoot=resolve(arg('compiler-root')??'.'),jitter=Number(arg('jitter')??.02),budget=Number(arg('budget')??750000);
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const write=(path:string,value:unknown)=>{const b=JSON.stringify(value)+'\n';writeFileSync(path,b);writeFileSync(path+'.sha256',hash(b)+'\n');};
mkdirSync(out,{recursive:true});
if(arg('source')){
  const source=arg('source')!,seed=Number(arg('seed'));
  const entry=developmentCases.find(e=>e.case.metadata.id===source);if(!entry)throw new Error('unknown source');
  const spec={...applyJolt(entry.case.spec,benchmarkPolicy.transform.joltMs),jitter};
  const {compileConnectedArcs}=await import(pathToFileURL(resolve(compilerRoot,'scripts/v0/optimizer/connected_arcs.ts')).href);
  const started=performance.now(),result=compileConnectedArcs(spec,seed,{budget});
  if(result.stats.sim_frames>budget||result.track.lines.some((l:any)=>l.type!==0))throw new Error('budget or normal-line violation');
  const suite=JSON.parse(readFileSync('benchmark/v2/compat/suite-manifest.json','utf8'));
  const score=scoreV2Report(result.report,spec.contacts.length,buildAxisContract(spec,Object.keys(benchmarkPolicy.componentWeights) as any),suite);
  write(resolve(out,`${source}-${seed}.json`),{schema:'line.arc-guidance-jitter-cell.v1',researchOnly:true,source,seed,jitter,budget,score,stats:result.stats,elapsedMs:performance.now()-started,trackSha256:hash(JSON.stringify(result.track)),...(score.valid?{}:{report:result.report,track:result.track})});
}else{
  const seeds=(arg('seeds')??'101,102,103,104').split(',').map(Number),jobs=Number(arg('jobs')??16);
  const sources=arg('sources')?.split(',')??developmentCases.map(e=>e.case.metadata.id).sort();
  const files=['scripts/v0/optimizer/connected_arcs.ts','scripts/v0/optimizer/arc_motion.ts','scripts/v0/optimizer/arc_guidance.ts'].filter(p=>existsSync(resolve(compilerRoot,p)));
  const implementation=Object.fromEntries(files.map(p=>[p,hash(readFileSync(resolve(compilerRoot,p)))]));
  const plan={schema:'line.arc-guidance-jitter-plan.v1',researchOnly:true,compilerRoot,head:execFileSync('git',['-C',compilerRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),implementation,jitter,budget,seeds,sources,note:'Search-target jitter stress, evaluated against the unchanged authored targets; never a canonical headline.'};
  const planPath=resolve(out,'plan.json');
  if(existsSync(planPath)){if(JSON.stringify(JSON.parse(readFileSync(planPath,'utf8')))!==JSON.stringify(plan))throw new Error('stress plan changed');}else write(planPath,plan);
  const cells=sources.flatMap(source=>seeds.map(seed=>({source,seed}))),queue=cells.slice(),failed:string[]=[];
  await Promise.all(Array.from({length:Math.min(jobs,queue.length)},async()=>{
    while(queue.length){
      const {source,seed}=queue.shift()!,key=`${source}-${seed}`,path=resolve(out,key+'.json');
      if(existsSync(path))continue;
      if(files.some(p=>hash(readFileSync(resolve(compilerRoot,p)))!==implementation[p]))throw new Error('compiler changed during stress study');
      const log=openSync(resolve(out,key+'.log'),'w');
      try{
        const code=await new Promise<number|null>((done,reject)=>{const p=spawn(process.execPath,['--import','tsx',import.meta.filename,`--source=${source}`,`--seed=${seed}`,`--jitter=${jitter}`,`--budget=${budget}`,`--compiler-root=${compilerRoot}`,`--out=${out}`],{env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore',log,log]});p.on('error',reject);p.on('exit',done);});
        if(code!==0)failed.push(key);
      }finally{closeSync(log);}
    }
  }));
  if(failed.length)throw new Error('stress worker failures '+failed.join(','));
  const rows=cells.map(({source,seed})=>{const p=resolve(out,`${source}-${seed}.json`),b=readFileSync(p);if(hash(b)!==readFileSync(p+'.sha256','utf8').trim())throw new Error('checksum');return JSON.parse(b.toString());});
  const summary={schema:'line.arc-guidance-jitter-summary.v1',researchOnly:true,cells:rows.length,valid:rows.filter(r=>r.score.valid).length,distinctTracks:new Set(rows.map(r=>r.trackSha256)).size,meanCellScore:rows.reduce((s,r)=>s+r.score.score,0)/rows.length,maxFrames:Math.max(...rows.map(r=>r.stats.sim_frames)),totalFrames:rows.reduce((s,r)=>s+r.stats.sim_frames,0),failures:rows.filter(r=>!r.score.valid).map(r=>({source:r.source,seed:r.seed,score:r.score}))};
  write(resolve(out,'summary.json'),summary);console.log(JSON.stringify(summary));
}
