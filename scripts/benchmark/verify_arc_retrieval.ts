/** Compare proposal arithmetic against a preserved compiler on measured queries. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha} from './arc_suite.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const candidateRoot=resolve(arg('candidate-root')??'.'),referenceRoot=resolve(arg('reference-root')!);
const code='scripts/v0/optimizer/arc_control_policy.ts';
const {arcControlProposals:candidate}=await import(pathToFileURL(resolve(candidateRoot,code)).href);
const {arcControlProposals:reference}=await import(pathToFileURL(resolve(referenceRoot,code)).href);
const checked=(path:string)=>{const body=readFileSync(path);assert.equal(sha(body),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(body.toString());};
const modelPath=arg('model')??resolve(candidateRoot,'scripts/v0/optimizer/arc_control_policy_model.json');
const modelBytes=readFileSync(modelPath),artifact=JSON.parse(modelBytes.toString());
const {parseArcPolicyArtifact}=artifact.schema==='line.arc-compressed-policy.v1'?
  await import(pathToFileURL(resolve(candidateRoot,'scripts/v0/optimizer/connected_arcs.ts')).href):{};
const model=parseArcPolicyArtifact?parseArcPolicyArtifact(modelBytes,pathToFileURL(resolve(modelPath))):checked(modelPath);
const dataPath=arg('data')!,data=checked(dataPath);
const records=Array.from({length:256},(_,i)=>data.rows[Math.floor(i*(data.rows.length-1)/255)]);
const queries=records.flatMap((r:any,i:number)=>[r.features,r.features.map((x:number,k:number)=>x+.013*Math.sin(i*7+k*3))]);
const timings:{reference:number[];candidate:number[]}={reference:[],candidate:[]};let matches=0;
for(let round=0;round<4;round++){
  const outputs=[];
  for(const name of (round%2?['candidate','reference']:['reference','candidate']) as Array<keyof typeof timings>){
    const fn=name==='candidate'?candidate:reference,start=performance.now();
    const values=queries.map((features:number[],i:number)=>fn(features,15,8+i%160,model,[1,8,16,24,32,48][i%6]));
    timings[name].push(performance.now()-start);outputs.push(values);
  }
  assert.deepEqual(outputs[0],outputs[1]);matches+=queries.length;
}
const result={schema:'line.arc-retrieval-parity.v1',queries:queries.length,comparisons:matches,exactProposalParity:true,
  candidateRoot,referenceRoot,candidateCodeSha256:sha(readFileSync(resolve(candidateRoot,code))),referenceCodeSha256:sha(readFileSync(resolve(referenceRoot,code))),
  modelPath,modelSha256:sha(readFileSync(modelPath)),dataPath,dataSha256:sha(readFileSync(dataPath)),scriptSha256:sha(readFileSync(import.meta.filename)),
  queryRecipe:'256 evenly spaced measured records and deterministic +/-0.013 feature perturbations; proposal counts 1,8,16,24,32,48; four interleaved comparisons.',timingsMs:timings,
  note:'Local query microbenchmark, possibly alongside other work; not an end-to-end compiler speed claim.'};
const out=resolve(arg('out')!),body=JSON.stringify(result,null,2)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify(result));
