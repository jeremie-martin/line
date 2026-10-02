/** Native provenance/segmentation challenge. Renaming is a control; adding
 * collinear endpoints can change actual native collision physics. Report that
 * change rather than claiming a detector should hide it. Full suffixes replay. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {sha} from '../../benchmark/v3/model.ts';
import {writeGalleryJson,replayGalleryTrack} from './artifacts.ts';
import {CONTACT_IMPACT_CONTRACT} from '../lib/contact_impact.ts';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'generated/general-impact-20261002/tessellation-study';mkdirSync(out,{recursive:true});
const checked=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const sourcePath='generated/general-impact-20261002/construction-assays/plan.json',sources=checked(sourcePath).sources;
const variants=['renamed','split2','split4'];
const plan={schema:'line.contact-tessellation-plan.v1',sources,variants,sourceSha256:sha(readFileSync(sourcePath)),
 contract:CONTACT_IMPACT_CONTRACT,harnessSha256:sha(readFileSync(import.meta.filename)),
 scope:'Fifteen declared development constructions. Same endpoints/straight surfaces; no artistic or search selection. Full native trajectories and unchanged prefix are checked.'};
writeGalleryJson(out,'plan.json',plan);const rows:any[]=[];
for(const source of sources){
 const r=checked(source.path),base=replayGalleryTrack(r.track,r.case,false,CONTACT_IMPACT_CONTRACT.id);
 const frame=r.production.plan.requests[source.section].frame;
 for(const variant of variants){
  const divisions=variant==='renamed'?1:Number(variant.at(-1));
  const lines=r.track.lines.flatMap((l:any)=>{
   const n=Math.floor((l.id-1000)/10000)===source.section?divisions:1;
   return Array.from({length:n},(_,i)=>({...l,id:l.id*8+i,x1:l.x1+(l.x2-l.x1)*i/n,y1:l.y1+(l.y2-l.y1)*i/n,
    x2:l.x1+(l.x2-l.x1)*(i+1)/n,y2:l.y1+(l.y2-l.y1)*(i+1)/n,
    leftExtended:i===0&&l.leftExtended,rightExtended:i===n-1&&l.rightExtended}));
  });
  const replay=replayGalleryTrack({...r.track,lines},r.case,false,CONTACT_IMPACT_CONTRACT.id);
  const maxDelta=(end:number)=>Math.max(0,...base.trace.frames.slice(0,end).flatMap((f:number[],i:number)=>f.map((v,j)=>Math.abs(v-(replay.trace.frames[i]?.[j]??Infinity)))));
  const row={source:source.id,variant,section:source.section,construction:r.production.plan.requests[source.section].construction,
   prefixMaxPositionDelta:maxDelta(frame),fullMaxPositionDelta:maxDelta(base.trace.frames.length),
   baselineTerminus:base.trace.terminus,terminus:replay.trace.terminus,
   unchangedEvents:JSON.stringify(base.impactEvaluation)===JSON.stringify(replay.impactEvaluation),
   baselineAccount:base.impactEvaluation!.account,candidateAccount:replay.impactEvaluation!.account,
   baselineEvents:base.impactEvaluation!.events,candidateEvents:replay.impactEvaluation!.events};
  if(variant==='renamed'){assert.equal(row.fullMaxPositionDelta,0);assert.equal(row.unchangedEvents,true);}
  rows.push(row);
 }
}
writeGalleryJson(out,'results.json',{plan,rows});console.log(JSON.stringify({trials:rows.length,
 renamedIdentical:rows.filter(r=>r.variant==='renamed'&&r.unchangedEvents).length,
 retessellatedDifferent:rows.filter(r=>r.variant!=='renamed'&&r.fullMaxPositionDelta>0).length}));
