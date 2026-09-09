/** Verify accepted training arrivals against complete physical replays. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sha} from '../../benchmark/v3/model.ts';
import {arcArrivalFeatures} from '../v0/optimizer/arc_value.ts';
import {createArcEngine} from '../v0/optimizer/arc_engine.ts';
import {extractRawTrajectory,getRiderMetered,resetFrameCount,setPhysicsFrameLimit} from '../lib/detector.ts';
import {disposeAllWasmEnginesForStudy} from '../lib/native_motion/engine.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim().split(/\s+/)[0]);return JSON.parse((p.endsWith('.gz')?gunzipSync(b):b).toString());};
const rows:any[]=[];let maximum=0,total=0;
for(const path of arg('inputs')!.split(',')){
  const run=read(path+'/run.json.gz');
  for(const source of run.plan.sources){
    const record=read(path+'/'+source+'.json.gz');resetFrameCount();setPhysicsFrameLimit(null);
    let verified=0;
    try{
      const engine=createArcEngine({position:record.track.startPosition,velocity:record.track.riders[0].startVelocity},record.track.lines);
      const end=record.rows.at(-1).next-1,raw=extractRawTrajectory(engine,end);
      for(const row of record.rows.slice(0,-1)){
        const selected=row.lookahead?.probes.find((p:any)=>JSON.stringify(p.control)===JSON.stringify(row.control)&&p.valueFeatures);
        if(!selected)continue;
        const horizon=row.next-1,rider=getRiderMetered(engine,horizon),state=rider.ballisticState(),v=rider.velocity;
        const a=state.points.TAIL,b=state.points.NOSE,dx=b.x-a.x,dy=b.y-a.y;
        const release=raw.frames.slice(row.frame,horizon+1).reverse().find(f=>f.sledContacts.length)?.frame??row.frame;
        const features=arcArrivalFeatures(state,Math.atan2(v.y,v.x)*180/Math.PI,Math.hypot(v.x,v.y),Math.atan2(dy,dx)*180/Math.PI,
          (dx*(b.vy-a.vy)-dy*(b.vx-a.vx))/Math.max(1,dx*dx+dy*dy),horizon-release);
        const difference=Math.max(...features.map((v,i)=>Math.abs(v-selected.valueFeatures[i])));
        assert.ok(difference<1e-11,source+':'+row.frame+':'+difference);maximum=Math.max(maximum,difference);verified++;total++;
      }
    }finally{disposeAllWasmEnginesForStudy();}
    rows.push({path,source,verified});
  }
}
const record={schema:'line.arc-observed-value-replay.v1',total,maximum,rows},body=JSON.stringify(record)+'\n',out=arg('out')!;
writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');console.log(JSON.stringify({total,maximum}));
