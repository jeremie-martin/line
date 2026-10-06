/** Frozen-track diagnostic: does an existing arrival prior describe the pose
 * that actually reaches the next receiver? No compiler or measure changes. */
import {writeFileSync} from 'node:fs';
import {loadRun,readTrack} from '../../tools/eval/records.ts';
import {observe} from '../../tools/measure/observe.ts';
import {strikeMotionFrames,detectStrikes,accountStrikes,STRIKE_V3_CONTRACT} from '../../tools/measure/strike.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
const run=loadRun(process.argv[2]),rows:any[]=[];
const wrap=(x:number)=>Math.atan2(Math.sin(x),Math.cos(x));
for(const c of run.run.panel){
 const track=readTrack(run.dir,c.id),duration=run.cells.get(c.id).motion.frames;
 const o=observe(track,duration,c.targets),events=detectStrikes(strikeMotionFrames(o),STRIKE_V3_CONTRACT).filter(e=>e.onset<=duration),account=accountStrikes(events,c.targets,STRIKE_V3_CONTRACT);
 const pose=(f:number)=>{const p=o.frames[f].points,n=p[2],t=p[1],x=n[0]-t[0],y=n[1]-t[1],vx=n[0]-n[2]-t[0]+t[2],vy=n[1]-n[3]-t[1]+t[3];return {angle:Math.atan2(y,x),omega:(x*vy-y*vx)/Math.max(1,x*x+y*y)}};
 for(const m of account.matches){const t=c.targets[m.target],e=events[m.event];if(t.impact===null||t.impact<.6)continue;
  const boundary=Math.max(0,t.frame-3),incoming=Math.max(boundary,e.contactStart-1),a=pose(boundary),b=pose(incoming),dt=incoming-boundary;
  rows.push({id:c.id,target:m.target,requested:t.impact,boundary,incoming,dt,angle:a.angle,omega:a.omega,actual:b.angle,
   unpredicted:Math.abs(wrap(a.angle-b.angle)),predicted:Math.abs(wrap(a.angle+a.omega*dt-b.angle)),fixedOne:Math.abs(wrap(a.angle+a.omega-b.angle)),
   unpredictedWrong:Math.abs(a.angle)>Math.PI/2,predictedWrong:Math.abs(wrap(a.angle+a.omega*dt))>Math.PI/2,actualWrong:Math.abs(b.angle)>Math.PI/2});
 }
 Engine.retainOnly([]);
}
writeFileSync(process.argv[3],JSON.stringify(rows));
console.log(JSON.stringify({n:rows.length,meanAngleError:rows.reduce((s,r)=>s+r.unpredicted,0)/rows.length,predictedAngleError:rows.reduce((s,r)=>s+r.predicted,0)/rows.length,
 fixedOneError:rows.reduce((s,r)=>s+r.fixedOne,0)/rows.length,wrong:rows.filter(r=>r.unpredictedWrong!==r.actualWrong).length,predictedWrong:rows.filter(r=>r.predictedWrong!==r.actualWrong).length,meanDt:rows.reduce((s,r)=>s+r.dt,0)/rows.length}));
