/** Instrumentation only; replay a declared training compile exactly. */
import {writeFileSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import inspector from 'node:inspector';
const session=new inspector.Session();session.connect();session.post('HeapProfiler.startSampling',{samplingInterval:131072});let profiled=false;
import {loadCases,caseSpec} from '../../benchmark/v4/model.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
import {compileHandoff} from '../../scripts/v0/optimizer/handoff.ts';
import {productionBudget} from '../../scripts/v0/optimizer/production_budget.ts';
const id=process.argv[2]??'stretch_bridge_frontier_low_air_endurance',seed=101;
const c=loadCases().find(c=>c.id===id)!,spec=caseSpec(c),samples:any[]=[],began=performance.now();let next=began;
const retain=Engine.retainOnly;
Engine.retainOnly=(engines)=>{retain.call(Engine,engines);if(performance.now()<next)return;next=performance.now()+5000;if(!profiled&&process.memoryUsage().heapUsed>1_000_000_000){profiled=true;session.post('HeapProfiler.getSamplingProfile',(error,r)=>{if(error)throw error;writeFileSync('/tmp/line-cached-heap-profile.json',JSON.stringify(r));});}samples.push({s:(performance.now()-began)/1000,engines:engines.length,...process.memoryUsage()});};
const cp=compileHandoff(spec,seed,{budget:productionBudget(spec.duration),creative:{},impactContract:'line.strike.v3',phraseBoundaries:(c.phases??[]).map((p:any)=>p.start).filter(Number.isFinite)});
const ref=JSON.parse(gunzipSync(readFileSync(`/tmp/line-quality-current-value-20261006/generated/value-current/collect/${id}~${seed}.json.gz`)).toString());
const hash=createHash('sha256').update(JSON.stringify(cp.track)).digest('hex');
assert.ok(cp.repertoire!.valid, 'long-track candidate must remain complete');
const done=process.memoryUsage();global.gc?.();
writeFileSync(process.argv[3]??'/tmp/line-memory-profile.json',JSON.stringify({id,trackHash:hash,physicalFrames:cp.repertoire!.physicalFrames,baselineFrames:ref.physicalFrames,trackUnchanged:hash===ref.trackHash,ms:performance.now()-began,samples,done,afterGC:process.memoryUsage()},null,1));
console.log('Candidate memory profile saved');

session.post('HeapProfiler.stopSampling',()=>session.disconnect());
