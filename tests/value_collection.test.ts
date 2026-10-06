import {expect,it} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy} from '../scripts/lib/native_motion/engine.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {collectFutureProbes} from '../tools/research/value_probes.ts';
import {readCollectionCell} from '../tools/research/value_collect.ts';
import type {Spec} from '../scripts/v0/types.ts';
it('collects native continuation labels without any production planner hook',()=>{
 const spec:Spec={duration:2,preroll:5,jitter:0,contacts:[.6,1.2,1.8].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
 const options={budget:200000,samples:32,channel:12,radius:24,impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,
  impactContract:'line.strike.v3',impactPreparationFrames:2,completeBoundary:true};
 const compiled=compileArcMotion(spec,17,options),source=JSON.stringify(compiled.track);
 const caller=new Engine().setStart({x:444,y:777},{x:5,y:3});
 const snapshots=[0,72].map(frame=>JSON.stringify(caller.getRider(frame).ballisticState()));
 const collected=collectFutureProbes(spec,17,options,compiled.track.lines,compiled.rows,200000);
 expect(collected.probes.length).toBeGreaterThan(0);expect(collected.physicalFrames).toBeGreaterThan(0);
 expect(collected.physicalFrames).toBeLessThanOrEqual(200000);
 expect(collected.probes.every(p=>p.features.length===57&&p.geometry.length===16&&p.depth>=1&&p.depth<=2)).toBe(true);
 expect(collected.probes.some(p=>Number.isFinite(p.pureFuture))).toBe(true);
 expect(JSON.stringify(compiled.track)).toBe(source);
 expect([0,72].map(frame=>JSON.stringify(caller.getRider(frame).ballisticState()))).toEqual(snapshots);
 disposeAllWasmEnginesForStudy();
 expect(collectFutureProbes(spec,17,options,compiled.track.lines,compiled.rows,200000)).toEqual(collected);
},30000);
it('rejects stale and empty collection records before reuse',()=>{
 const dir=mkdtempSync(join(tmpdir(),'value-collection-')),plan={compiler:'A'},w={id:'case',seed:1,inputSha256:'input'};
 const digest=(x:any)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 const row={...w,planSha256:digest(plan),complete:true,construction:[],collection:{interrupted:false},
  probes:[{features:Array(57).fill(0),geometry:Array(16).fill(0),pureFuture:.1}]};
 const save=(r:any)=>writeFileSync(join(dir,'case~1.json.gz'),gzipSync(JSON.stringify(r)));
 try{save(row);expect(readCollectionCell(dir,plan,w)).toEqual(row);
  expect(()=>readCollectionCell(dir,{compiler:'B'},w)).toThrow('another plan');
  save({...row,probes:[]});expect(()=>readCollectionCell(dir,plan,w)).toThrow('no continuation');
  save({...row,construction:{error:'unavailable'}});expect(()=>readCollectionCell(dir,plan,w)).toThrow('construction');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
