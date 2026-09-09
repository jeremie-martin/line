/** Verify public configuration against a completed, explicitly configured study. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadCases,caseSpec,sha} from '../../benchmark/v4/model.ts';
import {connectedArcOptions} from '../v0/optimizer/connected_arcs.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const planPath=resolve(arg('study')!,'plan.json'),bytes=readFileSync(planPath);
assert.equal(sha(bytes),readFileSync(planPath+'.sha256','utf8').trim());
const plan=JSON.parse(bytes.toString()),cases=loadCases();
assert.equal(plan.suite,'v4');assert.equal(plan.budget,750000);assert.deepEqual(plan.sources,cases.map(c=>c.id));
const {connectedArcOptions:reference}=await import(pathToFileURL(resolve(plan.compilerRoot,'scripts/v0/optimizer/connected_arcs.ts')).href);
const strip=({controlPolicy,futureValueModel,controlPolicyPath,valueModelPath,...rest}:any)=>rest;
const rows=cases.map(c=>{
  const spec=caseSpec(c),actual=strip(connectedArcOptions(spec,plan.budget)),expected=strip({...reference(spec,plan.budget),...plan.options});
  assert.deepEqual(actual,expected,c.id);
  return {source:c.id,policySamples:actual.policySamples,lookaheadSamples:actual.lookaheadSamples,
    samples:actual.samples,guidanceSamples:actual.guidanceSamples,responseSamples:actual.responseSamples};
});
const modelPath='scripts/v0/optimizer/arc_control_policy_model.json';assert.equal(sha(readFileSync(modelPath)),plan.modelSha256);
const sameFiles=['arc_motion.ts','arc_geometry.ts','arc_control_policy.ts','arc_value.ts','arc_value_model.json'];
const sameSources=Object.fromEntries(sameFiles.map(name=>{
  const path='scripts/v0/optimizer/'+name,digest=sha(readFileSync(path));assert.equal(digest,sha(readFileSync(resolve(plan.compilerRoot,path))),path);return [path,digest];
}));
const result={schema:'line.arc-v4-production-allocation-parity.v2',cases:rows.length,exactNonModelOptions:true,
  modelSha256:plan.modelSha256,planPath,planSha256:sha(bytes),sameSources,
  productionCodeSha256:sha(readFileSync('scripts/v0/optimizer/connected_arcs.ts')),scriptSha256:sha(readFileSync(import.meta.filename)),
  note:'Configuration and model/source parity with the declared research candidate. Complete track, score and work parity still requires canonical validation.',rows};
const out=arg('out')!,body=JSON.stringify(result,null,2)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({cases:rows.length,exactNonModelOptions:true,modelSha256:plan.modelSha256}));
