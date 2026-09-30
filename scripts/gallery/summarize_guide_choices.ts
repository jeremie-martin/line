/** Verify every branch, prefix, budget and preference before publishing evidence. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {guideFootprint,selectGuideAlternative} from '../v0/optimizer/arc_guide_choice.ts';
const args=process.argv.slice(2),path=args.find(a=>!a.startsWith('--')),out=args.find(a=>a.startsWith('--out='))?.slice(6);
assert.ok(path&&out,'Supply MANIFEST --out=PATH');
const checked=(path:string,digest?:string)=>{const b=readFileSync(path);assert.equal(sha(b),digest??readFileSync(path+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const manifest=checked(path);assert.equal(manifest.plan.kind,'guide-choice');
assert.deepEqual(checked(resolve(dirname(path),'plan.json'),manifest.planSha256),manifest.plan);
const raw=new Map<string,any>(),cells=new Map<string,any>();let normalLines=0,maxRmsError=0,prefixFrames=0;
for(const cell of manifest.cells){
 assert.ok(!cells.has(cell.id));cells.set(cell.id,cell);
 const r=checked(resolve(dirname(path),cell.path),cell.sha256);raw.set(cell.id,r);
 const {schema,planSha256,case:authored,track,trace,...metadata}=r,{path:artifactPath,sha256,...expected}=cell;
 assert.deepEqual(metadata,expected);assert.equal(planSha256,manifest.planSha256);
 assert.deepEqual(authored,manifest.plan.cases.find((c:any)=>c.id===cell.caseId));
 assert.equal(sha(JSON.stringify(track)),cell.trackHash);assert.equal(track.lines.length,cell.lines);
 assert.ok(track.lines.every((l:any)=>l.type===0&&['x1','y1','x2','y2'].every(k=>Number.isFinite(l[k]))));normalLines+=track.lines.length;
 assert.deepEqual(guideFootprint(track.lines),cell.usage);assert.equal(cell.valid,cell.score.valid);
 assert.ok(Number.isSafeInteger(cell.physicalFrames)&&cell.physicalFrames<=cell.attemptAllowance);
 assert.equal(trace.fps,40);
 if(cell.valid){
  // Independent reconstruction from fixed-judge observations, not the compiler's
  // returned loss. This is its existing authored-axis RMS, not headline points.
  let loss=0,weight=0;
  for(const axis of ['air','speed','amplitude','impact']){
   const observations=cell.observations.filter((o:any)=>o.axis===axis);if(!observations.length)continue;
   const w=axis==='amplitude'?1/3:1,mass=(o:any)=>axis==='impact'?1:o.endFrame-o.startFrame;
   loss+=w*observations.reduce((sum:number,o:any)=>sum+mass(o)*o.error**2,0)/observations.reduce((sum:number,o:any)=>sum+mass(o),0);weight+=w;
  }
  const error=Math.abs(Math.sqrt(loss/weight)-cell.qualityRms);maxRmsError=Math.max(maxRmsError,error);assert.ok(error<1e-12,cell.id);
 }else assert.equal(cell.qualityRms,null);
}
assert.equal(manifest.portfolios.length,manifest.plan.cases.length*manifest.plan.budgets.length*manifest.plan.seeds.length*manifest.plan.methods.length);
const keys=new Set<string>(),owned=new Set<string>();let forks=0,totalWork=0;
for(const p of manifest.portfolios){
 assert.ok(!keys.has(p.key));keys.add(p.key);
 const alternatives=p.ids.map((id:string)=>{assert.ok(!owned.has(id));owned.add(id);const c=cells.get(id);assert.ok(c);assert.equal(c.caseId,p.caseId);assert.equal(c.seed,p.seed);assert.equal(c.budget,p.budget);assert.equal(c.method,p.method??'arcs');return c;});
 assert.equal(p.physicalFrames,p.preparationFrames+alternatives.reduce((s:number,c:any)=>s+c.physicalFrames,0));assert.ok(p.physicalFrames<=p.budget);totalWork+=p.physicalFrames;
 assert.equal(p.physicalFrames,(p.references??[p.reference]).reduce((s:number,id:string)=>s+cells.get(id).physicalFrames,0)+p.decisions.reduce((s:number,d:any)=>s+d.physicalFrames,0));
 assert.equal(p.preparationFrames,p.decisions.reduce((s:number,d:any)=>s+d.preparationFrames,0));
 for(const d of p.decisions){
  forks++;const source=raw.get(d.source),single=raw.get(d.single),guided=raw.get(d.guided);
  const prefix=(r:any)=>r.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)<d.section);
  assert.equal(sha(JSON.stringify(prefix(source))),d.prefixSha256);
  for(const r of [single,guided]){
   assert.deepEqual(prefix(r),prefix(source));assert.equal(r.fork.stateSha256,d.stateSha256);assert.equal(r.fork.prefixSha256,d.prefixSha256);
   assert.deepEqual(r.trace.frames.slice(0,d.frame+1),source.trace.frames.slice(0,d.frame+1));prefixFrames+=d.frame+1;
   assert.equal(r.attemptAllowance,d.allowancePerBranch);assert.equal(r.fork.section,d.section);assert.equal(r.fork.frame,d.frame);
   for(let i=1;i<(d.continuationGuides?.length??0);i++)if(!d.continuationGuides[i])assert.equal(guideFootprint(r.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===d.section+i)).guideSections,0);
  }
  assert.equal(guideFootprint(single.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===d.section)).guideSections,0);
  assert.equal(d.physicalFrames,d.preparationFrames+single.physicalFrames+guided.physicalFrames);
 }
 for(const p0 of p.preferences){const c=selectGuideAlternative(alternatives,p0.extraRms);assert.equal(c?.selected.id??null,p0.selected);assert.equal(c?.best.id??null,p0.best);assert.equal(c?.ceiling??null,p0.ceiling);}
 let count=Infinity,length=Infinity;
 for(let step=0;step<=80;step++){
  const c=selectGuideAlternative(alternatives,step/1000);if(!c)continue;
  assert.ok(c.selected.qualityRms!<=c.ceiling);const u=c.selected.usage;
  assert.ok(u.guideSections<count||u.guideSections===count&&u.guideLength<=length);count=u.guideSections;length=u.guideLength;
 }
}
assert.equal(owned.size,cells.size);
const summary=manifest.plan.methods.flatMap((method:string)=>manifest.plan.budgets.flatMap((budget:number)=>[0,.0025,.005,.01,.02,.04,.08].map(extraRms=>{
 const choices=manifest.portfolios.filter((p:any)=>p.budget===budget&&(p.method??'arcs')===method).map((p:any)=>selectGuideAlternative(p.ids.map((id:string)=>cells.get(id)),extraRms)).filter(Boolean);
 return {method,budget,extraRms,portfolios:choices.length,meanScore:choices.reduce((s:number,c:any)=>s+c.selected.score.score,0)/choices.length,
  meanRms:choices.reduce((s:number,c:any)=>s+c.selected.qualityRms,0)/choices.length,
  guidedSections:choices.reduce((s:number,c:any)=>s+c.selected.usage.guideSections,0),supportSections:choices.reduce((s:number,c:any)=>s+c.selected.usage.supportSections,0),
  guideLength:choices.reduce((s:number,c:any)=>s+c.selected.usage.guideLength,0),
  lowerGuideCountThanBest:choices.filter((c:any)=>c.selected.usage.guideSections<c.best.usage.guideSections).length,
  changedTrack:choices.filter((c:any)=>c.selected.id!==c.best.id).length};
})));
const evidence={schema:'line.guide-choice-study.v1',manifest:{path,sha256:sha(readFileSync(path)),planSha256:manifest.planSha256},plan:manifest.plan,
 checks:{runs:cells.size,valid:[...cells.values()].filter(c=>c.valid).length,normalLines,nonNormalLines:0,forks,exactPrefixFrameComparisons:prefixFrames,
  allChecksumsBudgetsPrefixesAndGuideConstraintsVerified:true,maxIndependentRmsError:maxRmsError,monotonePreferenceChecks:manifest.portfolios.length*81,totalPhysicalFrames:totalWork},summary,
 portfolios:manifest.portfolios,rows:[...cells.values()].map(c=>({id:c.id,caseId:c.caseId,method:c.method,seed:c.seed,budget:c.budget,score:c.score.score,valid:c.valid,hardFailures:c.score.hardFailures,qualityRms:c.qualityRms,usage:c.usage,
  physicalFrames:c.physicalFrames,attemptAllowance:c.attemptAllowance,compileMs:c.compileMs,lines:c.lines,trackHash:c.trackHash,artifactSha256:c.sha256,fork:c.fork,searchBudgetExhausted:c.searchBudgetExhausted})),
 interpretation:'Research portfolios on reused passages with target jitter, not canonical headlines or a capability ceiling. All alternatives, including failed attempts, remain recorded. Preference changes only selection over the fixed pool; it does not reduce generation work or alter the frozen score. Visible-guide count is preferred first, total guide length second. No visual approval or broad generalization is claimed.'};
mkdirSync(dirname(out),{recursive:true});const body=JSON.stringify(evidence,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({checks:evidence.checks,summary}));
