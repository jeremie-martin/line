/** Recheck counterfactual teacher controls at the student's exact physical prefixes. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {loadArcCases,requestedArcSuite,caseSpec,sha} from './arc_suite.ts';
import {connectedArcOptions} from '../v0/optimizer/connected_arcs.ts';
import {normalizeCompilerTimeline} from '../v0/optimizer/compiler_input.ts';
import {arcPolicyArrival,ARC_POLICY_SCHEMA} from '../v0/optimizer/arc_control_policy.ts';
import {motionArc} from '../v0/optimizer/arc_geometry.ts';
import {createArcEngine} from '../v0/optimizer/arc_engine.ts';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,getPhysicsFrameCount,extractRawTrajectory,detect} from '../lib/detector.ts';
import {sliceTimeline,effectiveAxes,sampleGapTargets,findAuthoredContactNearFrame} from '../v0/core/substrate.ts';
import {scheduleNativeContacts} from '../v0/optimizer/native_motion_schedule.ts';
import {makeRng} from '../lib/rng.ts';
import {CALIB} from '../v0/types.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const read=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(b):b).toString());};
const root=resolve(arg('inputs')!),out=resolve(arg('out')!),plan=read(root+'/plan.json'),run=read(root+'/run.json.gz');
assert.ok(plan.options.replayControlPath);assert.equal(run.rows.length,plan.sources.length);
const suite=requestedArcSuite(),cases=loadArcCases(suite);
if(arg('partial')!=='true')assert.equal(run.rows.length,cases.length);
assert.ok(run.rows.every((r:any)=>r.score.valid));
const replay=read(plan.options.replayControlPath);assert.equal(sha(readFileSync(plan.options.replayControlPath)),plan.replaySha256);
const rows:any[]=[],provenance:any[]=[];
for(const c of cases.filter(c=>plan.sources.includes(c.id))){
  const path=root+'/'+c.id+'.json.gz',record=read(path),spec=normalizeCompilerTimeline(caseSpec(c));
  assert.equal(record.trackHash,replay.cases[c.id].trackHash);assert.equal(record.trackHash,sha(JSON.stringify(record.track)));
  const options={...connectedArcOptions(spec,plan.budget),...plan.options};
  const duration=Math.round(spec.duration*40),end=duration+20,frames=spec.contacts.map(c=>Math.round(c.t*40));
  const gaps=sliceTimeline(frames,duration);
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact&&spec.contacts[g.index].impact!==undefined)g.targets.impact=spec.contacts[g.index].impact;}
  const rng=makeRng(plan.seed),planned=scheduleNativeContacts(gaps.map(g=>({...g,targets:{...g.targets,...sampleGapTargets(g.targets,spec.jitter??CALIB.SIGMA,rng)}})));
  const contacts=[{frame:1,gap:-1},...planned.filter(g=>g.endsWithContact).map(g=>({frame:g.endFrame,gap:g.index}))];
  const future=(features:number[],i:number)=>{
    for(let k=1;k<=2;k++){
      const contact=contacts[i+k],target=contact?planned.find(g=>g.startFrame===contact.frame)?.targets:undefined;
      features.push(contact?((contacts[i+k+1]?.frame??end+1)-contact.frame)/40:0,contact?(gaps[contact.gap]?.targets.impact??-1):-1,target?.air??-1,target?.speed??-1,target?.amplitude??-1);
    }return features;
  };
  assert.equal(record.teacherRows.length,contacts.length);
  resetFrameCount();const start={position:record.track.startPosition,velocity:record.track.riders[0].startVelocity};
  let engine=createArcEngine(start);const reference=createArcEngine(start,record.track.lines);
  let checked=0;
  try{
    for(let i=0;i<contacts.length;i++){
      const frame=contacts[i].frame,horizon=(contacts[i+1]?.frame??end+1)-1,teacher=record.teacherRows[i];
      const before=getRiderMetered(engine,frame-1).ballisticState(),velocity=getRiderMetered(engine,frame).velocity;
      assert.deepEqual(before,getRiderMetered(reference,frame-1).ballisticState(),'student prefix mismatch');
      assert.deepEqual(future(arcPolicyArrival(before,velocity),i-1),teacher.features,'teacher input mismatch');
      const incoming=Math.atan2(velocity.y,velocity.x)*180/Math.PI;assert.equal(incoming,teacher.incoming);
      const objectiveEnd=options.authoredHorizon?Math.min(duration,horizon):horizon;
      const span=objectiveEnd>frame||i===0?objectiveEnd-(i===0?0:frame):horizon-frame;assert.equal(span,teacher.span);
      engine.prepareCollisionTrace(frame);getRiderMetered(engine,frame);
      const trace=engine.readCollisionTrace()[0],points=['PEG','TAIL','NOSE','STRING'].map(key=>trace[key]);
      const control=teacher.control,geometry=motionArc(points,velocity,control,1000+i*10000,options.flow,options.channel,options.wave,options.radius);
      assert.ok(geometry.length&&geometry.every(l=>l.type===0));
      const child=engine.addLine(geometry);
      assert.deepEqual(getRiderMetered(child,frame-1).ballisticState(),before,'teacher changes its prefix');
      const raw=extractRawTrajectory(child,horizon),det=detect(raw);
      assert.equal(det.terminus.reason,'endOfSpec');
      if(i)assert.ok(findAuthoredContactNearFrame(det,frame,1,frame-contacts[i-1].frame),'teacher missed its catch');
      else assert.ok(raw.frames.slice(1,4).some(f=>f.sledContacts.length),'teacher missed startup');
      assert.ok(!det.events.some(e=>e.type==='landing'&&!frames.some(f=>Math.abs(e.frame-f)<=1)),'teacher adds an offbeat landing');
      if(i+1<contacts.length)assert.ok(raw.frames.slice(-6).every(f=>f.sledContacts.length===0),'teacher releases too late');
      checked++;
      if(i)rows.push({source:c.id,parent:c.parentId,group:c.group,index:i,features:teacher.features,
        target:[(control.entry-incoming)/30,control.turn/60,(control.exit-incoming)/60,control.support/span,control.bias,control.offset,
          (control.clearance??12)/12,control.turnFraction??Math.min(5,control.support*.5)/control.support,(control.bend??0)/30,(control.guideFlare??0)/8],control});
      const forced=record.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===i);assert.ok(forced.length);
      engine=engine.addLine(forced).detach();Engine.retainOnly([engine,reference]);
    }
    assert.deepEqual(getRiderMetered(engine,end).ballisticState(),getRiderMetered(reference,end).ballisticState());
    provenance.push({source:c.id,path,sha256:sha(readFileSync(path)),replayedTrackHash:record.trackHash,checkedControls:checked,replayFrames:getPhysicsFrameCount(),allPrefixesAndFeaturesMatched:true,allCounterfactualControlsRevalidated:true});
  }finally{dispose();}
  if(provenance.length%8===0)console.log(JSON.stringify({sources:provenance.length,rows:rows.length}));
}
mkdirSync(out,{recursive:true});const data={schema:'line.arc-control-policy-data.v1',featureSchema:ARC_POLICY_SCHEMA,
  suite,scriptSha256:sha(readFileSync(import.meta.filename)),
  catalogSha256:sha(readFileSync(`benchmark/${suite}/specifications.json.gz`)),
  geometrySha256:sha(readFileSync('scripts/v0/optimizer/arc_geometry.ts')),
  featureSourceSha256:sha(readFileSync('scripts/v0/optimizer/arc_control_policy.ts')),
  arrivalSourceSha256:sha(readFileSync('scripts/v0/optimizer/arc_value.ts')),
  note:'Exposed development training. Counterfactual expert controls are queried at the declared student prefixes and independently replay-validated. Runtime features contain physical state and next authored targets only. The replayed headline measures the fixed student track, not an expert rollout.',
  teacherPlanSha256:sha(readFileSync(root+'/plan.json')),provenance,rows};
const b=JSON.stringify(data)+'\n';writeFileSync(out+'/data.json',b);writeFileSync(out+'/data.json.sha256',sha(b)+'\n');
console.log(JSON.stringify({sources:provenance.length,rows:rows.length,out}));
