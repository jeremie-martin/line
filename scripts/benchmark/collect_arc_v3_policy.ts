/** Distill ordinary arc controls from replay-verified V3 development trajectories. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {loadArcCases,requestedArcSuite,caseSpec,sha} from './arc_suite.ts';
import {sliceTimeline,effectiveAxes,sampleGapTargets} from '../v0/core/substrate.ts';
import {normalizeCompilerTimeline} from '../v0/optimizer/compiler_input.ts';
import {scheduleNativeContacts} from '../v0/optimizer/native_motion_schedule.ts';
import {createArcEngine} from '../v0/optimizer/arc_engine.ts';
import {arcPolicyArrival,ARC_POLICY_SCHEMA} from '../v0/optimizer/arc_control_policy.ts';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,getPhysicsFrameCount,extractRawTrajectory,detect} from '../lib/detector.ts';
import {measureGapAxes,measureAmplitudePeakPx} from '../v0/core/measure.ts';
import {makeRng} from '../lib/rng.ts';
import {CALIB} from '../v0/types.ts';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const contextual=arg('context')==='true',horizon=arg('horizon')==='true';
const preserveControlReference=arg('preserve-control-reference')==='true';
assert.ok(!(contextual&&horizon),'choose one feature extension per study');
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse((p.endsWith('.gz')?gunzipSync(b):b).toString());};
const paths=arg('inputs')!.split(','),panels=paths.map(p=>({path:p,run:read(resolve(p,'run.json.gz'))}));
assert.ok(!(arg('compiler-root')&&arg('compiler-roots')),'choose one compiler-root argument');
const roots=arg('compiler-roots')?.split(',')??(arg('compiler-root')?[arg('compiler-root')!]:[]);
const defaultsByCompiler=new Map<string,typeof import('../v0/optimizer/connected_arcs.ts').connectedArcOptions>();
const compilerIdentities:Array<{root:string;fingerprint:string}>=[];
for(const root of roots){
  const compilerRoot=resolve(root);
  const fingerprint=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',
    'import {compilerCandidateIdentity} from "./scripts/v0/benchmark_v2/compiler_identity.ts"; console.log(compilerCandidateIdentity("wasm").candidateFingerprint);'],{cwd:compilerRoot,encoding:'utf8'}).trim();
  defaultsByCompiler.set(fingerprint,(await import(pathToFileURL(resolve(compilerRoot,'scripts/v0/optimizer/connected_arcs.ts')).href)).connectedArcOptions);
  compilerIdentities.push({root:compilerRoot,fingerprint});
}
const suite=requestedArcSuite(),cases=loadArcCases(suite),all:any[]=[],provenance:any[]=[];
const frozen=suite==='v4'?(await import('../../benchmark/v4/contract.ts')).verifyFrozen():undefined;
for(const panel of panels){
  const plan=read(resolve(panel.path,'plan.json'));assert.deepEqual(panel.run.plan,plan);
  assert.equal(plan.suite??'v3',suite);
  if(frozen)assert.deepEqual(plan.judge,frozen,'teacher judge mismatch');
  if(roots.length)assert.ok(defaultsByCompiler.has(plan.compiler.candidateFingerprint),'teacher compiler root mismatch');
}
for(const c of cases){
  const candidates=panels.map(p=>({panel:p,row:p.run.rows.find((r:any)=>r.sourceId===c.id)})).filter(p=>p.row?.score.valid);
  assert.ok(candidates.length,'no valid teacher '+c.id);
  candidates.sort((a,b)=>b.row.score.score-a.row.score.score);
  const teacher=candidates[0],path=resolve(teacher.panel.path,c.id+'.json.gz'),record=read(path),plan=teacher.panel.run.plan;
  assert.equal(record.planSha256,sha(readFileSync(resolve(teacher.panel.path,'plan.json'))));
  assert.equal(record.sourceId,c.id);assert.deepEqual(record.score,teacher.row.score);
  assert.equal(record.trackHash,sha(JSON.stringify(record.track)));assert.equal(record.seed,plan.seed);
  const spec=normalizeCompilerTimeline(caseSpec(c)),duration=Math.round(spec.duration*40),end=duration+20;
  const defaults=defaultsByCompiler.get(plan.compiler.candidateFingerprint);
  if(contextual)assert.ok(defaults,'context collection requires an explicit matching compiler root');
  const options={...defaults?.(spec,plan.budget),...plan.options};
  const authoredHorizon=plan.options.authoredHorizon??defaults?.(spec,plan.budget).authoredHorizon??false;
  const gaps=sliceTimeline(spec.contacts.map(x=>Math.round(x.t*40)),duration);
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact&&spec.contacts[g.index].impact!==undefined)g.targets.impact=spec.contacts[g.index].impact;}
  const rng=makeRng(record.seed),planned=scheduleNativeContacts(gaps.map(g=>({...g,targets:{...g.targets,...sampleGapTargets(g.targets,spec.jitter??CALIB.SIGMA,rng)}})));
  const contacts=[{frame:1,gap:-1},...planned.filter(g=>g.endsWithContact).map(g=>({frame:g.endFrame,gap:g.index}))];
  const future=(features:number[],i:number)=>{
    for(let k=1;k<=(horizon?4:2);k++){
      const contact=contacts[i+k],target=contact?planned.find(g=>g.startFrame===contact.frame)?.targets:undefined;
      features.push(contact?((contacts[i+k+1]?.frame??end+1)-contact.frame)/40:0,contact?(gaps[contact.gap]?.targets.impact??-1):-1,target?.air??-1,target?.speed??-1,target?.amplitude??-1);
    }return features;
  };
  resetFrameCount();const start={position:record.track.startPosition,velocity:record.track.riders[0].startVelocity};
  let engine=createArcEngine(start);const reference=createArcEngine(start,record.track.lines);
  assert.equal(record.rows.length,contacts.length);
  try{
    for(let i=0;i<contacts.length;i++){
      const row=record.rows[i],frame=contacts[i].frame;assert.equal(row.frame,frame);
      const before=getRiderMetered(engine,frame-1).ballisticState(),velocity=getRiderMetered(engine,frame).velocity;
      assert.equal(JSON.stringify(before),JSON.stringify(getRiderMetered(reference,frame-1).ballisticState()),c.id+':'+i);
      if(i>0||arg('include-startup')==='true'){
        const incoming=Math.atan2(velocity.y,velocity.x)*180/Math.PI,
          objectiveEnd=authoredHorizon?Math.min(duration,row.next-1):row.next-1,
          span=objectiveEnd>frame||i===0?objectiveEnd-(i===0?0:frame):row.next-1-frame,control=row.control;
        assert.ok(['guideStart','guideEnd','guideBend','exitBias'].every(key=>control[key]===undefined),'ten-control export would discard geometry');
        const target=[(control.entry-incoming)/30,control.turn/60,(control.exit-incoming)/60,control.support/span,control.bias,control.offset,
          (control.clearance??12)/12,control.turnFraction??Math.min(5,control.support*.5)/control.support,(control.bend??0)/30,(control.guideFlare??0)/8];
        const features=future(arcPolicyArrival(before,velocity),i-1);
        if(contextual){
          const priorGap=i>0?gaps[contacts[i].gap]:undefined;
          let priorAxes:any;
          if(options.completeBoundary&&priorGap){
            const det=detect(extractRawTrajectory(engine,frame-1));
            priorAxes=measureGapAxes(det,priorGap,[],frame-1);
            if(options.predictAirBoundary&&priorGap.endsWithContact&&frame-1===priorGap.endFrame-1&&priorAxes.air!==undefined){
              const samples=frame-priorGap.startFrame;priorAxes.air*=samples/(samples+1);
            }
            if(options.amplitudeOverflow&&priorGap.targets.amplitude!==undefined&&priorAxes.amplitude===1){
              const raw=measureAmplitudePeakPx(det,priorGap,frame-1)!/CALIB.AMPLITUDE_CAP;
              priorAxes.amplitude=options.amplitudeOverflow==='raw'?raw:1+Math.log(raw);
            }
          }
          features.push(...['air','speed','amplitude'].map(key=>(priorGap?.targets as any)?.[key]??-1),
            ...['air','speed','amplitude'].map(key=>priorAxes?.[key]??-1));
          if(record.proposalContexts)assert.deepEqual(features,record.proposalContexts.find((x:any)=>x.index===i)?.features,'independent measured context mismatch');
        }
        all.push({source:c.id,parent:c.parentId,group:c.group,index:i,features,target,control,
          ...(preserveControlReference?{incoming,span}:{})});
      }
      const geometry=record.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===i);assert.ok(geometry.length);
      engine=engine.addLine(geometry).detach();Engine.retainOnly([engine,reference]);
    }
    assert.equal(JSON.stringify(getRiderMetered(engine,end).ballisticState()),JSON.stringify(getRiderMetered(reference,end).ballisticState()));
    provenance.push({source:c.id,path,sha256:sha(readFileSync(path)),teacherScore:record.score.score,teacherPlanSha256:record.planSha256,authoredHorizon,replayFrames:getPhysicsFrameCount(),prefixesMatchedFullTrack:true});
  }finally{dispose();}
  if(provenance.length%8===0)console.log(JSON.stringify({sources:provenance.length,rows:all.length}));
}
const out=resolve(arg('out')!);mkdirSync(out,{recursive:true});
for(const identity of compilerIdentities){
  const current=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',
    'import {compilerCandidateIdentity} from "./scripts/v0/benchmark_v2/compiler_identity.ts"; console.log(compilerCandidateIdentity("wasm").candidateFingerprint);'],{cwd:identity.root,encoding:'utf8'}).trim();
  assert.equal(current,identity.fingerprint,'teacher compiler changed during collection');
}
const body=JSON.stringify({schema:'line.arc-control-policy-data.v1',featureSchema:contextual?'line.arc-context-control-policy-features.v1':horizon?'line.arc-horizon-control-policy-features.v1':ARC_POLICY_SCHEMA,
  compilerIdentities,scriptSha256:sha(readFileSync(import.meta.filename)),
  note:`Exposed ${suite.toUpperCase()} development training. Best valid complete trajectory per case among declared panels; this teacher selection is not a compiler score. Runtime features contain physical state and upcoming targets, with no source/seed/index/absolute-position identifiers.`,
  panels:panels.map(p=>({path:p.path,sha256:sha(readFileSync(resolve(p.path,'run.json.gz')))})),provenance,rows:all})+'\n';
writeFileSync(resolve(out,'data.json'),body);writeFileSync(resolve(out,'data.json.sha256'),sha(body)+'\n');
console.log(JSON.stringify({out,sources:provenance.length,rows:all.length}));
