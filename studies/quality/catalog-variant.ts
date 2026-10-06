/** Predeclared diagnostic replay of collection completion differences. */
import assert from 'node:assert/strict';import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {spawn} from 'node:child_process';import {gzipSync} from 'node:zlib';
const out=process.env.CATALOG_RUN_DIR!,cases=[{id:'pickup_interruptions',seed:202},{id:'stretch_bridge_frontier_pickup_progression',seed:101},{id:'stretch_bridge_split_signal',seed:101}];
assert.ok(out&&process.env.CATALOG_CANDIDATE);
const roots={candidate:process.env.CATALOG_CANDIDATE!};
if(process.argv[2]==='worker'){
 const label=process.argv[3] as keyof typeof roots,root=roots[label],c=cases[Number(process.argv[4])],module=(p:string)=>import(pathToFileURL(join(root,p)).href);
 const {compilerIdentity}=await module('scripts/lib/compiler_identity.ts'),identity=compilerIdentity(root),{loadCases,caseSpec,sha}=await module('benchmark/v4/model.ts');
 const source=loadCases().find((x:any)=>x.id===c.id),spec=caseSpec(source),{compileHandoff}=await module('scripts/v0/optimizer/handoff.ts'),{productionBudget}=await module('scripts/v0/optimizer/production_budget.ts');
 const cpu=process.cpuUsage(),start=performance.now(),cp=compileHandoff(spec,c.seed,{budget:productionBudget(spec.duration),creative:{},impactContract:'line.strike.v3',phraseBoundaries:(source.phases??[]).map((p:any)=>p.start).filter(Number.isFinite)}),elapsed=performance.now()-start,used=process.cpuUsage(cpu),r=cp.repertoire;
 assert.deepEqual(compilerIdentity(root),identity);assert.ok(cp.track.lines.every((l:any)=>l.type===0));
 const record={...c,identity,inputSha256:sha(JSON.stringify(source)),trackSha256:sha(JSON.stringify(cp.track)),complete:r.valid,fulfilled:r.realization.fulfilled,failure:r.result.failure,
 duration:spec.duration,requested:r.plan.requests.length,constructed:r.result.rows.length,work:cp.work,search:r.searchTotals,loss:r.result.impactEvaluation?.account.loss,
 wallMs:elapsed,cpuMs:(used.user+used.system)/1000,peakRssKiB:process.resourceUsage().maxRSS};
 writeFileSync(join(out,label,`${c.id}~${c.seed}.json`),JSON.stringify(record));writeFileSync(join(out,label,`${c.id}~${c.seed}.checkpoint.json.gz`),gzipSync(JSON.stringify(cp)));
 console.log(label,c.id,c.seed,record.complete,JSON.stringify(record.failure));
}else{
 mkdirSync(out,{recursive:true});for(const label of Object.keys(roots))mkdirSync(join(out,label),{recursive:true});
 writeFileSync(join(out,'plan.json'),JSON.stringify({cases,roots,hypothesis:'Reconfirm three historical collection completion differences on identical current catalog inputs; inspect full failures before changing search. The old collection did not record strict input identities, so its pass/fail comparison alone is not causal evidence.'}));
 await Promise.all(Object.entries(roots).map(async([label,root])=>{for(let i=0;i<cases.length;i++)await new Promise<void>((ok,fail)=>{const p=spawn(process.execPath,['--max-old-space-size=4096','--import','tsx',import.meta.filename,'worker',label,String(i)],{cwd:root,stdio:'inherit'});p.once('error',fail);p.once('exit',c=>c===0?ok():fail(Error(label+':'+c)));})}));
 for(const c of cases){const file=`${c.id}~${c.seed}.json`,a=JSON.parse(readFileSync(join('/tmp/line-quality-catalog-check','baseline',file),'utf8')),b=JSON.parse(readFileSync(join(out,'candidate',file),'utf8'));assert.equal(a.inputSha256,b.inputSha256);}
 console.log('Three candidate diagnostic cases complete; baseline inputs exact');
}
