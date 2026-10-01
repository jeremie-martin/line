/** Diagnostic only: can an unused lower-rail tail be omitted without changing
 * the ride? Select the longest eligible tail per connected construction, record
 * every selected outcome, and never replace the production artifact. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {inspectRailContacts} from './contacts.ts';
import {inspectConstruction} from '../v0/optimizer/repertoire_realization.ts';
const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=
 await import(new URL('../lib/_lr_engine_wasm.ts?motion-tail-study',import.meta.url).href);
const root='generated/production-repertoire/library-qualified',out='generated/motion-quality-20261001';
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const checked=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return b;};
const read=(p:string)=>JSON.parse(checked(p).toString());
const analysis=read(join(out,'study.json')),raw=JSON.parse(gunzipSync(checked(join(out,'frames.json.gz'))).toString());
const best=new Map<string,any>(),counts:Record<string,number>={};
for(const entry of read(join(root,'collection.json')).entries){
 const dir=join(root,entry.id),m=read(join(dir,'manifest.json')),cell=m.cells.find((c:any)=>c.method==='production');
 const record=read(join(dir,cell.path)),guideIds=inspectRailContacts(record,[]).guideIds;
 const frames=raw.find((r:any)=>r.id===record.id).frames,contacts=new Set(frames.flatMap((f:any)=>[...f.mainIds,...f.guideIds]));
 for(const transfer of analysis.transfers.find((r:any)=>r.id===record.id).sections){
  if(transfer.construction==='scattered'||transfer.collisionFreeFramesBetween<1)continue;
  const lines=record.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===transfer.section);
  const main=lines.filter((l:any)=>!guideIds.has(l.id)),last=main.findLastIndex((l:any)=>contacts.has(l.id));
  if(last<0)continue;
  const removed=main.slice(last+1);if(!removed.length)continue;
  assert.ok(removed.every((l:any)=>!contacts.has(l.id)));
  const length=removed.reduce((s:number,l:any)=>s+Math.hypot(l.x2-l.x1,l.y2-l.y1),0);
  counts[transfer.construction]=(counts[transfer.construction]??0)+1;
  if((best.get(transfer.construction)?.length??-1)<length)best.set(transfer.construction,{record,cell,transfer,lines,removed,length});
 }
}
const experiments=[];
for(const [construction,candidate]of best){
 const {record,cell,transfer,lines,removed,length}=candidate,ids=new Set(removed.map((l:any)=>l.id));
 const track={...record.track,lines:record.track.lines.filter((l:any)=>!ids.has(l.id))};
 const engine=new Engine().setStart(track.startPosition,track.riders[0].startVelocity).addLine(track.lines);
 const original=new Engine().setStart(record.track.startPosition,record.track.riders[0].startVelocity).addLine(record.track.lines);
 let maxError=0,maxStateError=0,collisionIdsUnchanged=true;
 const contacts:number[][]=[];
 const originalContacts=raw.find((r:any)=>r.id===record.id).frames.map((f:any)=>[...f.mainIds,...f.guideIds]);
 for(let f=0;f<record.trace.frames.length;f++){
  const state=engine.getRider(f).ballisticState(),prior=original.getRider(f).ballisticState();
  for(const [i,id]of record.trace.pointIds.entries()){
   maxError=Math.max(maxError,Math.abs(state.points[id].x-record.trace.frames[f][2*i]),Math.abs(state.points[id].y-record.trace.frames[f][2*i+1]));
   for(const key of ['x','y','prevX','prevY','vx','vy'])maxStateError=Math.max(maxStateError,Math.abs(state.points[id][key]-prior.points[id][key]));
  }
  const ids=[...new Set<number>(engine.getUpdatesAtFrame(f).filter((u:any)=>u.type==='CollisionUpdate').map((u:any)=>u.id))];
  contacts.push(ids);
  collisionIdsUnchanged&&=ids.length===originalContacts[f].length&&ids.every(id=>originalContacts[f].includes(id));
 }
  const section=record.sections.find((s:any)=>s.section===transfer.section);
  const request=record.production.plan.requests[transfer.section],guideIds=new Set<number>(record.railGuides[transfer.section]??[]);
  const constructionCheck=inspectConstruction(request,track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===transfer.section),
   guideIds,contacts.slice(request.frame,request.next));
  experiments.push({construction,id:record.id,originalSha256:cell.sha256,transfer,removedSegments:removed.length,removedLength:length,
  replayFrames:record.trace.frames.length,maxPositionError:maxError,maxStateError,collisionIdsUnchanged,
  trajectoryUnchanged:maxError===0&&maxStateError===0&&collisionIdsUnchanged,
  constructionCheck,
  originalSectionLines:lines,removedIds:[...ids],pointIds:record.trace.pointIds,
  trace:record.trace.frames.slice(Math.round(section.start*40),Math.round(section.end*40))});
 dispose();
}
mkdirSync(out,{recursive:true});
const result={schema:'line.motion-tail-diagnostic.v1',studySha256:sha(readFileSync('scripts/gallery/study_motion_tail_pruning.ts')),
 sourceStudySha256:sha(readFileSync(join(out,'study.json'))),eligibleByConstruction:counts,
 selection:'Longest never-contacted lower-rail tail per connected construction among supports with at least one contact-free frame before their final guide-only interaction.',
 limitation:'This is a display-geometry diagnostic on known rides. The original frozen construction check is run on the modified section: identical motion does not guarantee the original geometry contract. No new production pattern or compiler default is promoted.',experiments};
const b=JSON.stringify(result,null,2)+'\n';writeFileSync(join(out,'tail-study.json'),b);writeFileSync(join(out,'tail-study.json.sha256'),sha(b)+'\n');
console.log(JSON.stringify({eligible:counts,experiments:experiments.map(({construction,id,transfer,removedSegments,maxPositionError,constructionCheck})=>({construction,id,section:transfer.section,removedSegments,maxPositionError,reasons:constructionCheck.reasons}))}));
