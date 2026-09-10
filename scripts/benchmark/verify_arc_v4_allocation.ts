/** Verify public configuration against a completed, explicitly configured study. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
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
const modelPath='scripts/v0/optimizer/arc_control_policy_model.json';
const storedModel=readFileSync(modelPath),manifest=JSON.parse(storedModel.toString());
let modelBytes=storedModel;
if(manifest.schema==='line.arc-compressed-policy.v1'){
  assert.equal(manifest.compression,'gzip-file');assert.match(manifest.file,/^[a-zA-Z0-9_.-]+\.gz$/);
  const compressed=readFileSync(resolve(dirname(modelPath),manifest.file));
  assert.equal(sha(compressed),manifest.compressedSha256);modelBytes=gunzipSync(compressed);
  assert.equal(modelBytes.length,manifest.uncompressedBytes);assert.equal(sha(modelBytes),manifest.sha256);
}
const researchArtifact=JSON.parse(readFileSync(plan.options.controlPolicyPath,'utf8'));
assert.equal(sha(readFileSync(plan.options.controlPolicyPath)),plan.modelSha256);
const decodedResearchSha256=researchArtifact.schema==='line.arc-compressed-policy.v1'?researchArtifact.sha256:plan.modelSha256;
assert.equal(sha(modelBytes),decodedResearchSha256);
const valuePath='scripts/v0/optimizer/arc_value_model.json',valueSha256=sha(readFileSync(valuePath));
assert.equal(valueSha256,plan.valueModelSha256??sha(readFileSync(resolve(plan.compilerRoot,valuePath))));
// The only motion-source integration difference protects explicit research
// controls. Canonical runs supply neither; full track/work parity is still
// independently checked by preserve_arc_v4_result.ts.
const motionPath='scripts/v0/optimizer/arc_motion.ts',motion=readFileSync(motionPath,'utf8');
const referenceMotion=readFileSync(resolve(plan.compilerRoot,motionPath),'utf8');
const guarded="  // Explicit research controls define the path to evaluate, so a competing\n  // complete-track proposal must not replace it or consume its probe budget.\n  if(!options.policyPreview||options.replayControls||options.directControls)";
assert.deepEqual(motion.replace(guarded,'  if(!options.policyPreview)'),referenceMotion);
assert.ok(!plan.options.replayControls&&!plan.options.directControls);
const motionSources={production:sha(motion),research:sha(referenceMotion),onlyDifference:'bypass preview for explicit replayControls/directControls'};
const sameFiles=['arc_geometry.ts','arc_control_policy.ts','arc_value.ts'];
const sameSources=Object.fromEntries(sameFiles.map(name=>{
  const path='scripts/v0/optimizer/'+name,digest=sha(readFileSync(path));assert.equal(digest,sha(readFileSync(resolve(plan.compilerRoot,path))),path);return [path,digest];
}));
const result={schema:'line.arc-v4-production-allocation-parity.v2',cases:rows.length,exactNonModelOptions:true,
  modelSha256:plan.modelSha256,storedModelSha256:sha(storedModel),valueSha256,planPath,planSha256:sha(bytes),sameSources,motionSources,
  productionCodeSha256:sha(readFileSync('scripts/v0/optimizer/connected_arcs.ts')),scriptSha256:sha(readFileSync(import.meta.filename)),
  note:'Configuration and model/source parity with the declared research candidate. Complete track, score and work parity still requires canonical validation.',rows};
const out=arg('out')!,body=JSON.stringify(result,null,2)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({cases:rows.length,exactNonModelOptions:true,modelSha256:plan.modelSha256}));
