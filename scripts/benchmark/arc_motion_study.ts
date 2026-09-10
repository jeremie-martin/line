import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {developmentCases} from '../../benchmark/v2/catalog.ts';
import {benchmarkPolicy} from '../../benchmark/v2/policy.ts';
import {applyJolt} from '../produce/seed.ts';
import {compileArcMotion} from '../v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../v0/optimizer/connected_arcs.ts';
import {compileHandoff} from '../v0/optimizer/handoff.ts';
import {buildAxisContract,scoreV2Report} from '../v0/benchmark_v2/evaluator.ts';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const entry=developmentCases.find(e=>e.case.metadata.id===arg('source'));
if(!entry||!arg('out'))throw new Error('require --source and --out');
const spec=applyJolt(entry.case.spec,benchmarkPolicy.transform.joltMs);
const historicalOptions={...{budget:Number(arg('budget')??750000),samples:Number(arg('samples')??160),diagnostic:arg('diagnostic')==='on',arrivalWeight:Number(arg('arrival-weight')??0),flow:arg('flow')==='on',solver:arg('solver'),channel:Number(arg('channel')??0),wave:arg('wave')==='on',radius:Number(arg('radius')??0),arrivalMode:arg('arrival-mode'),headingWeight:Number(arg('heading-weight')??0),qualityRetries:Number(arg('quality-retries')??0),bidirectional:arg('bidirectional')==='on',impactWeight:Number(arg('impact-weight')??2),amplitudeWeight:Number(arg('amplitude-weight')??1),poseWeight:Number(arg('pose-weight')??0),startPitch:Number(arg('start-pitch')??8.59436692696)},...JSON.parse(arg('options')??'{}')};
// Opt into the shipped allocation, then override only the mechanisms under study.
// Existing research commands retain their historical defaults.
const options=arg('defaults')==='production'
  ? {...connectedArcOptions(spec,historicalOptions.budget),...JSON.parse(arg('options')??'{}')}
  : historicalOptions;
if(options.controlPolicyPath)options.controlPolicy=JSON.parse(readFileSync(options.controlPolicyPath,'utf8'));
if(options.valueModelPath)options.futureValueModel=JSON.parse(readFileSync(options.valueModelPath,'utf8'));
const start=performance.now(),result=options.publicCompiler?compileHandoff(spec,Number(arg('seed')??260908011),{budget:options.budget}):compileArcMotion(spec,Number(arg('seed')??260908011),options);
const suite=JSON.parse(readFileSync('benchmark/v2/compat/suite-manifest.json','utf8'));
const score=scoreV2Report(result.report,spec.contacts.length,buildAxisContract(spec,Object.keys(benchmarkPolicy.componentWeights) as any),suite);
const elapsedMs=performance.now()-start;
// Large learned artifacts are shared across a panel, rather than copied into
// every result and again into stdout. Preserve the exact loaded JSON once,
// with a content hash and atomic publication for concurrent study workers.
const out=arg('out')!,recordOptions={...options},modelArtifacts:Record<string,{path:string;sha256:string}>={};
for(const key of ['controlPolicy','futureValueModel']){
  const model=(recordOptions as any)[key];if(!model||typeof model!=='object')continue;
  const body=JSON.stringify(model)+'\n',sha256=createHash('sha256').update(body).digest('hex');
  const path='models/'+sha256+'.json',destination=dirname(out)+'/'+path;
  mkdirSync(dirname(destination),{recursive:true});
  if(!existsSync(destination)){
    const temporary=destination+'.'+process.pid+'.tmp';writeFileSync(temporary,body);renameSync(temporary,destination);
  }
  if(createHash('sha256').update(readFileSync(destination)).digest('hex')!==sha256)throw new Error('study model artifact mismatch');
  modelArtifacts[key]={path,sha256};delete (recordOptions as any)[key];
}
const record={schema:'line.arc-motion-study.v2',researchOnly:true,sourceId:arg('source'),seed:Number(arg('seed')??260908011),elapsedMs,options:recordOptions,modelArtifacts,implementation:Object.fromEntries(['scripts/v0/optimizer/arc_geometry.ts','scripts/v0/optimizer/arc_motion.ts','scripts/v0/optimizer/arc_guidance.ts','scripts/v0/optimizer/arc_refinement.ts','scripts/v0/optimizer/arc_response.ts','scripts/v0/optimizer/arc_value.ts','scripts/v0/optimizer/arc_value_model.json','scripts/v0/optimizer/connected_arcs.ts','scripts/benchmark/arc_motion_study.ts',...['scripts/v0/optimizer/arc_control_policy.ts','scripts/v0/optimizer/arc_control_policy_model.json','scripts/v0/optimizer/arc_control_policy_model.json.gz','scripts/v0/optimizer/arc_boundary.ts','scripts/v0/optimizer/arc_memory.ts'].filter(existsSync),...[options.controlPolicyPath,options.valueModelPath].filter(Boolean)].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),score,...result};
const body=JSON.stringify(record)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',createHash('sha256').update(body).digest('hex')+'\n');
console.log(JSON.stringify({source:record.sourceId,score:score.score,valid:score.valid,frames:result.stats.sim_frames,lines:result.track.lines.length,elapsedMs:record.elapsedMs}));
