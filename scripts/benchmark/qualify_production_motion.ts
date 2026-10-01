/** Independently replay the complete preserved and replacement music collections. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {sha} from '../../benchmark/v4/model.ts';
import {verifyFrozen} from '../../benchmark/v6/contract.ts';
import {evaluateDetection} from '../../benchmark/v4/evaluator.ts';
import {qualifyProductionMotion,reportedWindows,type ProductionObservation} from '../../benchmark/v6/production_qualification.ts';
import {extractRawTrajectory,detect,resetFrameCount,setPhysicsFrameLimit} from '../lib/detector.ts';
import {motionSamples,summarizeMotion} from '../v0/optimizer/motion_quality.ts';
import {inspectRepertoireLayout} from '../v0/optimizer/repertoire_layout.ts';
import {writeGalleryJson} from '../gallery/artifacts.ts';
const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=
 await import(new URL('../lib/_lr_engine_wasm.ts?production-motion-qualification',import.meta.url).href);
const arg=(k:string,d?:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
if(!arg('candidate'))throw new Error('--candidate collection directory required');
const roots={baseline:resolve(arg('baseline','generated/production-repertoire/library-qualified')!),candidate:resolve(arg('candidate')!)};
const out=resolve(arg('out','generated/intentional-motion/production-qualification')!);mkdirSync(out,{recursive:true});
const judge=verifyFrozen(),harness=Object.fromEntries(['benchmark/v6/production_qualification.ts','scripts/benchmark/qualify_production_motion.ts'].map(p=>[p,sha(readFileSync(p))]));
const read=(p:string)=>{const bytes=readFileSync(p);assert.equal(sha(bytes),readFileSync(p+'.sha256','utf8').trim(),p);return {value:JSON.parse(bytes.toString()),sha256:sha(bytes)};};
const identities=new Map<string,unknown>();
const sets:{}&Record<string,ProductionObservation[]>={};
for(const [name,root]of Object.entries(roots)){
 const collection=read(join(root,'collection.json')),rows:ProductionObservation[]=[];
 for(const entry of collection.value.entries){
  const dir=join(root,entry.id),manifest=read(join(dir,'manifest.json'));
  for(const cell of manifest.value.cells){
   if(name==='candidate'&&cell.method!=='production')continue;
   const record=read(join(dir,cell.path));assert.equal(record.sha256,cell.sha256);const r=record.value;
   assert.equal(r.planSha256,manifest.value.planSha256);assert.equal(sha(JSON.stringify(r.track)),r.trackHash);
   const c=r.case,key=c.id+':'+r.seed,identity={jolt:manifest.value.plan.jolt,
    ...Object.fromEntries(['durationFrames','contacts','air','samples','specSha256','audioSha256','analysisSha256'].map(k=>[k,c[k]]))};
   if(name==='baseline')identities.set(key,identity);else assert.deepEqual(identity,identities.get(key),'musical inputs differ');
   assert.ok(r.track.lines.every((l:any)=>l.type===0));
   resetFrameCount();setPhysicsFrameLimit(null);
   try{
    const engine=new Engine().setStart(r.track.startPosition,r.track.riders[0].startVelocity).addLine(r.track.lines),raw=extractRawTrajectory(engine,c.durationFrames+20);
    const grade=evaluateDetection(c,detect(raw));assert.deepEqual(grade.score,r.score,'saved musical score differs from independent replay');
    const samples=motionSamples(raw.frames,1,c.durationFrames),opening=samples.filter(s=>s.frame<=120);
    let maxTraceError=0;
    for(let f=0;f<r.trace.frames.length;f++){
     const points=engine.getRider(f).ballisticState().points;
     r.trace.pointIds.forEach((id:string,i:number)=>{maxTraceError=Math.max(maxTraceError,Math.abs(points[id].x-r.trace.frames[f][2*i]),Math.abs(points[id].y-r.trace.frames[f][2*i+1]));});
    }
    assert.ok(maxTraceError<1e-8,'saved rider trace differs from native replay');
    let fulfilled=r.production?.realization.fulfilled??true;
    if(name==='candidate'){
     const collisions=raw.frames.map(f=>engine.getUpdatesAtFrame(f.frame).filter((u:any)=>u.type==='CollisionUpdate').map((u:any)=>u.id));
     const actual=inspectRepertoireLayout(r.production.plan,r.track.lines,r.production.railGuides,collisions,raw.frames.map(f=>f.position));
     assert.equal(actual.fulfilled,r.production.realization.fulfilled,'saved construction qualification differs');fulfilled=actual.fulfilled;
    }
    const errors=grade.observations.filter(o=>o.axis==='impact'&&o.endFrame<=120);
    const openingImpactRms=errors.length&&errors.every(o=>o.error!==null&&Number.isFinite(o.error))?Math.sqrt(errors.reduce((n,o)=>n+o.error!**2,0)/errors.length):null;
    rows.push({song:c.id,seed:r.seed,method:r.method,valid:grade.score.valid,fulfilled,trackHash:r.trackHash,durationFrames:c.durationFrames,
     full:summarizeMotion(samples,1),opening:summarizeMotion(opening,1),openingImpactRms,
     windows:reportedWindows.filter(w=>w.song===c.id&&w.seed===r.seed).map(w=>({from:w.from,to:w.to,
      summary:summarizeMotion(samples.filter(s=>s.frame>=Math.ceil(w.from*40)&&s.frame<=Math.floor(w.to*40)),0)})),
     ...{artifactSha256:record.sha256,maxTraceError}});
   }finally{dispose();setPhysicsFrameLimit(null);}
  }
 }
 sets[name]=rows;console.log(JSON.stringify({collection:name,tracks:rows.length}));
}
const qualification=qualifyProductionMotion(sets.baseline,sets.candidate);
writeGalleryJson(out,'qualification.json',{judge,harness,roots,qualification,observations:sets});
console.log(JSON.stringify(qualification));
