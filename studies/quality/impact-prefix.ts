/** Frozen prefix accounting audit; no search or ruler changes. */
import {writeFileSync} from 'node:fs';
import {loadRun,readTrack} from '../../tools/eval/records.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory} from '../../scripts/lib/detector.ts';
import {impactAccount} from '../../scripts/v0/optimizer/impact_accounts.ts';
const run=loadRun(process.argv[2]),ruler=impactAccount('line.strike.v3'),rows:any[]=[];
for(const c of run.run.panel){
 const track=readTrack(run.dir,c.id),targets=c.targets,duration=run.cells.get(c.id).motion.frames;
 const start=track.riders[0],full=new Engine().setStart(track.startPosition??start.startPosition,start.startVelocity).addLine(track.lines);
 const raw=extractRawTrajectory(full,duration+20),final=ruler.evaluate(ruler.observe(full,raw.frames),targets,duration,true);
 for(let i=1;i<=targets.length;i++){
  const horizon=i<targets.length?targets[i].frame-3:duration+20,lines=track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)<=i);
  const engine=new Engine().setStart(track.startPosition??start.startPosition,start.startVelocity).addLine(lines),part=extractRawTrajectory(engine,horizon);
  const local=ruler.evaluate(ruler.observe(engine,part.frames),targets.slice(0,i),horizon,true),a=local.account.matches.find(m=>m.target===i-1),b=final.account.matches.find(m=>m.target===i-1);
  const before=a?local.events[a.event]:undefined,after=b?final.events[b.event]:undefined;
  rows.push({id:c.id,target:i-1,requested:targets[i-1].impact,horizon,local:before?.strength,final:after?.strength,localComplete:before?.complete,finalComplete:after?.complete,delta:before&&after?after.strength-before.strength:null});
  Engine.retainOnly([full]);
 }
 Engine.retainOnly([]);
}
writeFileSync(process.argv[3],JSON.stringify(rows));const finite=rows.filter(r=>r.delta!==null);
console.log(JSON.stringify({n:rows.length,missing:rows.length-finite.length,changed:finite.filter(r=>Math.abs(r.delta)>1e-9).length,maxDifference:Math.max(...finite.map(r=>Math.abs(r.delta))),meanDifference:finite.reduce((s,r)=>s+r.delta,0)/finite.length}));
