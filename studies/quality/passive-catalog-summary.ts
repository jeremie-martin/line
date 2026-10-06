/** Paired catalog reports retain each compiler's original plan and observations. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {summarize,bootstrap,mean} from '../../tools/eval/summary.ts';
const original='/tmp/line-quality-catalog-panel-20261006',passive='/tmp/line-quality-passive-catalog-20261006';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const plans={original:read(join(original,'plan.json')),passive:read(join(passive,'plan.json'))};
assert.equal(plans.passive.baselinePlanSha256,digest(plans.original));
assert.deepEqual(plans.passive.work,plans.original.work);assert.equal(plans.passive.evaluator,plans.original.evaluator);
const sources={baseline:{dir:join(original,'baseline'),plan:plans.original},q62:{dir:join(original,'candidate'),plan:plans.original},passive:{dir:join(passive,'candidate'),plan:plans.passive}};
const ids=plans.original.work.map((w:any)=>`${w.id}~${w.seed}`);
for(const {dir} of Object.values(sources))assert.deepEqual(readdirSync(dir).filter(n=>n.endsWith('.json')).map(n=>n.slice(0,-5)).sort(),[...ids].sort());
const cases=plans.original.work.map((w:any)=>{
 const id=`${w.id}~${w.seed}`,values:any={id,inputSha256:w.inputSha256};let arrangement:unknown;
 for(const [label,{dir,plan}] of Object.entries(sources)){
  const c=read(join(dir,id+'.json'));assert.equal(c.planSha256,digest(plan));assert.equal(c.inputSha256,w.inputSha256);
  const cp=JSON.parse(gunzipSync(readFileSync(join(dir,id+'.checkpoint.json.gz'))).toString());
  assert.equal(c.trackHash,digest(cp.track));
  if(arrangement===undefined)arrangement=cp.repertoire.plan;else assert.deepEqual(cp.repertoire.plan,arrangement,'construction plan changed: '+id);
  values.constructionPlanSha256=digest(arrangement);assert.ok(cp.track.lines.every((l:any)=>l.type===0));
  if(values.group)assert.equal(values.group,c.group);values.group=c.group;
  values[label]={trackHash:c.trackHash,failure:c.failure,requested:c.requested,constructed:c.constructed,layoutFulfilled:c.layoutFulfilled,
   ...summarize(c),cpuSeconds:c.cpuMs/1000,peakRssMiB:c.maxRssKiB/1024};
 }
 return values;
});
const groups=[...new Set<string>(cases.map((c:any)=>c.group))],comparisons:any={};
for(const baseline of ['baseline','q62']){
 const summaries:any={};
 for(const completeBoth of [false,true]){
  const rows=cases.filter((c:any)=>!completeBoth||(c[baseline].complete&&c.passive.complete)),metrics:any={};
  const keys=Object.keys(cases[0].passive).filter(k=>!['trackHash','failure','requested','constructed','layoutFulfilled'].includes(k));
  for(const key of keys){
   const a=new Map<string,number>(),b=new Map<string,number>(),d=new Map<string,number>();let finitePairs=0;
   for(const group of groups){
    const pairs=rows.filter((c:any)=>c.group===group&&typeof c[baseline][key]==='number'&&typeof c.passive[key]==='number'&&Number.isFinite(c[baseline][key])&&Number.isFinite(c.passive[key]));
    finitePairs+=pairs.length;a.set(group,mean(pairs.map((c:any)=>c[baseline][key])));b.set(group,mean(pairs.map((c:any)=>c.passive[key])));
    d.set(group,mean(pairs.map((c:any)=>c.passive[key]-c[baseline][key])));
   }
   metrics[key]={finitePairs,baseline:bootstrap(a),candidate:bootstrap(b),paired:bootstrap(d),perGroup:Object.fromEntries(d)};
  }
  summaries[completeBoth?'completeBoth':'all']={cases:rows.length,metrics};
 }
 comparisons[baseline]={completion:{baseline:cases.filter((c:any)=>c[baseline].complete).length,candidate:cases.filter((c:any)=>c.passive.complete).length,
  recovered:cases.filter((c:any)=>!c[baseline].complete&&c.passive.complete).map((c:any)=>c.id),
  regressed:cases.filter((c:any)=>c[baseline].complete&&!c.passive.complete).map((c:any)=>c.id)},subsets:summaries};
}
const output={schema:'line.quality-passive-catalog.v1',plans,planSha256:{original:digest(plans.original),passive:digest(plans.passive)},
 interpretation:'Complete frozen training-catalog audit, not unseen-music generalization. Every paired value uses identical authored inputs and one evaluator; original baseline observations are reused with their own plan identity. Equal source-group means and group bootstrap. Completion and common-completed quality are separate. Concurrent wall times are not speed evidence.',groups,comparisons,cases};
writeFileSync('/home/wyss/line/docs/research/quality-20261005-passive-catalog.json',JSON.stringify(output)+'\n');
for(const [name,c] of Object.entries(comparisons) as any){console.log(name,JSON.stringify(c.completion));for(const [key,v] of Object.entries(c.subsets.all.metrics) as any)console.log(key,v.paired,v.finitePairs);}
