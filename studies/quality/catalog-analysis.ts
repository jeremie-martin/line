/** Explain the completion tradeoff from complete, verified catalog checkpoints. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const main='/home/wyss/line',evidence=JSON.parse(readFileSync(main+'/docs/research/quality-20261005-passive-catalog.json','utf8'));
const dirs={baseline:'/tmp/line-quality-catalog-panel-20261006/baseline',q62:'/tmp/line-quality-catalog-panel-20261006/candidate',passive:'/tmp/line-quality-passive-catalog-20261006/candidate'};
const completion=evidence.comparisons.baseline.completion;
const transitions=[...completion.recovered,...completion.regressed].map((id:string)=>({id,
 ...Object.fromEntries(Object.entries(dirs).map(([label,dir])=>{
  const cp=JSON.parse(gunzipSync(readFileSync(dir+'/'+id+'.checkpoint.json.gz')).toString()),r=cp.repertoire.result;
  const i=r.failure?r.rows.length:evidence.cases.find((c:any)=>c.id===id).passive.constructed;
  return [label,{requested:cp.repertoire.plan.requests.length,constructed:r.rows.length,complete:cp.repertoire.valid,
   failure:r.failure,budget:cp.budget,physicalFrames:cp.work.physicalFrames,backtracks:r.backtracks??null,
   finalRequests:cp.repertoire.plan.requests.slice(Math.max(0,i-2),i+2),budgetInterruptions:r.budgetInterruptions??[],
   lastPlanningDecisions:r.planningDecisions?.slice(-8)??[],trackHash:evidence.cases.find((c:any)=>c.id===id)[label].trackHash}];
 }))}));
const supportCounts=Object.fromEntries(Object.keys(dirs).map(label=>[label,{requested:evidence.cases.reduce((s:number,c:any)=>s+c[label].requested,0),
 constructed:evidence.cases.reduce((s:number,c:any)=>s+c[label].constructed,0),missing:evidence.cases.reduce((s:number,c:any)=>s+c[label].requested-c[label].constructed,0)}]));
writeFileSync(main+'/docs/research/quality-20261005-catalog-analysis.json',JSON.stringify({schema:'line.quality-catalog-analysis.v1',at:new Date().toISOString(),completion,supportCounts,transitions,
 interpretation:'Completion is unchanged in aggregate, not identical case by case. The recovered pickup case reaches102/102 requests; the original exhausted its allowance at76. The new interleaved-recovery failure reaches79/110 and exhausts nearly all4,013,700 frames after56 backtracks. Its next authored terrace spans eight frames. The original completes this identical plan, so it is feasible; this is a limitation of the bounded search/allocation, not a proof of geometric infeasibility or an evidence-integrity failure. Across all31,000 support requests, constructed totals are30,364 original and30,367 final. These counts do not excuse the individual regression.'},null,2)+'\n');
