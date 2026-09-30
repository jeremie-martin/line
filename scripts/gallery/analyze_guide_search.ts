/** Compare fixed-work search portfolios at common accuracy and guide-count bounds.
 * Usage: node --import tsx scripts/gallery/analyze_guide_search.ts DIR... --out=FILE
 * Does not compare each method against a different self-relative error ceiling. */
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {compareGuideFootprint} from '../v0/optimizer/arc_guide_choice.ts';
const args=process.argv.slice(2),out=args.find(a=>a.startsWith('--out='))?.slice(6);
const reference=args.find(a=>a.startsWith('--reference='))?.slice(12)??'baseline';
assert.ok(out);const roots=args.filter(a=>!a.startsWith('--'));
const rows:any[]=[],sources:any[]=[];
for(const root of roots){
 const path=resolve(root,'results.json');let files:string[];
 try{const study=JSON.parse(readFileSync(path,'utf8'));rows.push(...study.rows);sources.push({path,sha256:sha(readFileSync(path)),plan:study.plan});continue;}catch(error:any){if(error.code!=='ENOENT')throw error;}
 files=readdirSync(root).filter(f=>f.endsWith('.json')&&f!=='plan.json');
 for(const file of files){const path=resolve(root,file),bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());rows.push(JSON.parse(bytes.toString()));}
 sources.push({root,incomplete:true,rows:files.length});
}
const key=(r:any)=>[r.shape??'arcs',r.caseId,r.seed,r.budget].join('|');
const index=new Map(rows.map(r=>[[key(r),r.variant].join('|'),r]));assert.equal(index.size,rows.length,'duplicate experiment row');
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
// Resample seeds as blocks, preserving the six-passage panel within each seed.
// This characterizes search randomness on these passages, not unseen music.
function seedInterval(values:Array<{seed:number;delta:number}>){
 const seeds=[...new Set(values.map(v=>v.seed))];if(seeds.length<2)return null;
 let state=137;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
 const blocks=seeds.map(seed=>values.filter(v=>v.seed===seed).map(v=>v.delta));
 const samples=Array.from({length:4000},()=>mean(seeds.flatMap(()=>blocks[Math.floor(random()*blocks.length)]))!).sort((a,b)=>a-b);
 return {seeds:seeds.length,resamples:samples.length,lower95:samples[Math.floor(samples.length*.025)],upper95:samples[Math.floor(samples.length*.975)]};
}
const valid=(r:any)=>r.candidates.filter((c:any)=>c.valid&&Number.isFinite(c.qualityRms));
const best=(r:any)=>valid(r).slice().sort((a:any,b:any)=>a.qualityRms-b.qualityRms||compareGuideFootprint(a,b))[0];
const variants=[...new Set(rows.map(r=>r.variant))],budgets=[...new Set(rows.map(r=>r.budget))],shapes=[...new Set(rows.map(r=>r.shape??'arcs'))];
const summary=shapes.flatMap(shape=>budgets.flatMap(budget=>variants.map(variant=>{
 const panel=rows.filter(r=>(r.shape??'arcs')===shape&&r.budget===budget&&r.variant===variant),paired=panel.map(r=>({r,b:index.get(key(r)+'|'+reference)})).filter(p=>p.b);
 const deltas=paired.map(({r,b})=>best(r)&&best(b)?best(r).qualityRms-best(b).qualityRms:null).filter((d):d is number=>d!==null);
 const byCeiling=[0,.005,.01,.02,.04,.08].map(extraRms=>{
  const pairs=paired.filter(({b})=>best(b)).map(({r,b})=>{
   const ceiling=best(b).qualityRms+extraRms,choose=(x:any)=>valid(x).filter((c:any)=>c.qualityRms<=ceiling+1e-14).sort(compareGuideFootprint)[0];
   return {seed:r.seed,r:choose(r),b:choose(b)};
  });
  const both=pairs.filter(p=>p.r&&p.b);
  return {extraRms,paired:pairs.length,feasible:pairs.filter(p=>p.r).length,
   meanGuideCount:mean(both.map(p=>p.r.usage.guideSections)),baselineGuideCount:mean(both.map(p=>p.b.usage.guideSections)),
   fewer:both.filter(p=>p.r.usage.guideSections<p.b.usage.guideSections).length,more:both.filter(p=>p.r.usage.guideSections>p.b.usage.guideSections).length,
   meanGuideLength:mean(both.map(p=>p.r.usage.guideLength)),baselineGuideLength:mean(both.map(p=>p.b.usage.guideLength)),
   meanScore:mean(both.map(p=>p.r.score.score)),baselineScore:mean(both.map(p=>p.b.score.score)),
   guideCountDeltaInterval:seedInterval(both.map(p=>({seed:p.seed,delta:p.r.usage.guideSections-p.b.usage.guideSections})))};
 });
 const byGuideFraction=[0,.25,.5,.75,1].map(fraction=>{
  const pairs=paired.map(({r,b})=>{
   const count=b.candidates[0].usage.supportSections,limit=Math.floor(count*fraction);
   const choose=(x:any)=>valid(x).filter((c:any)=>c.usage.guideSections<=limit).sort((a:any,b:any)=>a.qualityRms-b.qualityRms)[0];
   return {seed:r.seed,r:choose(r),b:choose(b)};
  });
  const both=pairs.filter(p=>p.r&&p.b);
  return {fraction,paired:pairs.length,feasible:pairs.filter(p=>p.r).length,baselineFeasible:pairs.filter(p=>p.b).length,
   meanRms:mean(both.map(p=>p.r.qualityRms)),baselineRms:mean(both.map(p=>p.b.qualityRms)),
   better:both.filter(p=>p.r.qualityRms<p.b.qualityRms-1e-12).length,worse:both.filter(p=>p.r.qualityRms>p.b.qualityRms+1e-12).length,
   rmsDeltaInterval:seedInterval(both.map(p=>({seed:p.seed,delta:p.r.qualityRms-p.b.qualityRms})))};
 });
 return {shape,budget,variant,reference,runs:panel.length,paired:paired.length,validPortfolios:panel.filter(r=>best(r)).length,
  meanBestRms:mean(panel.filter(r=>best(r)).map(r=>best(r).qualityRms)),meanBestScore:mean(panel.filter(r=>best(r)).map(r=>best(r).score.score)),
  meanPhysicsFrames:mean(panel.map(r=>r.physicalFrames)),meanCompileMs:mean(panel.map(r=>r.compileMs)),
  bestRmsDelta:mean(deltas),bestRmsWins:deltas.filter(d=>d<-1e-12).length,bestRmsLosses:deltas.filter(d=>d>1e-12).length,
  bestRmsDeltaInterval:seedInterval(paired.filter(({r,b})=>best(r)&&best(b)).map(({r,b})=>({seed:r.seed,delta:best(r).qualityRms-best(b).qualityRms}))),
  byCeiling,byGuideFraction};
})));
const result={schema:'line.guide-search-comparison.v1',sources,summary,rows};mkdirSync(dirname(out),{recursive:true});
const body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
for(const s of summary)console.log(JSON.stringify({...s,byCeiling:s.byCeiling.filter(c=>[0,.01,.02].includes(c.extraRms))}));
