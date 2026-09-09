/** Verify parent exclusion and aggregate live policy-fold studies with fixed V2 scoring. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {summarizeDevelopmentBudget} from '../v0/benchmark_v2/evaluator.ts';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const root=arg('inputs')!,prefix=arg('prefix')!,out=arg('out')!;
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const read=(path:string)=>{const body=readFileSync(path);if(hash(body)!==readFileSync(path+'.sha256','utf8').trim().split(/\s/)[0])throw new Error('checksum '+path);return JSON.parse(body.toString());};
const parents=JSON.parse(readFileSync('benchmark/v2/studies/current-baseline-analysis.json','utf8')).caseStatistics;
const rows:any[]=[],models:any[]=[];
for(let fold=0;fold<5;fold++){
 const path=`${root}/${prefix}-${fold}`,plan=read(path+'/plan.json');read(path+'/summary.json');
 const modelPath=plan.options.controlPolicyPath,model=read(modelPath),heldParents=new Set<string>();
 for(const sourceId of plan.sourceIds){
  const parent=parents.find((r:any)=>r.sourceId===sourceId),parentId=parent.parentId??sourceId;
  if(model.provenance.trainingParents.includes(parentId))throw new Error('training-family leakage');
  heldParents.add(parentId);
  const r=read(`${path}/${sourceId}.json`);
  if(r.options.controlPolicyPath!==modelPath)throw new Error('wrong policy artifact');
  rows.push({sourceId,budget:r.budget,seedSlot:0,actualSeed:r.seed,score:r.score});
 }
 models.push({fold,modelSha256:hash(readFileSync(modelPath)),heldParents:[...heldParents].sort(),trainingParents:model.provenance.trainingParents});
}
if(rows.length!==44||new Set(rows.map(r=>r.sourceId)).size!==44)throw new Error('incomplete fold coverage');
const suite=JSON.parse(readFileSync('benchmark/v2/compat/suite-manifest.json','utf8'));
const result={schema:'line.arc-control-policy-held-families.v1',researchOnly:true,
 note:'Five control-proposal models with complete parent families excluded from their final training datasets. Other fixed models and upstream teacher policies can already depend on development families. This combines models and is neither a fresh independent end-to-end holdout nor canonical confirmation.',
 models,summary:summarizeDevelopmentBudget(rows,750000,suite)};
const body=JSON.stringify(result)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',hash(body)+'\n');
console.log(JSON.stringify({score:result.summary.score,valid:result.summary.validRuns,sources:rows.length}));
