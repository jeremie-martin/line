/** Full production video review of a frozen research arc track. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {hostname} from 'node:os';
import {compileArcMotion} from '../v0/optimizer/arc_motion.ts';
import {compileConnectedArcs} from '../v0/optimizer/connected_arcs.ts';
import {applyJolt,resolveJoltMs} from './seed.ts';
import {loadSelect} from './config.ts';
import {measure} from './measure.ts';
import {extractTrace} from '../v0/core/trace.ts';
import {ensureMirror,ensureSpectrum,renderBundle} from './render.ts';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const song=arg('song')??'amor_na_praia_46s',out=resolve(arg('out')!);
const cfg=loadSelect(join('productions',song)),seed=260908011,jolt=resolveJoltMs();
const work=join(out,'inputs',song);mkdirSync(work,{recursive:true});
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const write=(p:string,value:any)=>{writeFileSync(p,JSON.stringify(value,null,2)+'\n');writeFileSync(p+'.sha256',hash(p)+'\n');};
const gitSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceFiles=['scripts/v0/optimizer/arc_motion.ts','scripts/v0/optimizer/arc_geometry.ts','scripts/v0/optimizer/arc_control_policy.ts','scripts/v0/optimizer/arc_control_policy_model.json','scripts/v0/optimizer/arc_guidance.ts','scripts/v0/optimizer/arc_refinement.ts','scripts/v0/optimizer/arc_response.ts','scripts/v0/optimizer/arc_value.ts','scripts/v0/optimizer/arc_value_model.json','scripts/v0/optimizer/connected_arcs.ts','scripts/produce/arc_review.ts'];
const implementation=Object.fromEntries(sourceFiles.map(p=>[p,hash(p)]));
const publicCompiler=arg('compiler')==='public';
if(publicCompiler&&arg('options'))throw new Error('public compiler uses its committed configuration');
const options=publicCompiler?{compiler:'public',budget:cfg.budget}:{bidirectional:arg('bidirectional')==='on',impactWeight:Number(arg('impact-weight')??2),amplitudeWeight:Number(arg('amplitude-weight')??1),poseWeight:Number(arg('pose-weight')??0),qualityRetries:Number(arg('quality-retries')??0),samples:160,arrivalWeight:Number(arg('arrival-weight')??.3),arrivalMode:arg('arrival-mode')??'heading-speed',channel:Number(arg('channel')??0),wave:arg('wave')==='on',radius:Number(arg('radius')??0),...JSON.parse(arg('options')??'{}'),budget:cfg.budget};
let record:any;
if(existsSync(join(work,'compile.json'))){
  record=JSON.parse(readFileSync(join(work,'compile.json'),'utf8'));
  if(JSON.stringify(record.options)!==JSON.stringify(options))throw new Error('saved research options differ');
  if(Object.entries(implementation).some(([p,digest])=>record.implementation[p]!==digest))throw new Error('saved compiler implementation differs');
  for(const [file,digest] of Object.entries(record.outputs))if(hash(join(work,file))!==digest)throw new Error('corrupt compiler output');
}else{
  const spec=applyJolt((await import(resolve(cfg.spec))).default,jolt);
  const result:any=publicCompiler?compileConnectedArcs(spec,seed,{budget:cfg.budget}):compileArcMotion(spec,seed,options);
  const metrics=measure(seed,result.track,result.report,extractTrace(result.track));
  if(!metrics.contractPassed||!metrics.reachedEnd||metrics.offBeat)throw new Error(`research production contract failed: ${JSON.stringify({metrics,failure:result.failure})}`);
  if(result.track.lines.some((l:{type:number})=>l.type!==0))throw new Error('non-normal geometry');
  write(join(work,'track.json'),result.track);write(join(work,'report.json'),result.report);
  write(join(work,'research.json'),{rows:result.rows,stats:result.stats,failure:result.failure,samples:result.samples,backtracks:result.backtracks});
  write(join(work,'budget-telemetry.json'),{schema:'line.arc-motion-research-budget.v1',budget:cfg.budget,actualPhysicsFrames:result.stats.sim_frames,includes:'All construction proposals, backtracking rebuilds, and two cold full replays. Production measurement and video export are separate.'});
  for(const file of sourceFiles)copyFileSync(file,join(work,file.split('/').at(-1)!));
  record={schema:'line.arc-motion-production-review.v1',researchOnly:true,song,seed,jolt,gitSha,implementation,options,metrics,specSha256:hash(cfg.spec),audioSha256:hash(cfg.audio),render:cfg.render,outputs:Object.fromEntries(['track.json','report.json','research.json','budget-telemetry.json'].map(p=>[p,hash(join(work,p))]))};
  write(join(work,'compile.json'),record);
}
console.log(JSON.stringify({song,metrics:record.metrics,options:record.options}));
if(arg('compile-only')!=='on'){
  const mirror=await ensureMirror();
  try{
    const spectrumBase=await ensureSpectrum(cfg.audio,song,join(work,'spectrum.log'));
    const folder=await renderBundle({specPath:cfg.spec,trackPath:join(work,'track.json'),reportPath:join(work,'report.json'),budgetTelemetryPath:join(work,'budget-telemetry.json'),audioPath:cfg.audio,spectrumBase,seed,song,project:'arc-motion-research',metrics:record.metrics,render:cfg.render,budget:cfg.budget,jolt,outDir:out,workDir:work,gitSha:record.gitSha,host:hostname()});
    const video=join(folder,'video.mp4'),probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',video],{encoding:'utf8'}));
    const v=probe.streams.find((s:any)=>s.codec_type==='video');
    if(v.width!==1080||v.height!==1920||v.avg_frame_rate!=='60/1'||!probe.streams.some((s:any)=>s.codec_type==='audio'))throw new Error('video format');
    execFileSync('ffmpeg',['-v','error','-i',video,'-f','null','-'],{stdio:['ignore','ignore','pipe']});
    write(join(folder,'review-validation.json'),{decodedWithoutErrors:true,videoSha256:hash(video),probe});
    for(const name of ['track.json','report.json','compile.json'])copyFileSync(join(work,name),join(folder,name));
    write(join(out,'review.json'),{...record,video,videoSha256:hash(video),validated:true});
    console.log(`complete ${video}`);
  }finally{mirror?.kill();}
}
