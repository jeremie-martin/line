import {it,expect} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {captureArcFork,studyGuideChoices} from '../scripts/v0/optimizer/arc_guide_study.ts';
import {guideFootprint,selectGuideAlternative,guideCoverageFrontier} from '../scripts/v0/optimizer/arc_guide_choice.ts';
import type {Spec} from '../scripts/v0/types.ts';
const spec:Spec={duration:3,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={budget:100000,samples:64,channel:12,radius:24,bidirectional:true,impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,guidance:'clearance' as const,guidanceSamples:24,pruneGuidance:true,collectTrajectoryLoss:true};
const alternative=(id:string,qualityRms:number|null,guideSections:number,guideLength:number,valid=true)=>({id,qualityRms,valid,usage:{supportSections:4,guideSections,guideLength}});
it('chooses visible simplicity only inside the explicit full-ride error ceiling',()=>{
 const pool=[alternative('accurate',.03,4,400),alternative('shorter',.034,4,150),alternative('sparse',.04,1,180),alternative('invalid',0,0,0,false)];
 expect(selectGuideAlternative(pool,0)?.selected.id).toBe('accurate');
 expect(selectGuideAlternative(pool,.005)?.selected.id).toBe('shorter');
 expect(selectGuideAlternative(pool,.011)?.selected.id).toBe('sparse');
 let count=Infinity,length=Infinity;
 for(let step=0;step<=40;step++){
  const choice=selectGuideAlternative(pool,step/1000)!;
  expect(choice.selected.qualityRms!).toBeLessThanOrEqual(choice.ceiling);
  const usage=choice.selected.usage;expect(usage.guideSections<count||usage.guideSections===count&&usage.guideLength<=length).toBe(true);
  count=usage.guideSections;length=usage.guideLength;
 }
 expect(selectGuideAlternative([alternative('missing',null,0,0)],.01)).toBeNull();
 expect(()=>selectGuideAlternative(pool,Infinity)).toThrow('finite');
});
it('forks both guide permissions from the exact same full rider state and preserves earlier geometry',()=>{
 const reference=compileArcMotion(spec,17,options),saved=JSON.stringify(reference);
 const captured=captureArcFork(reference,2);
 const results=[false,true].map(guides=>compileArcMotion(spec,17,{...options,fork:{...captured.fork,guides}}));
 expect(results[0].forkEvidence).toEqual(results[1].forkEvidence);
 expect(results[0].forkEvidence?.stateSha256).toBe(captured.fork.stateSha256);
 for(const result of results){
  expect(result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<2)).toEqual(captured.fork.lines);
  expect(result.rows.slice(0,2).map(r=>r.control)).toEqual(reference.rows.slice(0,2).map(r=>r.control));
  expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
 }
 expect(guideFootprint(results[0].track.lines.filter(l=>Math.floor((l.id-1000)/10000)===2)).guideSections).toBe(0);
 expect(JSON.stringify(reference)).toBe(saved);
 expect(()=>compileArcMotion(spec,17,{...options,fork:{...captured.fork,stateSha256:'wrong'}})).toThrow('incoming state mismatch');
 expect(()=>compileArcMotion(spec,17,{...options,refineAttempts:1,fork:captured.fork})).toThrow('ordinary connected continuation');
});
it('charges reference construction, both branches, verification and cold replays to one study allowance',()=>{
 const r=studyGuideChoices(spec,17,180000);
 expect(r.decisions.length).toBeGreaterThan(0);
 expect(r.physicalFrames).toBe(r.preparationFrames+r.candidates.reduce((sum,c)=>sum+c.result.stats.sim_frames,0));
 expect(r.physicalFrames).toBeLessThanOrEqual(180000);
 expect(r.preparationFrames).toBeGreaterThan(0);
 expect(r.candidates.every(c=>c.result.track.lines.every(l=>l.type===0))).toBe(true);
 for(const d of r.decisions){
  const a=r.candidates.find(c=>c.id===d.single)!,b=r.candidates.find(c=>c.id===d.guided)!;
  expect(a.result.forkEvidence).toEqual(b.result.forkEvidence);
  expect(a.result.stats.sim_frames).toBeLessThanOrEqual(d.allowancePerBranch);
  expect(b.result.stats.sim_frames).toBeLessThanOrEqual(d.allowancePerBranch);
 }
 expect(selectGuideAlternative(r.candidates,.01)?.selected.valid).toBe(true);
});
it('keeps both exploration paths inside one allowance and preserves each paired physical fork',()=>{
 const r=studyGuideChoices(spec,17,300000,{exploration:'accuracy-and-guidance',sourceContinuation:true});
 expect(new Set(r.candidates.map(c=>c.id)).size).toBe(r.candidates.length);
 expect(r.physicalFrames).toBeLessThanOrEqual(300000);
 expect(r.physicalFrames).toBe(r.preparationFrames+r.candidates.reduce((n,c)=>n+c.result.stats.sim_frames,0));
 expect(r.decisions.length).toBeGreaterThan(spec.contacts.length+1);
 for(const d of r.decisions){
  const source=r.candidates.find(c=>c.id===d.source)!;
  for(const id of [d.single,d.guided]){
   const c=r.candidates.find(c=>c.id===id)!;
   const prefix=(lines:any[])=>lines.filter(l=>Math.floor((l.id-1000)/10000)<d.section);
   expect(prefix(c.result.track.lines)).toEqual(prefix(source.result.track.lines));
   expect(c.result.forkEvidence?.stateSha256).toBe(d.stateSha256);
   expect(c.result.stats.sim_frames).toBeLessThanOrEqual(d.allowancePerBranch);
   expect(c.result.track.lines.every(l=>l.type===0)).toBe(true);
  }
 }
});
it('treats source continuation controls as proposals and rejects incomplete references',()=>{
 const reference=compileArcMotion(spec,17,options),captured=captureArcFork(reference,2);
 const continuation=reference.rows.slice(2).map(r=>({control:r.control,incoming:r.incoming,span:r.span}));
 const saved=JSON.stringify(continuation);
 const fork={...captured.fork,guides:false,continuation};
 const result=compileArcMotion(spec,17,{...options,fork});
 expect(JSON.stringify(continuation)).toBe(saved);
 expect(result.forkEvidence?.stateSha256).toBe(captured.fork.stateSha256);
 expect(guideFootprint(result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)===2)).guideSections).toBe(0);
 expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
 expect(result.stats.sim_frames).toBeGreaterThan(2*(spec.duration*40+21));
 expect(()=>compileArcMotion(spec,17,{...options,fork:{...fork,continuation:[]}})).toThrow('cover the continuation');
});
it('pays for both starting tracks and keeps an independently compiled zero-guide alternative',()=>{
 const r=studyGuideChoices(spec,17,300000,{exploration:'balanced',unguidedReference:true,sourceMemory:true});
 expect(r.references).toEqual(['reference','reference-single']);
 const single=r.candidates.find(c=>c.id==='reference-single')!;
 expect(single.valid).toBe(true);expect(single.usage.guideSections).toBe(0);
 const referenceWork=r.candidates.filter(c=>r.references.includes(c.id)).reduce((n,c)=>n+c.result.stats.sim_frames,0);
 expect(r.physicalFrames).toBe(referenceWork+r.decisions.reduce((n,d)=>n+d.physicalFrames,0));
 expect(r.physicalFrames).toBeLessThanOrEqual(300000);
 for(const round of r.rounds){
  expect(round.after.length).toBeGreaterThan(0);expect(round.after.length).toBeLessThanOrEqual(2);
  for(const id of [...round.before,...round.after])expect(r.candidates.find(c=>c.id===id)?.valid).toBe(true);
 }
 expect(()=>studyGuideChoices(spec,17,300000,{unguidedReference:true})).toThrow('two-path');
});
it('retains a useful middle continuation without assigning a preferred guide count',()=>{
 const pool=[alternative('accurate',.02,4,300),alternative('sparse',.12,0,0),alternative('middle',.03,2,200),alternative('dominated',.08,3,180),alternative('invalid',0,1,1,false)];
 expect(guideCoverageFrontier(pool).map(c=>c.id)).toEqual(['accurate','sparse','middle']);
 expect(guideCoverageFrontier(pool,8).map(c=>c.id)).toEqual(['accurate','sparse','middle']);
 expect(guideCoverageFrontier([])).toEqual([]);
 expect(()=>guideCoverageFrontier(pool,1)).toThrow('at least two');
});
it('preserves later guide prohibitions while independently rebuilding faceted continuations',()=>{
 const r=studyGuideChoices(spec,17,260000,{exploration:'coverage',unguidedReference:true,preserveGuidePattern:true,geometry:{subdivisions:.5}});
 expect(r.physicalFrames).toBe(r.preparationFrames+r.candidates.reduce((n,c)=>n+c.result.stats.sim_frames,0));
 expect(r.physicalFrames).toBeLessThanOrEqual(260000);
 expect(r.decisions.length).toBeGreaterThan(0);
 for(const d of r.decisions){
  const source=r.candidates.find(c=>c.id===d.source)!;
  for(const id of [d.single,d.guided]){
   const c=r.candidates.find(c=>c.id===id)!;
   expect(c.result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<d.section)).toEqual(source.result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<d.section));
   for(let i=1;i<d.continuationGuides.length;i++)if(!d.continuationGuides[i])expect(guideFootprint(c.result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)===d.section+i)).guideSections).toBe(0);
   expect(c.result.track.lines.every(l=>l.type===0)).toBe(true);
  }
 }
 const reference=r.candidates.find(c=>c.valid)!;expect(reference).toBeDefined();
 const {fork}=captureArcFork(reference.result,2);
 expect(()=>compileArcMotion(spec,17,{...options,fork:{...fork,continuationGuides:[false]}})).toThrow('guide permissions');
});
