/** Independent native replay shared by V6 evidence and production qualification. */
import {extractRawTrajectory,detect} from '../../scripts/lib/detector.ts';
import {evaluateDetection} from '../v4/evaluator.ts';
import type {Case} from '../v4/model.ts';
import type {ProductionPlan} from '../../scripts/v0/optimizer/repertoire_policy.ts';
import {motionSamples,summarizeMotion} from '../../scripts/v0/optimizer/motion_quality.ts';
const {LineRiderEngine:Judge,disposeAllWasmEnginesForStudy:dispose}=
 await import(new URL('../../scripts/lib/_lr_engine_wasm.ts?benchmark-v6-independent',import.meta.url).href);
export function replayV6(track:any,music:Case,plan:ProductionPlan){
 if(!track.lines.every((l:any)=>l.type===0)||new Set(track.lines.map((l:any)=>l.id)).size!==track.lines.length)
  throw new Error('V6 requires normal lines with unique physical IDs');
 try{
  const engine=new Judge().setStart(track.startPosition,track.riders[0].startVelocity).addLine(track.lines);
  const raw=extractRawTrajectory(engine,music.durationFrames+20),grade=evaluateDetection(music,detect(raw));
  const collisions=raw.frames.map(f=>[...new Set<number>(engine.getUpdatesAtFrame(f.frame).filter((u:any)=>u.type==='CollisionUpdate').map((u:any)=>u.id))]);
  const samples=motionSamples(raw.frames,1,music.durationFrames);
  const motion={full:summarizeMotion(samples,1),sections:plan.requests.map(r=>({section:r.section,
   summary:summarizeMotion(samples.filter(s=>s.frame>=r.frame&&s.frame<r.next),r.frame)}))};
  return {grade,collisions,motion,positions:raw.frames.map(f=>f.position)};
 }finally{dispose();}
}
