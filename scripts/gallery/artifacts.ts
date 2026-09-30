/** Shared identity, artifact writing and fixed-engine replay for gallery studies. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {sha,type Case} from '../../benchmark/v3/model.ts';
import {evaluateDetection} from '../../benchmark/v4/evaluator.ts';
import {detect,extractRawTrajectory} from '../lib/detector.ts';
const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=
  await import(new URL('../lib/_lr_engine_wasm.ts?gallery-artifact-replay',import.meta.url).href);
export function galleryCompilerIdentity(root:string){
  return JSON.parse(execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',
    'import {compilerCandidateIdentity} from "./scripts/v0/benchmark_v2/compiler_identity.ts"; const {trackedChanges,...identity}=compilerCandidateIdentity("wasm"); console.log(JSON.stringify(identity));'],
    {cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));
}
export const galleryHarnessIdentity=(paths:string[])=>Object.fromEntries(paths.map(p=>[p,sha(readFileSync(p))]));
export function writeGalleryJson(out:string,name:string,value:unknown){
  const body=JSON.stringify(value)+'\n';writeFileSync(resolve(out,name),body);writeFileSync(resolve(out,name+'.sha256'),sha(body)+'\n');return sha(body);
}
export function replayGalleryTrack(track:any,c:Case){
  const pointIds=['PEG','TAIL','NOSE','STRING','BUTT','SHOULDER','RHAND','LHAND','LFOOT','RFOOT'];
  if(!track.lines.every((l:any)=>l.type===0))throw new Error('gallery requires normal lines');
  try{
    const engine=new Engine().setStart(track.startPosition,track.riders[0].startVelocity).addLine(track.lines);
    const det=detect(extractRawTrajectory(engine,c.durationFrames+20));
    const grade=evaluateDetection(c,det);
    const frames=Array.from({length:Math.min(c.durationFrames+20,det.terminus.frame)+1},(_,frame)=>{
      const state=engine.getRider(frame).ballisticState();return pointIds.flatMap(id=>[state.points[id].x,state.points[id].y]);
    });
    return {grade,trace:{fps:40,pointIds,frames,terminus:det.terminus}};
  }finally{dispose();}
}
