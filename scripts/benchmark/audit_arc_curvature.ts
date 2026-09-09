/** Observe whether the curvature bound affects accepted geometry, without
 * changing a track or assuming that removing the bound would improve it. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {loadArcCases,requestedArcSuite,caseSpec,sha} from './arc_suite.ts';
import {motionArc} from '../v0/optimizer/arc_geometry.ts';
import {createArcEngine} from '../v0/optimizer/arc_engine.ts';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,getPhysicsFrameCount} from '../lib/detector.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const checked=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(b):b).toString());};
const input=resolve(arg('input')!),run=checked(resolve(input,'run.json.gz')),compilerRoot=resolve(arg('compiler-root')!);
const {connectedArcOptions}=await import(pathToFileURL(resolve(compilerRoot,'scripts/v0/optimizer/connected_arcs.ts')).href);
assert.equal(sha(readFileSync('scripts/v0/optimizer/arc_geometry.ts')),sha(readFileSync(resolve(compilerRoot,'scripts/v0/optimizer/arc_geometry.ts'))));
const rows:any[]=[];resetFrameCount();
for(const c of loadArcCases(requestedArcSuite()).filter(c=>run.plan.sources.includes(c.id))){
  const record=checked(resolve(input,c.id+'.json.gz')),spec=caseSpec(c),options={...connectedArcOptions(spec,run.plan.budget),...run.plan.options};
  const start={position:record.track.startPosition,velocity:record.track.riders[0].startVelocity};let engine=createArcEngine(start);
  try{
    for(const [i,row] of record.rows.entries()){
      const velocity=getRiderMetered(engine,row.frame).velocity;engine.prepareCollisionTrace(row.frame);getRiderMetered(engine,row.frame);
      const trace=engine.readCollisionTrace()[0],points=['PEG','TAIL','NOSE','STRING'].map(key=>trace[key]);
      const build=(radius:number)=>motionArc(points,velocity,row.control,1000+i*10000,options.flow,options.channel,options.wave,radius);
      const bounded=build(options.radius??0),unbounded=build(0),affected=JSON.stringify(bounded)!==JSON.stringify(unbounded);
      const observed=record.observations.find((o:any)=>o.axis==='impact'&&o.gap===i-1);
      rows.push({id:c.id,index:i,frame:row.frame,span:row.next-row.frame,support:row.control.support,curvatureActive:affected,
        impactError:observed?.error,impactTarget:observed?.target,impactAchieved:observed?.achieved});
      const retained=record.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===i),byId=new Map(bounded.map(l=>[l.id,l]));
      for(const line of retained)assert.deepEqual(byId.get(line.id),line);
      engine=engine.addLine(retained).detach();Engine.retainOnly([engine]);
    }
  }finally{dispose();}
}
const high=rows.filter(r=>r.impactError!==undefined&&Math.abs(r.impactError)>.1);
const result={schema:'line.arc-curvature-capacity-audit.v1',input,runSha256:sha(readFileSync(resolve(input,'run.json.gz'))),scriptSha256:sha(readFileSync(import.meta.filename)),
  arcs:rows.length,curvatureActive:rows.filter(r=>r.curvatureActive).length,impactErrorsAbovePointOne:high.length,
  highErrorWithActiveCurvature:high.filter(r=>r.curvatureActive).length,physicsFrames:getPhysicsFrameCount(),rows,
  note:'Descriptive correlation on accepted controls. Changed geometry without the bound is not physically simulated or scored and establishes no attainable improvement.'};
const out=resolve(arg('out')!),body=JSON.stringify(result,null,2)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({...result,rows:undefined}));
