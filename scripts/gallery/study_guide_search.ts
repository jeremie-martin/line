/** Matched guide-search experiments. All variants use the same total allowance.
 * Records every alternative and independently scores every physical replay. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {galleryCases} from './cases.ts';
import {guideConfirmationCases} from './guide_confirmation_cases.ts';
import {galleryMethods} from './methods.ts';
import {caseSpec,sha} from '../../benchmark/v3/model.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
import {galleryCompilerIdentity,galleryHarnessIdentity,writeGalleryJson,replayGalleryTrack} from './artifacts.ts';
import type {GuideStudyOptions} from '../v0/optimizer/arc_guide_study.ts';
import {pathToFileURL} from 'node:url';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const variants:Record<string,GuideStudyOptions>={candidate:{exploration:'balanced',unguidedReference:true},'candidate-memory':{exploration:'balanced',unguidedReference:true,sourceMemory:true},balanced:{exploration:'balanced',unguidedReference:true},'balanced-memory':{exploration:'balanced',unguidedReference:true,sourceMemory:true},dual:{exploration:'accuracy-and-guidance',unguidedReference:true},'dual-memory':{exploration:'accuracy-and-guidance',unguidedReference:true,sourceMemory:true},baseline:{},'guide-aware':{},'guide-aware-memory':{sourceMemory:true},'guide-aware-combined':{exploration:'accuracy-and-guidance',sourceMemory:true},memory:{sourceMemory:true},frontier:{exploration:'accuracy-and-guidance'},combined:{exploration:'accuracy-and-guidance',sourceMemory:true},continuation:{sourceContinuation:true},'frontier-continuation':{exploration:'accuracy-and-guidance',sourceContinuation:true}};
Object.assign(variants,{
  pattern:{exploration:'balanced',unguidedReference:true,preserveGuidePattern:true},
  coverage:{exploration:'coverage',unguidedReference:true},
  'pattern-coverage':{exploration:'coverage',unguidedReference:true,preserveGuidePattern:true},
  'pattern-coverage4':{exploration:'coverage',coverageWidth:4,unguidedReference:true,preserveGuidePattern:true},
  focused:{exploration:'coverage-focused',unguidedReference:true},
  'focused-pattern':{exploration:'coverage-focused',unguidedReference:true,preserveGuidePattern:true},
});
const names=(arg('variants')??'baseline,memory,frontier,combined').split(',');
assert.ok(names.every(n=>n in variants));
const seeds=(arg('seeds')??'231').split(',').map(Number),budgets=(arg('budgets')??'900000').split(',').map(Number);
const panel=arg('panel')??'development';assert.ok(['development','confirmation'].includes(panel));
const available=panel==='confirmation'?[...galleryCases,...guideConfirmationCases]:galleryCases;
const requested=arg('cases')?.split(',');
if(requested)assert.ok(requested.every(id=>available.some(c=>c.id===id)),'unknown case');
const cases=requested?available.filter(c=>requested.includes(c.id)):available;
const shape=arg('shape')??'arcs';assert.ok(['arcs','facets'].includes(shape));
for(const name of names)variants[name]={...variants[name],geometry:shape==='facets'?galleryMethods.facets.geometry:{}};
assert.ok(cases.length&&seeds.every(Number.isSafeInteger)&&budgets.every(b=>Number.isSafeInteger(b)&&b>=20000));
assert.ok(arg('out'));const out=resolve(arg('out')!),compilerRoot=resolve(arg('compiler-root')??'.');mkdirSync(out,{recursive:true});
const {studyGuideChoices}=await import(pathToFileURL(resolve(compilerRoot,'scripts/v0/optimizer/arc_guide_study.ts')).href) as typeof import('../v0/optimizer/arc_guide_study.ts');
const harnessPaths=['scripts/gallery/study_guide_search.ts','scripts/gallery/artifacts.ts','scripts/gallery/cases.ts','scripts/gallery/guide_confirmation_cases.ts','scripts/gallery/methods.ts'];
const plan={schema:'line.guide-search-plan.v1',compilerRoot,compiler:galleryCompilerIdentity(compilerRoot),judge:verifyFrozen(),harness:galleryHarnessIdentity(harnessPaths),panel,shape,cases,seeds,budgets,jitter:.02,variants:Object.fromEntries(names.map(n=>[n,variants[n]]))};
if(existsSync(resolve(out,'plan.json')))assert.deepEqual(JSON.parse(readFileSync(resolve(out,'plan.json'),'utf8')),plan);
else writeGalleryJson(out,'plan.json',plan);const rows:any[]=[];
for(const c of cases)for(const budget of budgets)for(const seed of seeds)for(const variant of names){
 const started=performance.now(),study=studyGuideChoices({...caseSpec(c),jitter:plan.jitter},seed,budget,variants[variant]);
 const compileMs=performance.now()-started;
 const candidates=study.candidates.map(candidate=>{
  const {result,...metadata}=candidate,{grade}=replayGalleryTrack(result.track,c);
  assert.equal(grade.score.valid,candidate.valid);
  let loss=0,weight=0;
  for(const axis of ['air','speed','amplitude','impact']){
   const obs=grade.observations.filter(o=>o.axis===axis);if(!obs.length)continue;
   const w=axis==='amplitude'?1/3:1,mass=(o:any)=>axis==='impact'?1:o.endFrame-o.startFrame;
   if(candidate.valid)assert.ok(obs.every(o=>o.error!==null&&Number.isFinite(o.error)));
   loss+=w*obs.reduce((s,o)=>s+mass(o)*(o.error??0)**2,0)/obs.reduce((s,o)=>s+mass(o),0);weight+=w;
  }
  if(candidate.valid)assert.ok(Math.abs(candidate.qualityRms!-Math.sqrt(loss/weight))<1e-12);
  return {...metadata,score:grade.score,physicalFrames:result.stats.sim_frames,allowance:result.budget,
   trackHash:sha(JSON.stringify(result.track)),observations:grade.observations,searchBudgetExhausted:result.searchBudgetExhausted,
   samples:result.samples,memo:result.candidateMemo,backtracks:result.backtracks,
   fork:result.forkEvidence??null};
 });
 const row={caseId:c.id,shape,cohort:guideConfirmationCases.some(h=>h.id===c.id)?'new-passages':'reused-passages',seed,budget,variant,compileMs,physicalFrames:study.physicalFrames,preparationFrames:study.preparationFrames,policy:study.policy,references:study.references??['reference'],rounds:study.rounds??null,decisions:study.decisions,candidates};
 rows.push(row);writeGalleryJson(out,`${c.id}-${budget}-${seed}-${variant}.json`,row);
 const valid=candidates.filter(c=>c.valid),best=Math.min(...valid.map(c=>c.qualityRms!));
 console.log(JSON.stringify({case:c.id,seed,budget,variant,work:row.physicalFrames,ms:Math.round(compileMs),runs:candidates.length,valid:valid.length,bestRms:best,minimumGuides:Math.min(...valid.map(c=>c.usage.guideSections))}));
}
assert.deepEqual(galleryCompilerIdentity(compilerRoot),plan.compiler);assert.deepEqual(verifyFrozen(),plan.judge);assert.deepEqual(galleryHarnessIdentity(harnessPaths),plan.harness);
writeGalleryJson(out,'results.json',{plan,rows});
