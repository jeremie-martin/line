/** Controlled diagnosis: same prefix, source controls, shape and branch budget;
 * vary only later guide permissions and the allowance. Not a portfolio benchmark. */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {studyGuideChoices,captureArcFork} from '../v0/optimizer/arc_guide_study.ts';
import {compileArcMotion} from '../v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../v0/optimizer/connected_arcs.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {guideFootprint} from '../v0/optimizer/arc_guide_choice.ts';
import {caseSpec} from '../../benchmark/v3/model.ts';
import {galleryCases} from './cases.ts';
import {galleryCompilerIdentity,galleryHarnessIdentity,replayGalleryTrack,writeGalleryJson} from './artifacts.ts';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);assert.ok(out);mkdirSync(out,{recursive:true});
const identity=galleryCompilerIdentity(process.cwd());
const plan={compiler:identity,harness:galleryHarnessIdentity(['scripts/gallery/probe_guide_continuations.ts','scripts/gallery/artifacts.ts']),
  cases:[{id:'quick-pickups',seed:242},{id:'staccato-release',seed:243}],sourceBudget:900000,branchBudgets:[25000,100000,250000],jitter:.02};
writeGalleryJson(out,'plan.json',plan);
const rows:any[]=[],sources:any[]=[];
for(const choice of plan.cases){
 const c=galleryCases.find(c=>c.id===choice.id)!,spec={...caseSpec(c),jitter:plan.jitter};
 const study=studyGuideChoices(spec,choice.seed,plan.sourceBudget,{exploration:'balanced',unguidedReference:true});
 const valid=study.candidates.filter(c=>c.valid).sort((a,b)=>a.qualityRms!-b.qualityRms!);
 const n=valid[0].usage.supportSections;
 const selected=[{kind:'best-accuracy',source:valid[0]},{kind:'best-half-cap',source:valid.find(c=>c.usage.guideSections<=Math.floor(n/2))!}];
 for(const {kind,source} of selected){
  const groups=arcRailGroups(source.result.track.lines),section=[...groups].find(([i,g])=>i>0&&g[1]?.length)?.[0]??1;
  const captured=captureArcFork(source.result,section),pattern=source.result.rows.slice(section).map((_,i)=>!!groups.get(section+i)?.[1]?.length);
  sources.push({caseId:c.id,seed:choice.seed,kind,id:source.id,qualityRms:source.qualityRms,usage:source.usage,section,pattern,sourceConstructionFrames:study.physicalFrames,prefixCheckFrames:captured.physicsFrames,prefixSha256:captured.prefixSha256});
  for(const budget of plan.branchBudgets)for(const preserve of [false,true])for(const guides of [false,true]){
   const fork={...captured.fork,guides,...(preserve?{continuationGuides:pattern}:{})};
   const result=compileArcMotion(spec,choice.seed,{...connectedArcOptions(spec,study.referenceBudget),policyPreview:false,collectTrajectoryLoss:true,budget,fork});
   const {grade}=replayGalleryTrack(result.track,c);assert.ok(result.stats.sim_frames<=budget);
   assert.equal(result.forkEvidence?.prefixSha256,captured.prefixSha256);
   assert.equal(result.forkEvidence?.stateSha256,captured.fork.stateSha256);
   const row={caseId:c.id,seed:choice.seed,source:kind,section,budget,preserve,guides,valid:grade.score.valid,score:grade.score.score,qualityRms:grade.score.valid?Math.sqrt(result.trajectoryLoss!):null,usage:guideFootprint(result.track.lines),physicalFrames:result.stats.sim_frames,exhausted:result.searchBudgetExhausted};
   rows.push(row);console.log(JSON.stringify(row));
  }
 }
}
assert.deepEqual(galleryCompilerIdentity(process.cwd()),identity);
writeGalleryJson(resolve(out),'results.json',{plan,sources,rows});
