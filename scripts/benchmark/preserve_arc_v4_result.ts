/** Check and preserve a complete public V4 baseline or recovery result. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadCases,sha} from '../../benchmark/v4/model.ts';
import {loadCases as loadV3} from '../../benchmark/v3/model.ts';
import {summarize} from '../../benchmark/v4/evaluator.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse((p.endsWith('.gz')?gunzipSync(b):b).toString());};
const write=(path:string,value:unknown)=>{
  const plain=JSON.stringify(value,null,2)+'\n',bytes=path.endsWith('.gz')?gzipSync(plain):Buffer.from(plain);
  mkdirSync(dirname(path),{recursive:true});
  if(existsSync(path))assert.deepEqual(read(path),value,'refusing to replace different preserved evidence');
  else{writeFileSync(path,bytes);writeFileSync(path+'.sha256',sha(bytes)+'\n');}
};
const path=arg('canonical')!,name=arg('name')!,isBaseline=arg('baseline')==='true'||name==='baseline-930';assert.match(name,/^[a-z0-9-]+$/);
const run=read(path),cases=loadCases(),original=loadV3(),originalIds=new Set(original.map(c=>c.id));
assert.equal(run.plan.profile,'canonical');assert.equal(run.plan.compiler.dirty,'');
assert.equal(run.plan.suiteFingerprint,sha(JSON.stringify(verifyFrozen())));
assert.equal(run.plan.budget,750000);assert.deepEqual(run.plan.seeds,[16,17]);assert.deepEqual(run.plan.sources,cases.map(c=>c.id));
assert.equal(run.rows.length,cases.length*2);
const summary=summarize(run.rows,cases,[16,17]);assert.deepEqual(summary,run.summary);
for(const [panel,selected] of [['v3',original],['extension',cases.filter(c=>!originalIds.has(c.id))]] as const){
  const ids=new Set(selected.map(c=>c.id));assert.deepEqual(summarize(run.rows.filter((r:any)=>ids.has(r.sourceId)),selected,[16,17]),run.panels[panel]);
}
for(const row of run.rows){
  assert.ok(Number.isSafeInteger(row.resources.physicalFrames)&&row.resources.physicalFrames>=0&&row.resources.physicalFrames<=750000);
  assert.equal(row.geometry.allNormal,true);assert.equal(row.geometry.singleSegmentComponents,0);
}
const archivePath=`benchmark/v4/runs/${name}.json.gz`;write(archivePath,run);
const reference=read('benchmark/v3/runs/arc-930.json.gz');assert.equal(reference.summary.headline,930.1556);
const initial=isBaseline?run:read(read('benchmark/v4/baseline.json').archive.path);
assert.equal(initial.plan.suiteFingerprint,run.plan.suiteFingerprint);
const initialUnits=Math.round(initial.summary.headline*10000),referenceUnits=Math.round(reference.summary.headline*10000);
const target=(initialUnits+Math.ceil(3*Math.max(0,referenceUnits-initialUnits)/4))/10000;
let parity:any;
if(isBaseline){
  const old=new Map<string,any>(reference.rows.map((r:any)=>[`${r.sourceId}:${r.seed}`,r]));
  const rows=run.rows.filter((r:any)=>originalIds.has(r.sourceId));assert.equal(rows.length,176);
  for(const row of rows){const previous=old.get(`${row.sourceId}:${row.seed}`)!;assert.ok(previous);
    assert.equal(row.trackHash,previous.trackHash);assert.deepEqual(row.score,previous.score);assert.equal(row.resources.physicalFrames,previous.resources.physicalFrames);}
  parity={kind:'preserved-V3',path:'benchmark/v3/runs/arc-930.json.gz',matches:rows.length};
}else{
  assert.ok(arg('research'),'candidate preservation requires a complete research panel');
  const research=read(arg('research')!);assert.equal(research.plan.suite,'v4');assert.equal(research.plan.budget,750000);assert.equal(research.plan.seed,16);
  assert.deepEqual(research.plan.sources,cases.map(c=>c.id));assert.deepEqual(research.plan.judge,run.plan.judge);
  assert.equal(research.rows.length,176);assert.deepEqual(summarize(research.rows,cases,[16]),research.summary);
  const expected=new Map<string,any>(research.rows.map((r:any)=>[r.sourceId,r]));
  for(const row of run.rows){const r=expected.get(row.sourceId)!;assert.ok(r);assert.equal(row.trackHash,r.trackHash,row.sourceId);assert.deepEqual(row.score,r.score);assert.equal(row.resources.physicalFrames,r.resources.physicalFrames);}
  parity={kind:'research',path:arg('research'),sha256:sha(readFileSync(arg('research')!)),matches:run.rows.length};
}
const before=new Map<string,any>(initial.summary.specifications.map((c:any)=>[c.id,c]));
const paired=summary.specifications.map(c=>({id:c.id,before:before.get(c.id).score,after:c.score,delta:Math.round((c.score-before.get(c.id).score)*10000)/10000}));
const result={schema:'line.arc-v4-canonical-validation.v1',status:isBaseline?'baseline':'canonical-result',
  compilerCommit:run.plan.compiler.commit,suiteFingerprint:run.plan.suiteFingerprint,summary,
  panels:Object.fromEntries(Object.entries(run.panels).map(([k,v]:[string,any])=>[k,{headline:v.headline,valid:v.valid,runs:v.runs,distinctTracks:v.distinctTracks}])),
  referenceV3:reference.summary.headline,baseline:initial.summary.headline,dropFromV3:(referenceUnits-initialUnits)/10000,
  recoveryTarget:target,targetReached:summary.headline>=target,
  recoveredFraction:referenceUnits>initialUnits?(Math.round(summary.headline*10000)-initialUnits)/(referenceUnits-initialUnits):null,
  archive:{path:archivePath,rawSha256:sha(readFileSync(path)),sha256:sha(readFileSync(archivePath))},parity,
  physicalFrames:{total:run.rows.reduce((s:number,r:any)=>s+r.resources.physicalFrames,0),maximum:Math.max(...run.rows.map((r:any)=>r.resources.physicalFrames))},
  geometry:{allNormal:true,singleSegmentComponents:0,shortestComponent:Math.min(...run.rows.map((r:any)=>r.geometry.shortestComponent))},
  improved:paired.filter(c=>c.delta>0).length,regressed:paired.filter(c=>c.delta<0).length,paired,
  limitations:['Exposed development research; no independent generalization claim.','Two deterministic seeds reproduce 176 distinct tracks.','Substantial normal arcs retained; geometry statistics do not establish owner audiovisual approval.','V4 catalog and shared V3 scorer, detector, physics and actual-frame allowance remain frozen.']};
const out=isBaseline?'benchmark/v4/baseline.json':`benchmark/v4/studies/${name}-validation.json`;write(out,result);
console.log(JSON.stringify({headline:summary.headline,valid:summary.valid,target,targetReached:result.targetReached,out}));
