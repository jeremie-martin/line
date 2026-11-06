/** Shared identity, artifact writing and fixed-engine replay for gallery studies. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {sha,type Case} from '../lib/case.ts';
import {evaluateDetection} from '../lib/span_grade.ts';
import {detect,extractRawTrajectory} from '../lib/detector.ts';
import {compilerIdentity} from '../lib/compiler_identity.ts';
import {impactRuler} from '../v0/optimizer/impact_accounts.ts';
const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=
  await import(new URL('../lib/_lr_engine_wasm.ts?gallery-artifact-replay',import.meta.url).href);
export const galleryCompilerIdentity=(root:string)=>compilerIdentity(root);
const JUDGE_ENGINE='engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm';
const JUDGE_FILES=['scripts/lib/span_grade.ts','scripts/lib/case.ts','scripts/gallery/contact_impact_grade.ts','scripts/v0/optimizer/impact_accounts.ts','scripts/lib/strike_impact.ts','scripts/lib/contact_impact.ts',
  'scripts/v0/core/substrate.ts','scripts/v0/core/measure.ts','scripts/v0/types.ts','scripts/lib/_lr_engine_wasm.ts','scripts/lib/detector.ts'];
/** Provenance of a saved result: which judge sources and engine produced it. */
export const judgeIdentity=()=>({engineSha256:sha(readFileSync(JUDGE_ENGINE)),files:Object.fromEntries(JUDGE_FILES.map(p=>[p,sha(readFileSync(p))]))});
export const galleryHarnessIdentity=(paths:string[])=>Object.fromEntries(paths.map(p=>[p,sha(readFileSync(p))]));
export function writeGalleryJson(out:string,name:string,value:unknown){
  const body=JSON.stringify(value)+'\n';writeFileSync(resolve(out,name),body);writeFileSync(resolve(out,name+'.sha256'),sha(body)+'\n');return sha(body);
}
export function replayGalleryTrack(track:any,c:Case,includeCollisions=false){
  const pointIds=['PEG','TAIL','NOSE','STRING','BUTT','SHOULDER','RHAND','LHAND','LFOOT','RFOOT'];
  if(!track.lines.every((l:any)=>l.type===0))throw new Error('gallery requires normal lines');
  try{
    const engine=new Engine().setStart(track.startPosition,track.riders[0].startVelocity).addLine(track.lines);
    const raw=extractRawTrajectory(engine,c.durationFrames+20),det=detect(raw);
    const grade=evaluateDetection(c,det);
    const impactEvaluation=impactRuler.evaluate(impactRuler.observe(engine,raw.frames),c.contacts,c.durationFrames,
      det.terminus.reason==='endOfSpec'&&det.terminus.frame>=c.durationFrames);
    const frames=Array.from({length:Math.min(c.durationFrames+20,det.terminus.frame)+1},(_,frame)=>{
      const state=engine.getRider(frame).ballisticState();return pointIds.flatMap(id=>[state.points[id].x,state.points[id].y]);
    });
    const collisionIds=includeCollisions?frames.map((_,frame)=>[...new Set<number>(engine.getUpdatesAtFrame(frame)
      .filter((u:any)=>u.type==='CollisionUpdate').map((u:any)=>u.id))].sort((a,b)=>a-b)):undefined;
    return {grade,trace:{fps:40,pointIds,frames,terminus:det.terminus},collisionIds,impactEvaluation};
  }finally{dispose();}
}
