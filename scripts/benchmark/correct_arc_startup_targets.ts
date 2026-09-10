/** Repair opening-policy target inputs using the frozen authored timeline. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {loadCases,caseSpec,sha} from '../../benchmark/v4/model.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
import {normalizeCompilerTimeline} from '../v0/optimizer/compiler_input.ts';
import {sliceTimeline,effectiveAxes,sampleGapTargets} from '../v0/core/substrate.ts';
import {scheduleNativeContacts} from '../v0/optimizer/native_motion_schedule.ts';
import {makeRng} from '../lib/rng.ts';
import {CALIB} from '../v0/types.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const read=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const input=arg('data')!,data=read(input),cases=loadCases();verifyFrozen();
assert.equal(data.rows.length,cases.length);assert.equal(data.featureSchema,'line.arc-control-policy-features.v1');
const byId=new Map(cases.map(c=>[c.id,c]));
const rows=data.rows.map((row:any)=>{
  assert.equal(row.index,0);assert.equal(row.features.length,57);assert.deepEqual(row.features.slice(49,52),[-1,-1,-1]);
  const provenance=data.provenance.find((x:any)=>x.source===row.source);assert.ok(provenance);
  const planPath=resolve(dirname(provenance.path),'plan.json'),plan=read(planPath);assert.equal(sha(readFileSync(planPath)),provenance.teacherPlanSha256);
  const spec=normalizeCompilerTimeline(caseSpec(byId.get(row.source)!));
  const gaps=sliceTimeline(spec.contacts.map(c=>Math.round(c.t*40)),Math.round(spec.duration*40));
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact&&spec.contacts[g.index].impact!==undefined)g.targets.impact=spec.contacts[g.index].impact;}
  const rng=makeRng(plan.seed),planned=scheduleNativeContacts(gaps.map(g=>({...g,targets:{...g.targets,...sampleGapTargets(g.targets,spec.jitter??CALIB.SIGMA,rng)}})));
  assert.equal(planned[0].startFrame,0);const target=planned[0].targets,features=row.features.slice();
  for(const [index,axis] of ['air','speed','amplitude'].entries())features[49+index]=target[axis as keyof typeof target]??-1;
  assert.ok(features.slice(49,52).some((x:number)=>x!==-1));return {...row,features};
});
const result={...data,rows,startupTargetCorrection:{inputPath:input,inputSha256:sha(readFileSync(input)),cases:rows.length,changedIndices:[49,50,51],
  unchangedPhysicalInputsAndMeasuredControls:true,scriptSha256:sha(readFileSync(import.meta.filename)),
  note:'Opening starts at authored frame zero although the initial physical curve is placed at frame one. Runtime requires authoredStartupTargets. No physics, controls or scored targets are changed.'}};
const out=arg('out')!,body=JSON.stringify(result)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');console.log(JSON.stringify({out,cases:rows.length}));
