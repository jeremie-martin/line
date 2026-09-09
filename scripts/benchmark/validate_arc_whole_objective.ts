/** Compare compiler-side whole-track error with the frozen judge on retained tracks. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {loadCases,caseSpec,sha} from '../../benchmark/v3/model.ts';
import {sliceTimeline,effectiveAxes} from '../v0/core/substrate.ts';
import {normalizeCompilerTimeline} from '../v0/optimizer/compiler_input.ts';
import {arcWholeTrajectoryObjective} from '../v0/optimizer/arc_refinement.ts';
import {createArcEngine} from '../v0/optimizer/arc_engine.ts';
import {disposeAllWasmEnginesForStudy} from '../lib/native_motion/engine.ts';
import {extractRawTrajectory,resetFrameCount,setPhysicsFrameLimit,getPhysicsFrameCount} from '../lib/detector.ts';
const rows=[];
for(const c of loadCases()){
  const path=`generated/benchmark-v3/arc-900/full-proposal-slots/${c.id}.json.gz`,bytes=readFileSync(path);
  assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());const record=JSON.parse(gunzipSync(bytes).toString());
  const spec=normalizeCompilerTimeline(caseSpec(c)),gaps=sliceTimeline(spec.contacts.map(c=>Math.round(c.t*40)),Math.round(spec.duration*40));
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact&&spec.contacts[g.index].impact!==undefined)g.targets.impact=spec.contacts[g.index].impact;}
  resetFrameCount();setPhysicsFrameLimit(null);
  try{
    const engine=createArcEngine({position:record.track.startPosition,velocity:record.track.riders[0].startVelocity},record.track.lines);
    const raw=extractRawTrajectory(engine,c.durationFrames+20),actual=arcWholeTrajectoryObjective(raw,record.report,gaps),expected=record.score.weightedAxisRms**2;
    assert.ok(Math.abs(actual.loss-expected)<1e-12,c.id);assert.ok(Math.abs(actual.regrets.reduce((a,b)=>a+b,0)-actual.loss)<1e-12);
    rows.push({source:c.id,expected,actual:actual.loss,error:Math.abs(actual.loss-expected),frames:getPhysicsFrameCount()});
  }finally{disposeAllWasmEnginesForStudy();}
}
const out='generated/benchmark-v3/arc-900/whole-objective-parity.json',body=JSON.stringify({schema:'line.arc-whole-objective-parity.v1',cases:rows.length,maximumError:Math.max(...rows.map(r=>r.error)),rows},null,2)+'\n';
writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');console.log(JSON.stringify({cases:rows.length,maximumError:Math.max(...rows.map(r=>r.error))}));
