/** Build a bounded portfolio with paired same-state forks and cached preferences. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {galleryCases} from './cases.ts';
import {guideConfirmationCases} from './guide_confirmation_cases.ts';
import {galleryMethodDetails,galleryMethods} from './methods.ts';
import {caseSpec,sha} from '../../benchmark/v3/model.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
import {galleryCompilerIdentity,galleryHarnessIdentity,writeGalleryJson,replayGalleryTrack} from './artifacts.ts';
import {selectGuideAlternative} from '../v0/optimizer/arc_guide_choice.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const out=resolve(arg('out')??'generated/motion-gallery/20260930-guide-intent'),root=resolve(arg('compiler-root')??'.');
const budgets=(arg('budgets')??'900000').split(',').map(Number),seeds=(arg('seeds')??'231,232,233,234').split(',').map(Number);
const exploration=arg('exploration')??'least-guidance';
assert.ok(['least-guidance','accuracy-and-guidance','balanced','coverage','coverage-focused'].includes(exploration));
const search={exploration,...(exploration==='coverage'?{coverageWidth:Number(arg('coverage-width')??3)}:{}),preserveGuidePattern:process.argv.includes('--preserve-guide-pattern'),sourceMemory:process.argv.includes('--source-memory'),sourceContinuation:process.argv.includes('--source-continuation'),unguidedReference:process.argv.includes('--unguided-reference')};
const panel=arg('panel')??'development';assert.ok(['development','confirmation'].includes(panel));
const available=panel==='confirmation'?[...galleryCases,...guideConfirmationCases]:galleryCases;
const requested=arg('cases')?.split(',');if(requested)assert.ok(requested.every(id=>available.some(c=>c.id===id)));
const cases=requested?available.filter(c=>requested.includes(c.id)):available;
const methods:string[]=(arg('shapes')??'arcs').split(',');assert.ok(methods.every(m=>m==='arcs'||m==='facets'));assert.equal(new Set(methods).size,methods.length);
assert.ok(cases.length&&budgets.every(b=>Number.isSafeInteger(b)&&b>=20000)&&seeds.every(Number.isSafeInteger));
assert.equal(new Set(seeds).size,seeds.length);assert.equal(new Set(budgets).size,budgets.length);
const harness=()=>galleryHarnessIdentity(['scripts/gallery/build_guide_choices.ts','scripts/gallery/artifacts.ts','scripts/gallery/cases.ts','scripts/gallery/guide_confirmation_cases.ts','scripts/gallery/methods.ts','scripts/v0/optimizer/arc_guide_choice.ts']);
const plan={schema:'line.motion-gallery-plan.v1',kind:'guide-choice',researchOnly:true,compilerRoot:root,compiler:galleryCompilerIdentity(root),judge:verifyFrozen(),harness:harness(),cases,budgets,seeds,jitter:.02,search,
  panel,methods,methodDetails:Object.fromEntries(methods.map(m=>[m,galleryMethodDetails[m]])),
  note:'Each beat-level fork starts from the same locked geometry and full physical rider state. Only guide permission at that section changes; each branch searches the remaining ride with shared settings. Independently searched references and preferred complete tracks can differ throughout the ride. Failed branches stay visible. One bounded search portfolio serves every preference setting; the slider only selects recorded tracks. It prefers fewer guide-bearing sections, then shorter visible guides, inside a whole-ride RMS error ceiling relative to the best measured alternative. No per-beat instructions or new benchmark score are introduced.'};
mkdirSync(out,{recursive:true});const write=(name:string,value:unknown)=>writeGalleryJson(out,name,value);
if(existsSync(resolve(out,'plan.json')))assert.deepEqual(JSON.parse(readFileSync(resolve(out,'plan.json'),'utf8')),plan);else write('plan.json',plan);
const planSha256=sha(readFileSync(resolve(out,'plan.json')));
const {studyGuideChoices}=await import(pathToFileURL(resolve(root,'scripts/v0/optimizer/arc_guide_study.ts')).href);
const cells:any[]=[],portfolios:any[]=[];
for(const c of cases)for(const budget of budgets)for(const seed of seeds)for(const method of methods){
  const key=`${c.id}-${budget}-${seed}${methods.length>1||method!=='arcs'?'-'+method:''}`,began=performance.now();
  const geometry:{subdivisions?:number}=method==='facets'?galleryMethods.facets.geometry:{};
  const study=studyGuideChoices({...caseSpec(c),jitter:plan.jitter},seed,budget,{...search,geometry});
  for(const [key,value] of Object.entries(search))assert.equal(study.policy[key],value,'compiler did not apply requested search policy');
  assert.deepEqual(study.policy.geometry,geometry,'compiler did not apply requested geometry');
  const compileMs=performance.now()-began,local=new Map<string,any>(),traces=new Map<string,any>();
  for(const candidate of study.candidates){
    const {result}=candidate,id=`${key}-${candidate.id}`,path=id+'.json';
    const {grade,trace}=replayGalleryTrack(result.track,c);
    assert.equal(grade.score.valid,candidate.valid,'compiler/judge validity disagreement');
    const cell={id,caseId:c.id,method,railLayout:'connected',seed,jitter:plan.jitter,budget,
      score:grade.score,compileMs:candidate.compileMs,physicalFrames:result.stats.sim_frames,attemptAllowance:result.budget,
      lines:result.track.lines.length,trackHash:sha(JSON.stringify(result.track)),observations:grade.observations,contacts:grade.contacts,offBeat:grade.offBeat,
      failure:result.failure??null,terminus:grade.terminus,qualityRms:candidate.qualityRms,valid:candidate.valid,usage:candidate.usage,
      fork:result.forkEvidence??null,searchBudgetExhausted:result.searchBudgetExhausted};
    const digest=write(path,{schema:'line.motion-gallery-cell.v1',planSha256,...cell,case:c,track:result.track,trace});
    const saved={...cell,path,sha256:digest};cells.push(saved);local.set(candidate.id,saved);traces.set(candidate.id,trace);
  }
  for(const d of study.decisions){
    const source=traces.get(d.source).frames.slice(0,d.frame+1);
    for(const id of [d.single,d.guided])assert.deepEqual(traces.get(id).frames.slice(0,d.frame+1),source,'fixed-engine prefix trace changed');
  }
  const ids=[...local.values()].map(r=>r.id);
  const portfolio={key,caseId:c.id,method,budget,seed,ids,reference:local.get('reference').id,references:study.references.map((id:string)=>local.get(id).id),physicalFrames:study.physicalFrames,preparationFrames:study.preparationFrames,compileMs,policy:study.policy,
    rounds:study.rounds.map((r:any)=>({...r,before:r.before.map((id:string)=>local.get(id).id),after:r.after.map((id:string)=>local.get(id).id)})),
    decisions:study.decisions.map((d:any,index:number)=>({...d,id:String(index),source:local.get(d.source).id,single:local.get(d.single).id,guided:local.get(d.guided).id,preferredFromPair:local.get(d.preferredFromPair).id})),
    preferences:[0,.0025,.005,.01,.02,.04,.08].map(extraRms=>{const choice=selectGuideAlternative([...local.values()],extraRms);return {extraRms,selected:choice?.selected.id??null,best:choice?.best.id??null,ceiling:choice?.ceiling??null};})};
  assert.equal(study.physicalFrames,study.preparationFrames+study.candidates.reduce((s:number,c:any)=>s+c.result.stats.sim_frames,0));
  assert.ok(study.physicalFrames<=budget);portfolios.push(portfolio);
  console.log(JSON.stringify({key,runs:local.size,valid:[...local.values()].filter(r=>r.valid).length,forks:portfolio.decisions.length,physicalFrames:study.physicalFrames,compileMs:Math.round(compileMs),preferences:portfolio.preferences.map(p=>({t:p.extraRms,guides:cells.find(c=>c.id===p.selected)?.usage.guideSections,score:cells.find(c=>c.id===p.selected)?.score.score}))}));
}
assert.deepEqual(galleryCompilerIdentity(root),plan.compiler);assert.deepEqual(harness(),plan.harness);assert.deepEqual(verifyFrozen(),plan.judge);
const summary=methods.flatMap(method=>budgets.map(budget=>{const rows=cells.filter(c=>c.budget===budget&&c.method===method),selected=portfolios.filter(p=>p.budget===budget&&p.method===method);return {method,budget,runs:rows.length,valid:rows.filter(r=>r.valid).length,meanScore:rows.reduce((s,r)=>s+r.score.score,0)/rows.length,totalPhysicalFrames:selected.reduce((s,p)=>s+p.physicalFrames,0),totalCompileMs:selected.reduce((s,p)=>s+p.compileMs,0)};}));
write('manifest.json',{schema:'line.motion-gallery.v1',planSha256,plan,cells,portfolios,summary});
console.log(JSON.stringify({complete:true,out:relative(process.cwd(),out),portfolios:portfolios.length,runs:cells.length}));
