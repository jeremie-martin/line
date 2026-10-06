/** Direct contact-position audit against the published reference engine. */
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {loadRun,readTrack} from '../../tools/eval/records.ts';
import {createArcEngine} from '../../scripts/v0/optimizer/arc_engine.ts';
import {disposeAllWasmEnginesForStudy} from '../../scripts/lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,setPhysicsFrameLimit,getPhysicsFrameCount} from '../../scripts/lib/detector.ts';
const core:any=await import('../../vendor/lr-core/line-rider-engine/index.js');
const Reference=typeof core.default==='function'?core.default:core.default.default,createLine=core.createLineFromJson??core.default.createLineFromJson;
const run=loadRun('/tmp/line-quality-continuation-20261005/generated/eval/q42-additive-future'),rows:any[]=[];
for(const c of run.run.panel){
 const track=readTrack(run.dir,c.id),end=Math.max(...c.targets.map(t=>t.frame)),start={position:track.startPosition,velocity:track.riders[0].startVelocity};
 const expected:any[]=[];let reference=new Reference().setStart(start.position,start.velocity);
 reference=reference.addLine(track.lines.map(json=>{const line=createLine(json),collide=line.collide.bind(line);line.collide=(p:any)=>{const next=collide(p);if(next)expected.push({line:json.id,x:next.pos.x,y:next.pos.y});return next;};return line;}));
 reference.getRider(end);
 const native=createArcEngine(start,track.lines);resetFrameCount();setPhysicsFrameLimit(null);
 getRiderMetered(native,end);const work=getPhysicsFrameCount(),positions=native.getCachedContactPositions(1,end),actual:any[]=[];
 for(let i=0;i<positions.length;i+=3)actual.push({line:positions[i],x:positions[i+1],y:positions[i+2]});
 assert.equal(getPhysicsFrameCount(),work);
 assert.deepEqual(actual,expected,c.id);
 rows.push({id:c.id,contacts:actual.length,sha256:createHash('sha256').update(JSON.stringify(actual)).digest('hex')});
 disposeAllWasmEnginesForStudy();global.gc?.();console.log(c.id,actual.length,'exact');
}
writeFileSync('/tmp/line-cached-contact-audit.json',JSON.stringify({scope:'24 saved complete Q42 tracks; every resolved contact position vs published JS engine',rows},null,1));
