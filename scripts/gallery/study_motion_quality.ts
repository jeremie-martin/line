/** Read-only motion investigation on the delivered, unfiltered music collection.
 * No compiler, physics, target or benchmark changes. Raw time series stay local. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {inspectRailContacts} from './contacts.ts';
const {LineRiderEngine: Engine,disposeAllWasmEnginesForStudy:dispose}=
 await import(new URL('../lib/_lr_engine_wasm.ts?motion-quality-study',import.meta.url).href);
const official=createRequire(import.meta.url)('lr-core/line-rider-engine/index.js');
const Official=official.default,makeOfficialLine=official.createLineFromJson;
const root='generated/production-repertoire/library-qualified';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'generated/motion-quality-20261001';
mkdirSync(out,{recursive:true});
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const read=(p:string)=>{const b=readFileSync(p);assert.equal(hash(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const write=(name:string,v:any)=>{const b=JSON.stringify(v,null,2)+'\n';writeFileSync(join(out,name),b);writeFileSync(join(out,name+'.sha256'),hash(b)+'\n');};
const norm=(v:number[])=>Math.hypot(...v),sub=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]);
const body=['BUTT','SHOULDER','RHAND','LHAND','LFOOT','RFOOT'];
const points=['PEG','TAIL','NOSE','STRING',...body];
const avg=(xs:number[][])=>[0,1].map(i=>xs.reduce((s,x)=>s+x[i],0)/xs.length);
const angle=(a:number[],b:number[])=>Math.abs(Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]));
const quantile=(xs:number[],q:number)=>{const a=[...xs].sort((a,b)=>a-b);return a.length?a[Math.max(0,Math.ceil(a.length*q)-1)]:null;};
const g=[0,.175];
function snapshot(engine:any,f:number){
 const rider=engine.getRider(f),p=rider.ballisticState().points;
 const position=avg(body.map(id=>[p[id].x,p[id].y]));
 const effective=avg(body.map(id=>[p[id].x-p[id].prevX,p[id].y-p[id].prevY]));
 const incoming=avg(body.map(id=>[p[id].vx,p[id].vy]));
 const allEffective=avg(points.map(id=>[p[id].x-p[id].prevX,p[id].y-p[id].prevY]));
 const k=(after:boolean)=>points.reduce((s,id)=>s+.5*((after?p[id].x-p[id].prevX:p[id].vx)**2+(after?p[id].y-p[id].prevY:p[id].vy)**2),0)/points.length;
 return {p,position,effective,incoming,allEffective,pointEnergyBefore:k(false),pointEnergyAfter:k(true)};
}
function summary(fs:any[]){
 const x=fs.filter(f=>f.f>0);
 const episodes=(threshold:number)=>{let last=-99,n=0;for(const f of x)if(f.gain>threshold){if(f.f-last>3)n++;last=f.f;}return n;};
 return {frames:x.length,seconds:x.length/40,
  speedGainP95:quantile(x.map(f=>f.gain),.95),speedGainP99:quantile(x.map(f=>f.gain),.99),
  maxSpeedGain:Math.max(0,...x.map(f=>f.gain)),positiveSpeedGainSum:x.reduce((s,f)=>s+Math.max(0,f.gain),0),
  max100msExcessSpeedGain:Math.max(0,...x.map(f=>f.gain100ms??0)),
  absoluteSpeedCorrectionSum:x.reduce((s,f)=>s+Math.abs(f.gain),0),
  directionCorrectionSum:x.reduce((s,f)=>s+f.directionCorrection,0),
  sledRotationDegrees:x.reduce((s,f)=>s+f.sledRotation,0)*180/Math.PI,
  residualMagnitudeP95:quantile(x.map(f=>norm(f.residual)),.95),
  residualChangeP95:quantile(x.map(f=>f.residualChange),.95),
  guideContactFrames:x.filter(f=>f.guideIds.length).length,
  bands:[.5,1,2,4].map(threshold=>({threshold,frames:x.filter(f=>f.gain>threshold).length,
   episodes:episodes(threshold),withGuideContact:x.filter(f=>f.gain>threshold&&f.guideIds.length).length,
   outsideLandingImpactWindow:x.filter(f=>f.gain>threshold&&!f.impactCovered).length})),
  peak:x.length?[...x].sort((a,b)=>b.gain-a.gain)[0]:null};
}
const cited=[{song:'amour_de_ma_vie_44s',seed:303,time:9.4,from:9.1,to:9.7},
 {song:'tiki_tiki_48s',seed:101,time:15.32,from:15.05,to:15.65},
 {song:'amour_de_ma_vie_44s',seed:101,time:5.95,from:5.7,to:6.25}];
const collection=read(join(root,'collection.json')),runs:any[]=[],raw:any[]=[],citations:any[]=[],transfers:any[]=[];
let maxReplayError=0,maxIntegratorIdentityError=0;
for(const entry of collection.entries){
 const dir=join(root,entry.id),m=read(join(dir,'manifest.json'));
 for(const cell of m.cells){
  const r=read(join(dir,cell.path));assert.equal(hash(readFileSync(join(dir,cell.path))),cell.sha256);
  assert.ok(r.track.lines.every((l:any)=>l.type===0));
  const engine=new Engine().setStart(r.track.startPosition,r.track.riders[0].startVelocity).addLine(r.track.lines);
  const count=r.trace.frames.length,updates=Array.from({length:count},(_,f)=>engine.getUpdatesAtFrame(f).filter((u:any)=>u.type==='CollisionUpdate'));
  const roles=inspectRailContacts(r,updates.map(us=>us.map((u:any)=>u.id)));
  const actualContacts=r.contacts.map((c:any)=>c.actualFrame).filter((f:any)=>f!==null);
  const starts=[1,...r.case.contacts.map((c:any)=>c.frame)];
  const frames:any[]=[];
  let prior:any;
  for(let f=0;f<count;f++){
   const s=snapshot(engine,f);
   for(const [i,id]of r.trace.pointIds.entries())maxReplayError=Math.max(maxReplayError,Math.abs(s.p[id].x-r.trace.frames[f][2*i]),Math.abs(s.p[id].y-r.trace.frames[f][2*i+1]));
   const section=Math.max(0,starts.reduce((last:number,start:number,i:number)=>start<=f?i:last,-1));
   const request=r.production?.plan.requests[section];
   const residual=f?sub(s.effective,s.incoming):[0,0];
   if(prior)maxIntegratorIdentityError=Math.max(maxIntegratorIdentityError,norm(sub(s.incoming,prior.effective.map((v:number,i:number)=>v+g[i]))));
   const visible=prior?sub(s.position,prior.position):s.incoming;
   const old=frames[f-4];
   frames.push({f,t:f/40,section,construction:request?.construction??'arcs',guidance:request?.guidance??'optional',
    position:s.position,incoming:s.incoming,effective:s.effective,visible,residual,
    speed:norm(s.effective),visibleSpeed:norm(visible),gain:f?norm(s.effective)-norm(s.incoming):0,
    gain100ms:old?norm(s.effective)-norm([old.effective[0],old.effective[1]+4*g[1]]):null,
    relativeGain:f?norm(s.effective)/Math.max(1e-9,norm(s.incoming))-1:0,
    headingChange:f?angle(s.incoming,s.effective):0,
    directionCorrection:f?.5*(norm(s.incoming)+norm(s.effective))*angle(s.incoming,s.effective):0,
    sledRotation:prior?angle([prior.p.NOSE.x-prior.p.TAIL.x,prior.p.NOSE.y-prior.p.TAIL.y],[s.p.NOSE.x-s.p.TAIL.x,s.p.NOSE.y-s.p.TAIL.y]):0,
    residualChange:f?norm(sub(residual,frames[f-1].residual)):0,
    pointEnergyGain:f?s.pointEnergyAfter-s.pointEnergyBefore:0,
    guideIds:roles.byFrame[f].guides,mainIds:roles.byFrame[f].all.filter(id=>!roles.guideIds.has(id)),
    collisions:updates[f].length,
    // Solving frame f changes the stored velocity at f+1. Mirror the scored gate.
    impactCovered:actualContacts.some((start:number)=>f+1>=start&&f+1<=start+6)&&updates[f+1]?.some((u:any)=>u.updated.some((p:any)=>['PEG','TAIL','NOSE','STRING'].includes(p.id)))||false,
    targetImpact:section?r.case.contacts[section-1].impact:null,
    speedTarget:r.case.samples.speed?.[f]??null});
   prior=s;
  }
  assert.ok(maxReplayError<1e-8);assert.ok(maxIntegratorIdentityError<1e-8);
  const song=r.case.id;
  const localTransfers=[];
  for(const section of r.sections){
   const sf=Math.round(section.start*40),ef=Math.round(section.end*40);
   const own=frames.filter(f=>f.f>=sf&&f.f<ef);
   const member=(id:number)=>Math.floor((id-1000)/10000)===section.section;
   const main=own.filter(f=>f.mainIds.some(member)).map(f=>f.f),guide=own.filter(f=>f.guideIds.some(member)).map(f=>f.f);
   if(!main.length||!guide.length)continue;
   const after=guide.filter(f=>f>main.at(-1)!);
   if(after.length>=2){
    const between=frames.slice(main.at(-1)!+1,after[0]);
    localTransfers.push({section:section.section,construction:own[0]?.construction,
     lastMain:main.at(-1),firstGuideAfterMain:after[0],guideFramesAfterMain:after.length,
     collisionFreeFramesBetween:between.filter(f=>f.collisions===0).length,
     guideStartsAfterAllMainContact:guide[0]>main.at(-1)!});
   }
  }
  transfers.push({id:r.id,trackHash:r.trackHash,method:r.method,sections:localTransfers});
  const cleanSummary=(fs:any[])=>{const result=summary(fs);if(result.peak)result.peak={f:result.peak.f,t:result.peak.t,section:result.peak.section,construction:result.peak.construction,gain:result.peak.gain};return result;};
  runs.push({id:r.id,song,seed:r.seed,method:r.method,trackHash:r.trackHash,artifactSha256:cell.sha256,
   score:r.score.score,full:cleanSummary(frames.filter(f=>f.f<=r.case.durationFrames)),
   opening3Seconds:cleanSummary(frames.filter(f=>f.f<=120)),
   lowImpactSupports:cleanSummary(frames.filter(f=>f.targetImpact!==null&&f.targetImpact<=.2&&f.f<=r.case.durationFrames)),
   highImpactSupports:cleanSummary(frames.filter(f=>f.targetImpact!==null&&f.targetImpact>=.8&&f.f<=r.case.durationFrames)),
   worstFrames:[...frames].filter(f=>f.f<=r.case.durationFrames).sort((a,b)=>b.gain-a.gain).slice(0,8)});
  raw.push({id:r.id,method:r.method,song,seed:r.seed,trackHash:r.trackHash,frames});
  for(const target of cited.filter(c=>c.song===song&&c.seed===r.seed)){
   const window=frames.filter(f=>f.t>=target.from&&f.t<=target.to),peak=summary(window).peak;
   citations.push({id:r.id,method:r.method,reportedTime:target.time,window:[target.from,target.to],
    peak,frames:window,section:r.sections.find((s:any)=>s.section===peak.section),
    scoredImpacts:r.observations.filter((o:any)=>o.axis==='impact'&&o.endFrame>=target.from*40-8&&o.endFrame<=target.to*40+8),
    guideSegments:r.track.lines.filter((l:any)=>roles.guideIds.has(l.id)&&Math.floor((l.id-1000)/10000)===peak.section)});
  }
  dispose();
 }
 console.log('measured '+entry.id);
}
// An undeformed free-flight control checks that the residual removes gravity.
{
 const engine=new Engine().setStart({x:0,y:0},{x:4,y:-2});let maxResidual=0;
 for(let f=1;f<=120;f++){const s=snapshot(engine,f);maxResidual=Math.max(maxResidual,norm(sub(s.effective,s.incoming)));}
 assert.ok(maxResidual<1e-8);write('free-flight-control.json',{frames:120,maxResidual,gravity:g});dispose();
}
// Immutable upstream snapshots expose each solver update without engine patches.
const attribution:any[]=[],counterfactuals:any[]=[];
for(const target of cited){
 const dir=join(root,target.song+'-'+target.seed),m=read(join(dir,'manifest.json'));
 for(const cell of m.cells){
  const r=read(join(dir,cell.path)),citation=citations.find(c=>c.id===r.id),peak=citation.peak;
  const native=new Engine().setStart(r.track.startPosition,r.track.riders[0].startVelocity).addLine(r.track.lines);
  let ref=new Official().setStart(r.track.startPosition,r.track.riders[0].startVelocity);
  ref=ref.addLine(r.track.lines.map((l:any)=>makeOfficialLine({...l})));
  let maxError=0;
  for(let f=0;f<=Math.ceil(target.to*40);f++){
   const ns=native.getRider(f).ballisticState().points,rs=ref.getStateMapAtFrame(f);
   for(const id of points){const p=rs.get(id),n=ns[id];for(const [a,b]of [[p.pos.x,n.x],[p.pos.y,n.y],[p.prevPos.x,n.prevX],[p.prevPos.y,n.prevY],[p.vel.x,n.vx],[p.vel.y,n.vy]])maxError=Math.max(maxError,Math.abs(a-b));}
  }
  assert.ok(maxError<1e-8,'upstream/native mismatch');
  const guideIds=inspectRailContacts(r,[]).guideIds;
  const energy=(states:Map<string,any>)=>points.reduce((sum,id)=>{const p=states.get(id);return sum+.5*((p.pos.x-p.prevPos.x)**2+(p.pos.y-p.prevPos.y)**2)/points.length;},0);
  const velocity=(states:Map<string,any>)=>avg(body.map(id=>{const p=states.get(id);return [p.pos.x-p.prevPos.x,p.pos.y-p.prevPos.y];}));
  const attributed=[];
  for(let f=peak.f-2;f<=peak.f+2;f++){
   const states=new Map<string,any>(ref.getStateMapAtFrame(f-1)),groups:any={},events:any[]=[];
   for(const update of ref.getUpdatesAtFrame(f)){
    const beforeK=energy(states),beforeV=velocity(states);
    let contactDetail:any;
    if(update.type==='CollisionUpdate'){
     const a=states.get(update.updated[0].id),b=update.updated[0],n=ref.getLine(update.id).c.norm;
     const before=[a.pos.x-a.prevPos.x,a.pos.y-a.prevPos.y],after=[b.pos.x-b.prevPos.x,b.pos.y-b.prevPos.y];
     const projected=[before[0]+b.pos.x-a.pos.x,before[1]+b.pos.y-a.pos.y];
     contactDetail={storedIntoLine:a.vel.x*n.x+a.vel.y*n.y,effectiveIntoLine:before[0]*n.x+before[1]*n.y,
      before,after,positionCorrection:[b.pos.x-a.pos.x,b.pos.y-a.pos.y],previousPositionCorrection:[b.prevPos.x-a.prevPos.x,b.prevPos.y-a.prevPos.y],
      projectionEnergy:(norm(projected)**2-norm(before)**2)/20,
      frictionEnergy:(norm(after)**2-norm(projected)**2)/20};
    }
    for(const p of update.updated)states.set(p.id,p);
    const deltaK=energy(states)-beforeK,dv=sub(velocity(states),beforeV);
    const category=update.type==='CollisionUpdate'?(guideIds.has(update.id)?'guideCollision':'mainCollision'):update.type;
    const group=groups[category]??={count:0,deltaPointEnergy:0,bodyVelocityDelta:[0,0]};
    group.count++;group.deltaPointEnergy+=deltaK;group.bodyVelocityDelta=group.bodyVelocityDelta.map((v:number,i:number)=>v+dv[i]);
    if(contactDetail){
     assert.ok(Math.abs(contactDetail.projectionEnergy+contactDetail.frictionEnergy-deltaK)<1e-8);
     group.projectionEnergy=(group.projectionEnergy??0)+contactDetail.projectionEnergy;
     group.frictionEnergy=(group.frictionEnergy??0)+contactDetail.frictionEnergy;
    }
    if(update.type==='CollisionUpdate')events.push({line:update.id,role:category,point:update.updated[0].id,deltaPointEnergy:deltaK,...contactDetail});
   }
   const n=snapshot(native,f);assert.ok(norm(sub(velocity(states),n.effective))<1e-8);
   attributed.push({f,groups,collisions:events});
  }
  attribution.push({id:r.id,peakFrame:peak.f,upstreamNativeMaxError:maxError,frames:attributed});
  const removed=new Set<number>(r.track.lines.filter((l:any)=>guideIds.has(l.id)&&Math.floor((l.id-1000)/10000)===peak.section).map((l:any)=>l.id));
  if(removed.size){
   const changed=new Engine().setStart(r.track.startPosition,r.track.riders[0].startVelocity).addLine(r.track.lines.filter((l:any)=>!removed.has(l.id)));
   const first=Array.from({length:peak.f+1},(_,f)=>f).find(f=>native.getUpdatesAtFrame(f).some((u:any)=>u.type==='CollisionUpdate'&&removed.has(u.id)));
   let prefixError=0,firstDivergence:number|null=null,maxGain=-Infinity,alive=true;
   for(let f=0;f<=Math.ceil(target.to*40);f++){
    const original=snapshot(native,f),alternative=snapshot(changed,f);
    const error=Math.max(...points.flatMap(id=>[Math.abs(original.p[id].x-alternative.p[id].x),Math.abs(original.p[id].y-alternative.p[id].y)]));
    if(first!==undefined&&f<first)prefixError=Math.max(prefixError,error);
    if(error>1e-8&&firstDivergence===null)firstDivergence=f;
    if(f>=Math.floor(target.from*40))maxGain=Math.max(maxGain,norm(alternative.effective)-norm(alternative.incoming));
    const state=changed.getRider(f).ballisticState();alive&&=state.riderMounted&&state.sledIntact;
   }
   assert.ok(prefixError<1e-8);
   counterfactuals.push({id:r.id,section:peak.section,removedGuideSegments:removed.size,firstOriginalGuideContact:first,prefixError,firstDivergence,
    originalWindowMaxGain:peak.gain,withoutGuideWindowMaxGain:maxGain,validBodyThroughWindow:alive,
    interpretation:'Fixed-geometry removal with identical earlier prefix. This is a mechanism diagnostic, not a reoptimized replacement or a full valid-track claim.'});
  }
  dispose();
 }
}
// A single normal-line collision isolates the direction-dependent friction rule.
// No coupled rider constraints, gravity step, narrowing corridor or compiler.
const isolatedCollisions:any[]=[];
{
 const peg=new Official().getStateMapAtFrame(0).get('PEG');
 for(const degrees of [-60,-30,0,30,60])for(const flipped of [false,true])for(const direction of [-1,1]){
  const radians=degrees*Math.PI/180,tangent=[Math.cos(radians),Math.sin(radians)];
  const line=makeOfficialLine({id:1,type:0,x1:0,y1:0,x2:100*tangent[0],y2:100*tangent[1],flipped});
  const n=[line.c.norm.x,line.c.norm.y],before=tangent.map((v,i)=>direction*5*v+n[i]);
  const position=tangent.map((v,i)=>50*v+2*n[i]);
  const p=peg.updateState({pos:{x:position[0],y:position[1]},prevPos:{x:position[0]-before[0],y:position[1]-before[1]},vel:{x:before[0],y:before[1]}});
  const q=line.collide(p);assert.ok(q);
  const after=[q.pos.x-q.prevPos.x,q.pos.y-q.prevPos.y];
  isolatedCollisions.push({degrees,flipped,direction,lineType:line.type,friction:peg.friction,before,after,
   speedBefore:norm(before),speedAfter:norm(after),tangentBefore:direction*5,tangentAfter:after[0]*tangent[0]+after[1]*tangent[1]});
 }
 for(const row of isolatedCollisions.filter(r=>r.degrees===0))
  assert.ok(Math.abs(Math.abs(row.tangentAfter)-(row.flipped?6.6:3.4))<1e-8);
}
const unique=[...new Map(runs.map(r=>[r.trackHash,r])).values()];
const result={schema:'line.motion-quality-study.v1',inputs:{collectionSha256:hash(readFileSync(join(root,'collection.json'))),
 engineSha256:hash(readFileSync('engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm')),
 studySha256:hash(readFileSync('scripts/gallery/study_motion_quality.ts'))},
 definitions:{fps:40,gravity:g,bodyPoints:body,energyProxyPoints:points,
  effectiveVelocity:'Mean body (position - previousPosition) after solving a frame; predicts next integration step before gravity.',
  gain:'Magnitude of post-solve effective velocity minus magnitude of that same frame pre-solve velocity (which already includes gravity). px/frame.',
  gain100ms:'Post-solve speed minus speed predicted from the effective velocity four frames earlier plus four gravity steps.',
  energy:'Mean 0.5 * |position - previousPosition|^2 over ten physical points. Kinematic diagnostic, not calibrated mechanical energy.',
  impactCovered:'Whether the next-frame stored-velocity sample is inside an actual landing through landing+6 and has a sled collision, matching the scored window/gate.',
  bands:'Descriptive 0.5/1/2/4 px/frame cut points; not aesthetic thresholds or benchmark penalties.',
  caveats:'Four known songs. Repeated references are duplicate tracks; statistics are descriptive, not independent-seed causal estimates. Shape/state/targets are confounded.'},
 validation:{runs:runs.length,uniqueTracks:unique.length,maxReplayError,maxIntegratorIdentityError},
 isolatedCollisions,runs,citations,attribution,counterfactuals,transfers};
write('study.json',result);
const bytes=gzipSync(JSON.stringify(raw));writeFileSync(join(out,'frames.json.gz'),bytes);writeFileSync(join(out,'frames.json.gz.sha256'),hash(bytes)+'\n');
console.log(JSON.stringify({out,validation:result.validation,citations:citations.map(c=>({id:c.id,t:c.peak.t,gain:c.peak.gain,speed:c.peak.speed,guide:c.peak.guideIds.length}))}));
