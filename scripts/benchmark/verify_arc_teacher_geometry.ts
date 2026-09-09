/** Rebuild recorded teacher controls, including guides removed after construction. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {loadArcCases,requestedArcSuite,caseSpec,sha} from './arc_suite.ts';
import {createArcEngine} from '../v0/optimizer/arc_engine.ts';
import {motionArc} from '../v0/optimizer/arc_geometry.ts';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,getPhysicsFrameCount} from '../lib/detector.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const checked=(path:string)=>{const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(bytes):bytes).toString());};
const input=resolve(arg('input')!),out=resolve(arg('out')!),compilerRoot=resolve(arg('compiler-root')!);
const run=checked(resolve(input,'run.json.gz'));
const {connectedArcOptions}=await import(pathToFileURL(resolve(compilerRoot,'scripts/v0/optimizer/connected_arcs.ts')).href);
const geometryPath='scripts/v0/optimizer/arc_geometry.ts';
assert.equal(sha(readFileSync(geometryPath)),sha(readFileSync(resolve(compilerRoot,geometryPath))));
const rows:any[]=[];
for(const entry of loadArcCases(requestedArcSuite())){
  const path=resolve(input,entry.id+'.json.gz'),record=checked(path),spec=caseSpec(entry);
  const options={...connectedArcOptions(spec,run.plan.budget),...run.plan.options};
  assert.equal(sha(JSON.stringify(record.track)),record.trackHash);
  const start={position:record.track.startPosition,velocity:record.track.riders[0].startVelocity};
  resetFrameCount();let engine=createArcEngine(start);const reference=createArcEngine(start,record.track.lines);
  let rebuilt=0,retainedLines=0;
  try{
    for(const [index,row] of record.rows.entries()){
      const {frame}=row,before=getRiderMetered(engine,frame-1).ballisticState();
      assert.deepEqual(before,getRiderMetered(reference,frame-1).ballisticState(),`${entry.id}:${index} prefix`);
      const velocity=getRiderMetered(engine,frame).velocity;
      engine.prepareCollisionTrace(frame);getRiderMetered(engine,frame);
      const trace=engine.readCollisionTrace()[0];
      const added=motionArc(['PEG','TAIL','NOSE','STRING'].map(key=>trace[key]),velocity,row.control,
        1000+index*10000,options.flow,options.channel,options.wave,options.radius);
      const byId=new Map(added.map(line=>[line.id,line]));
      const retained=record.track.lines.filter((line:any)=>Math.floor((line.id-1000)/10000)===index);
      assert.ok(retained.length);
      for(const line of retained)assert.deepEqual(byId.get(line.id),line,`${entry.id}:${index} geometry`);
      engine=engine.addLine(added).detach();Engine.retainOnly([engine,reference]);
      assert.deepEqual(getRiderMetered(engine,frame-1).ballisticState(),before,`${entry.id}:${index} added prefix`);
      rebuilt++;retainedLines+=retained.length;
    }
    const end=Math.round(spec.duration*40)+20;
    assert.deepEqual(getRiderMetered(engine,end).ballisticState(),getRiderMetered(reference,end).ballisticState(),entry.id+' terminal');
    rows.push({source:entry.id,recordSha256:sha(readFileSync(path)),controls:rebuilt,retainedLines,
      physicsFrames:getPhysicsFrameCount(),exactRetainedGeometry:true,exactPrefixAndTerminalStates:true});
  }finally{dispose();}
}
const result={schema:'line.arc-teacher-control-reconstruction.v1',input,runSha256:sha(readFileSync(resolve(input,'run.json.gz'))),
  geometrySha256:sha(readFileSync(geometryPath)),scriptSha256:sha(readFileSync(import.meta.filename)),
  cases:rows.length,controls:rows.reduce((sum,row)=>sum+row.controls,0),rows};
const body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({cases:result.cases,controls:result.controls,out}));
