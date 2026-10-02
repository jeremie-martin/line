/** Follow up the owner's review on unchanged saved rides. The contact-update
 * decomposition follows study_motion_quality.ts: an ordered kinetic proxy,
 * not calibrated energy or a perceptual impact definition. No compiler changes.
 */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {ACCENT_BODY_POINTS} from './ride_accents.ts';
import {inspectRailContacts} from './contacts.ts';
import {normImpact} from '../v0/types.ts';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const checked=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim(),p);return b;};
const read=(p:string)=>JSON.parse((p.endsWith('.gz')?gunzipSync(checked(p)):checked(p)).toString());
const panelPath='docs/evidence/interaction-panel-20261002.json',panel=read(panelPath);
const feedbackPath='docs/evidence/interaction-panel-feedback-20261002.json',feedback=read(feedbackPath);
assert.equal(feedback.panelSha256,sha(checked(panelPath)));
const rawPath='generated/beat-salience-20261001/frames.json.gz',raw=read(rawPath);
const accentPath='generated/ride-accents-20261002/frames.json.gz',accent=read(accentPath);
const auditPath='generated/beat-salience-20261001/audit.json',audit=read(auditPath);
const official=createRequire(import.meta.url)('lr-core/line-rider-engine/index.js');
const ids=['PEG','TAIL','NOSE','STRING',...ACCENT_BODY_POINTS],norm=(v:number[])=>Math.hypot(...v);
const requested=panel.clips.map((c:any)=>{
 const r=audit.runs.find((r:any)=>r.version==='current'&&r.song===c.song&&r.seed===c.seed);
 assert.equal(r.trackHash,c.trackHash);
 return {id:c.id,trackHash:c.trackHash,focus:c.focus,beats:r.beats.filter((b:any)=>b.t>=c.range[0]&&b.t<=c.range[1]).map((b:any)=>({time:b.t,target:b.targetImpact,actualFrame:b.actualFrame,measured:b.impact}))};
});
const speedChecks=[];
for(const id of ['sustained-guidance','amour-contrast']){
 const c=panel.clips.find((c:any)=>c.id===id),r=read(c.record);
 assert.equal(sha(checked(c.record)),c.artifactSha256);assert.equal(sha(JSON.stringify(r.track)),c.trackHash);
 assert.ok(r.track.lines.every((l:any)=>l.type===0));
 const series=accent.series.find((s:any)=>s.id===`current-${c.song}-${c.seed}`);
 assert.equal(series.trackHash,c.trackHash);
 const from=Math.ceil(c.focus[0]*40),to=Math.floor(c.focus[1]*40);
 const rows=series.frames.slice(from,to+1).map((f:any)=>({...f,
  gravityGain:f.speedBefore-norm([f.incoming[0],f.incoming[1]-.175]),
  priorSpeed:norm([f.incoming[0],f.incoming[1]-.175])}));
 const sum=(xs:any[],key:string)=>xs.reduce((s,f)=>s+f[key],0);
 const speedBefore=rows[0].priorSpeed,speedAfter=rows.at(-1).speedAfter;
 const solverGain=sum(rows,'speedGain'),gravityGain=sum(rows,'gravityGain');
 assert.ok(Math.abs(speedAfter-speedBefore-solverGain-gravityGain)<1e-8);
 const windows=[1,4,10].map(n=>{
  const candidates=rows.slice(n-1).map((_:any,i:number)=>rows.slice(i,i+n));
  const w=candidates.reduce((a:any[],b:any[])=>sum(b,'speedGain')>sum(a,'speedGain')?b:a);
  return {frames:n,from:w[0].frame,to:w.at(-1).frame,solverGain:sum(w,'speedGain'),gravityGain:sum(w,'gravityGain')};
 });
 let engine=new official.default().setStart(r.track.startPosition,r.track.riders[0].startVelocity);
 engine=engine.addLine(r.track.lines.map((l:any)=>official.createLineFromJson({...l})));
 let maxTraceError=0;
 for(let f=0;f<=to;f++){
  const states=engine.getStateMapAtFrame(f);
  for(const [i,id]of r.trace.pointIds.entries()){
   const p=states.get(id);
   maxTraceError=Math.max(maxTraceError,Math.abs(p.pos.x-r.trace.frames[f][i*2]),Math.abs(p.pos.y-r.trace.frames[f][i*2+1]));
  }
 }
 assert.ok(maxTraceError<1e-8,'reference replay must reproduce the saved native ride');
 const guides=inspectRailContacts(r,[]).guideIds;
 const energy=(s:Map<string,any>)=>ids.reduce((n,id)=>{const p=s.get(id);return n+.5*((p.pos.x-p.prevPos.x)**2+(p.pos.y-p.prevPos.y)**2)/ids.length;},0);
 const mean=(s:Map<string,any>)=>[0,1].map(i=>ACCENT_BODY_POINTS.reduce((n,id)=>{const p=s.get(id);return n+(i?p.pos.y-p.prevPos.y:p.pos.x-p.prevPos.x)/ACCENT_BODY_POINTS.length;},0));
 const groups:Record<string,any>={};
 for(let f=from;f<=to;f++){
  const states=new Map<string,any>(engine.getStateMapAtFrame(f-1));
  for(const u of engine.getUpdatesAtFrame(f)){
   const beforeK=energy(states),beforeSpeed=norm(mean(states));let projection=0,friction=0;
   if(u.type==='CollisionUpdate'){
    const a=states.get(u.updated[0].id),b=u.updated[0];
    const before=[a.pos.x-a.prevPos.x,a.pos.y-a.prevPos.y],after=[b.pos.x-b.prevPos.x,b.pos.y-b.prevPos.y];
    const projected=[before[0]+b.pos.x-a.pos.x,before[1]+b.pos.y-a.pos.y];
    projection=(norm(projected)**2-norm(before)**2)/(2*ids.length);
    friction=(norm(after)**2-norm(projected)**2)/(2*ids.length);
   }
   for(const p of u.updated)states.set(p.id,p);
   const delta=energy(states)-beforeK;
   if(u.type==='CollisionUpdate')assert.ok(Math.abs(projection+friction-delta)<1e-8);
   const category=u.type==='CollisionUpdate'?(guides.has(u.id)?'guideCollision':'mainCollision'):u.type;
   const g=groups[category]??={updates:0,pointKineticProxyChange:0,bodySpeedChange:0,projection:0,friction:0};
   g.updates++;g.pointKineticProxyChange+=delta;g.bodySpeedChange+=norm(mean(states))-beforeSpeed;g.projection+=projection;g.friction+=friction;
  }
  const native=series.frames[f].effective,v=mean(states);
  assert.ok(norm([v[0]-native[0],v[1]-native[1]])<1e-8);
 }
 assert.ok(Math.abs(Object.values(groups).reduce((s,g)=>s+g.bodySpeedChange,0)-(speedAfter-speedBefore))<1e-8);
 speedChecks.push({id,from,to,intervalIncludesBothEndpointFrames:true,speedBefore,speedAfter,solverGain,gravityGain,windows,maxTraceError,groups,
  limitation:'Ordered collision-update decomposition on the unchanged ride, not a counterfactual valid alternative or calibrated mechanical energy. Body and sled constraints redistribute motion.'});
}
const strikeChecks=[];
for(const id of ['clean-landing','amor-strong','luna-strong','tiki-contrast']){
 const c=panel.clips.find((c:any)=>c.id===id),r=read(c.record);
 assert.equal(sha(checked(c.record)),c.artifactSha256);
 const run=audit.runs.find((r:any)=>r.version==='current'&&r.song===c.song&&r.seed===c.seed);
 const old=raw.runs.find((r:any)=>r.version==='current'&&r.song===c.song&&r.seed===c.seed);
 const series=accent.series.find((s:any)=>s.id===`current-${c.song}-${c.seed}`);
 assert.equal(old.trackHash,c.trackHash);assert.equal(series.trackHash,c.trackHash);
 const beat=run.beats.find((b:any)=>b.t>=c.focus[0]&&b.t<=c.focus[1]);assert.ok(beat);
 const steps=old.frames.slice(beat.actualFrame,beat.actualFrame+7).map((f:any)=>({frame:f.f,scoredStep:f.scoredStep}));
 assert.ok(Math.abs(normImpact(steps.reduce((s:any,f:any)=>s+f.scoredStep,0))-beat.impact)<1e-8);
 const point=(f:number,id:string)=>{const i=r.trace.pointIds.indexOf(id);assert.ok(i>=0);return r.trace.frames[f].slice(2*i,2*i+2);};
 const frames=series.frames.slice(beat.actualFrame-2,beat.actualFrame+9).map((f:any)=>{
  const shoulder=point(f.frame,'SHOULDER'),butt=point(f.frame,'BUTT'),nose=point(f.frame,'NOSE'),tail=point(f.frame,'TAIL');
  return {frame:f.frame,meanResponse:f.meanImpulse,headingDegrees:f.headingDegrees,speedBefore:f.speedBefore,speedAfter:f.speedAfter,contacts:f.contacts,
   shoulderBelowButt:shoulder[1]>butt[1],sledAngleDegrees:Math.atan2(nose[1]-tail[1],nose[0]-tail[0])*180/Math.PI};
 });
 strikeChecks.push({id,target:beat.targetImpact,measured:beat.impact,authoredTime:beat.t,actualFrame:beat.actualFrame,steps,frames});
}
const result={schema:'line.interaction-feedback-checks.v1',harnessSha256:sha(readFileSync(import.meta.filename)),feedbackSha256:sha(checked(feedbackPath)),
 panelSha256:sha(checked(panelPath)),sourceAuditSha256:sha(checked(auditPath)),sourceFramesSha256:sha(checked(rawPath)),sourceKinematicsSha256:sha(checked(accentPath)),requested,speedChecks,strikeChecks};
const out='docs/evidence/interaction-feedback-checks-20261002.json',b=JSON.stringify(result,null,2)+'\n';
writeFileSync(out,b);writeFileSync(out+'.sha256',sha(b)+'\n');
console.log(JSON.stringify({speedChecks,strikeChecks:strikeChecks.map(({frames,steps,...s})=>s)}));
