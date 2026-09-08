/** Verify physical, connected arc geometry and observe the role of both rails. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy} from '../lib/_lr_engine_wasm.ts';
import {extractRawTrajectory,detect,getPhysicsFrameCount,resetFrameCount,setPhysicsFrameLimit} from '../lib/detector.ts';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const input=arg('input')!,out=arg('out')!,parsed=JSON.parse(readFileSync(input,'utf8')),track=parsed.track??parsed;
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const groups=new Map<number,any[]>();
for(const line of track.lines){if(line.type!==0)throw new Error('non-normal geometry');const g=Math.floor((line.id-1000)/10000);const lines=groups.get(g)??[];lines.push(line);groups.set(g,lines);}
const roofIds=new Set<number>(),geometry:any[]=[];
for(const [id,lines] of groups){
  const chains:any[][]=[[]];
  for(const l of lines){const chain=chains.at(-1)!,prev=chain.at(-1);if(prev&&(prev.x2!==l.x1||prev.y2!==l.y1))chains.push([]);chains.at(-1)!.push(l);}
  if(chains.length<1||chains.length>2||chains.some(c=>c.length<2))throw new Error(`not connected arc chains in group ${id}`);
  chains[1]?.forEach(l=>roofIds.add(l.id));
  const lengths=lines.map(l=>Math.hypot(l.x2-l.x1,l.y2-l.y1));
  geometry.push({id,chains:chains.length,segments:lines.length,minSegmentLength:Math.min(...lengths),maxSegmentLength:Math.max(...lengths)});
}
resetFrameCount();setPhysicsFrameLimit(null);
try{
  const engine=new Engine().setStart(track.startPosition,track.riders[0].startVelocity).addLine(track.lines);
  const raw=extractRawTrajectory(engine,track.duration),det=detect(raw),roofFrames=new Set<number>(),roofBodies=new Set<string>();let roofCollisions=0;
  for(let f=1;f<=track.duration;f++)for(const u of engine.getUpdatesAtFrame(f))if(u.type==='CollisionUpdate'&&roofIds.has(u.id)){roofFrames.add(f);roofCollisions++;for(const p of u.updated)roofBodies.add(p.id);}
  const ablated=new Engine().setStart(track.startPosition,track.riders[0].startVelocity).addLine(track.lines.filter((l:any)=>!roofIds.has(l.id)));
  const removed=extractRawTrajectory(ablated,track.duration),removedDet=detect(removed);
  const record={schema:'line.arc-geometry-audit.v1',researchOnly:true,sourceSha256:hash(readFileSync(input)),allNormal:true,groups:geometry,roofCollisionFrames:roofFrames.size,roofCollisions,roofBodies:[...roofBodies],firstRoofCollisionFrame:Math.min(...roofFrames),fullTerminus:det.terminus,roofRemovedTerminus:removedDet.terminus,firstAblationTrajectoryDifference:raw.frames.findIndex((f,i)=>JSON.stringify(f)!==JSON.stringify(removed.frames[i])),auditPhysicsFrames:getPhysicsFrameCount()};
  const body=JSON.stringify(record)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',hash(body)+'\n');console.log(JSON.stringify({...record,groups:{curves:geometry.length,rails:geometry.reduce((s,r)=>s+r.chains,0),segments:track.lines.length,minSegmentLength:Math.min(...geometry.map(r=>r.minSegmentLength))}}));
}finally{disposeAllWasmEnginesForStudy();setPhysicsFrameLimit(null);}
