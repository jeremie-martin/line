/** Post-selection diagnostic only: all seeds of every failed catalog input at a
 * larger allowance. Never replaces an outcome in the frozen evaluation. Reuses
 * its worker, including cold account/fulfillment and fixed-arrangement checks. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {sha} from '../../benchmark/v3/model.ts';
import {galleryCompilerIdentity,writeGalleryJson} from './artifacts.ts';
const arg=(k:string,d:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const source=resolve(arg('source','generated/general-impact-20261002/complete-contact-panel'));
const out=resolve(arg('out','generated/general-impact-20261002/budget-diagnostic'));
const checked=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const original=checked(join(source,'run.json')),ids=[...new Set<string>(original.rows.filter((r:any)=>!r.candidate.valid||!r.candidate.fulfilled).map((r:any)=>r.id))];
assert.ok(ids.length>0,'no failed inputs to diagnose');
const worker=resolve('scripts/gallery/evaluate_contact_panel.ts'),workerSha=sha(readFileSync(worker));
const plan={...original.plan,ids,budget:5000000,comparisonRunSha256:sha(readFileSync(join(source,'run.json'))),
  diagnosticHarnessSha256:sha(readFileSync(import.meta.filename)),harnessSha256:workerSha,
  purpose:'Post-selection budget diagnostic across every original seed of each failed input. No compiler changes, substitution, new qualification or selection from these outcomes. A changed allowance can change early search choices; this is not continuation of the same prefix.'};
assert.deepEqual(galleryCompilerIdentity(plan.compilerRoot),plan.compiler);
mkdirSync(out,{recursive:true});for(const d of ['cells','tracks','accounts','logs'])mkdirSync(join(out,d),{recursive:true});
writeGalleryJson(out,'plan.json',plan);
const queue=ids.flatMap(id=>plan.seeds.map((seed:number)=>({id,seed})));let completed=0;
await Promise.all(Array.from({length:Math.min(8,queue.length)},async()=>{
  while(queue.length){const {id,seed}=queue.shift()!,fd=openSync(join(out,'logs',`${id}-${seed}.log`),'w');
    try{const code=await new Promise((done,reject)=>{const child=spawn(process.execPath,['--import','tsx',worker,'worker',`--out=${out}`,`--id=${id}`,`--seed=${seed}`],
      {env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',done);});assert.equal(code,0);}
    finally{closeSync(fd);}console.log(JSON.stringify({completed:++completed,total:ids.length*plan.seeds.length}));
  }
}));
assert.equal(sha(readFileSync(worker)),workerSha);assert.deepEqual(galleryCompilerIdentity(plan.compilerRoot),plan.compiler);
const rows=ids.flatMap(id=>plan.seeds.map((seed:number)=>{
  const name=`${id}-${seed}`,after=checked(join(out,'cells',name+'.json')),before=original.rows.find((r:any)=>r.id===id&&r.seed===seed);
  assert.equal(after.planSha256,sha(readFileSync(join(out,'plan.json'))));
  let firstChangedSection:number|null=null;
  if(!after.executionError){
    const a=checked(join(source,'tracks',name+'.json')),b=checked(join(out,'tracks',name+'.json'));
    const sections=(t:any)=>{const m=new Map<number,any[]>();for(const line of t.lines){const i=Math.floor((line.id-1000)/10000);m.set(i,[...m.get(i)??[],line]);}return m;};
    const x=sections(a),y=sections(b);
    firstChangedSection=[...new Set([...x.keys(),...y.keys()])].sort((a,b)=>a-b).find(i=>JSON.stringify(x.get(i))!==JSON.stringify(y.get(i)))??null;
  }
  return {id,seed,before:{candidate:before.candidate,physicalFrames:before.physicalFrames,trackHash:before.trackHash},
    after,firstChangedSection};
}));
writeGalleryJson(out,'run.json',{schema:'line.contact-impact-budget-diagnostic.v1',plan,rows,
  interpretation:'All three-million-frame outcomes remain unchanged and every scheduled five-million-frame diagnostic is retained. Lower loss at a different allowance does not qualify the original candidate or demonstrate a monotonic budget response.'});
