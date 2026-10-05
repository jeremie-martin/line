/** Separate campaign view; published previous studies are never rewritten. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {loadRun,assertPairedRuns} from '../../tools/eval/records.ts';
const root='/home/wyss/line',dir=root+'/generated/report/quality-20261005';
const baseline=loadRun(root+'/generated/eval/quality-20261005-baseline');
const curves:any={};
const runs:any={Baseline:baseline,Q16:loadRun('/tmp/line-quality-continuation-20261005/generated/eval/q16-scatter-alternatives'),
 'Q4-blind':loadRun('/tmp/line-quality-continuation-20261005/generated/eval/q4-value-blind'),
 'Q4-geometry':loadRun('/tmp/line-quality-incidence-20261005/generated/eval/q4-value-geometry')};
for(const [key,run] of Object.entries(runs) as any){
 assertPairedRuns(run,baseline);
 curves[key]=[false,true].map(perturbed=>Array.from({length:10},(_,i)=>{
  const rows=[...run.cells.values()].filter((c:any)=>!!c.case.perturbation===perturbed).flatMap((c:any)=>c.impact3.perBeat)
   .filter((b:any)=>b.requested!=null&&Math.min(9,Math.floor(b.requested*10))===i);
  return {n:rows.length,x:rows.reduce((s:number,r:any)=>s+r.requested,0)/rows.length,
   y:rows.reduce((s:number,r:any)=>s+(r.hit?.strength??0),0)/rows.length};
 }));
}
mkdirSync(dir,{recursive:true});writeFileSync(dir+'/curves.json',JSON.stringify(curves));
writeFileSync(dir+'/index.html',readFileSync(new URL('./report.html',import.meta.url)));
console.log('Separate campaign page: http://localhost:8767/generated/report/quality-20261005/');
