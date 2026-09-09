/** Preserve a canonical public run and verify parity with its research panel. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadCases,sha} from '../../benchmark/v3/model.ts';
import {summarize} from '../../benchmark/v3/evaluator.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim().split(/\s+/)[0]);return JSON.parse((p.endsWith('.gz')?gunzipSync(b):b).toString());};
const canonicalPath=arg('canonical')!,researchPath=arg('research')!,name=arg('name')!;assert.match(name,/^arc-\d+$/);
const canonical=read(canonicalPath),research=read(researchPath),baseline=read('benchmark/v3/runs/initial-after.json.gz'),cases=loadCases();
assert.equal(canonical.plan.profile,'canonical');assert.equal(canonical.plan.compiler.dirty,'');
assert.equal(canonical.plan.suiteFingerprint,baseline.plan.suiteFingerprint);
assert.equal(canonical.plan.budget,750000);assert.deepEqual(canonical.plan.seeds,[16,17]);
assert.deepEqual(canonical.plan.sources,cases.map(c=>c.id));
assert.equal(canonical.rows.length,176);assert.equal(research.rows.length,88);
const summary=summarize(canonical.rows,cases,[16,17]);assert.deepEqual(summary,canonical.summary);
const researchRows=new Map<string,any>(research.rows.map((r:any)=>[r.sourceId,r]));
for(const row of canonical.rows){
  const expected=researchRows.get(row.sourceId);assert.ok(expected);
  assert.equal(row.trackHash,expected.trackHash,row.sourceId+': track');
  assert.equal(row.resources.physicalFrames,expected.stats.sim_frames,row.sourceId+': work');
  assert.deepEqual(row.score,expected.score,row.sourceId+': score');
  assert.ok(row.resources.physicalFrames<=750000);
  assert.equal(row.geometry.allNormal,true);assert.equal(row.geometry.singleSegmentComponents,0);
}
const archivePath=`benchmark/v3/runs/${name}.json.gz`,bytes=gzipSync(readFileSync(canonicalPath));
writeFileSync(archivePath,bytes);writeFileSync(archivePath+'.sha256',sha(bytes)+'\n');
const result={schema:'line.arc-v3-canonical-validation.v1',status:'canonical-result',goal:900,targetReached:summary.headline>=900,
  compilerCommit:canonical.plan.compiler.commit,suiteFingerprint:canonical.plan.suiteFingerprint,summary,
  deltaFromPublishedBaseline:Math.round((summary.headline-baseline.summary.headline)*10000)/10000,
  archive:{path:archivePath,rawSha256:sha(readFileSync(canonicalPath)),sha256:sha(bytes)},
  researchParity:{path:researchPath,sha256:sha(readFileSync(researchPath)),exactTrackAndFrameMatches:canonical.rows.length},
  physicalFrames:{total:canonical.rows.reduce((s:number,r:any)=>s+r.resources.physicalFrames,0),maximum:Math.max(...canonical.rows.map((r:any)=>r.resources.physicalFrames))},
  geometry:{allNormal:true,singleSegmentComponents:0,shortestComponent:Math.min(...canonical.rows.map((r:any)=>r.geometry.shortestComponent))},
  limitations:['Exposed development-trained models; no independent generalization claim.','Two deterministic seeds reproduce 88 distinct tracks.','Substantial normal arc geometry retained; no new owner audiovisual approval.','Frozen V3 inputs, scorer, detector, physics and actual-frame allowance remain unchanged.']};
const out=`benchmark/v3/studies/${name}-validation.json`,body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({headline:summary.headline,valid:summary.valid,matches:canonical.rows.length,out}));
