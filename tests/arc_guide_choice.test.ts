import {it,expect} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {captureArcFork,studyGuideChoices} from '../scripts/v0/optimizer/arc_guide_study.ts';
import {guideFootprint,selectGuideAlternative} from '../scripts/v0/optimizer/arc_guide_choice.ts';
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
