import {it,expect} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {composeArcSections} from '../scripts/v0/optimizer/arc_composition.ts';
import {captureArcFork} from '../scripts/v0/optimizer/arc_guide_study.ts';
import {arcRailGroups} from '../scripts/v0/optimizer/arc_guidance.ts';
import {stylesForPhrases} from '../scripts/produce/musical_repertoire.ts';
import type {Spec} from '../scripts/v0/types.ts';

const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={budget:220000,samples:64,channel:12,radius:24,bidirectional:true,
  impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,
  guidance:'clearance' as const,guidanceSamples:24,pruneGuidance:true,collectTrajectoryLoss:true};

it('composes distinct strengths on separated phrases and verifies the intervening and returning arcs',async()=>{
  const reference=compileArcMotion(spec,17,options);
  const styles=stylesForPhrases(reference.rows,[
    {title:'First',window:[1,1.4],style:{profile:'terraces',profileStrength:1.5}},
    {title:'Second',window:[2.8,3.2],style:{profile:'scallops',profileStrength:.75,profileStart:.25,rippleCycles:1}},
  ]);
  expect(Object.keys(styles)).toEqual(['2','5']);
  expect(()=>stylesForPhrases(reference.rows,[{title:'Empty',window:[.01,.02],style:{}}])).toThrow('empty');
  expect(()=>stylesForPhrases(reference.rows,[{title:'A',window:[1,2],style:{}},{title:'B',window:[1.1,1.4],style:{}}])).toThrow('overlapping');
  const composed=composeArcSections(spec,17,reference,styles,250000);
  expect(composed.result.report.terminus.reason).toBe('endOfSpec');
  expect(composed.result.report.off_beat_landings).toHaveLength(0);
  expect(composed.result.report.contacts.every(c=>c.status==='hit')).toBe(true);
  const {verifyMainConstruction}=await import('../scripts/gallery/verify_construction.ts');
  expect(verifyMainConstruction(composed.result.track,composed.result.rows,{radius:24,channel:12,sectionStyles:styles},2).exactGeometry).toBe(true);
  expect(()=>verifyMainConstruction(composed.result.track,composed.result.rows,{radius:24,channel:12,sectionStyles:{2:{profile:'terraces'},5:{profile:'scallops'}}},2)).toThrow('main construction differs');
  for(const style of [{profileStrength:1},{profile:'scallops',profileStrength:-1},{profile:'scallops',profileStrength:NaN},
    {profileStart:.2},{profile:'scallops',rippleCycles:4},{profile:'scallops',profileStart:NaN}])
    expect(()=>compileArcMotion(spec,17,{...options,sectionStyles:{2:style} as any})).toThrow('section style');
});

it('searches a faceted unguided section and returns to smooth arcs without changing the incoming track',()=>{
  const reference=compileArcMotion(spec,17,options),saved=JSON.stringify(reference);
  const styles={2:{subdivisions:.5,guides:false}},composed=composeArcSections(spec,17,reference,styles,250000);
  const result=composed.result,groups=arcRailGroups(result.track.lines);
  expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
  expect(result.report.off_beat_landings).toHaveLength(0);
  expect(result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<2)).toEqual(reference.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<2));
  expect(groups.get(2)).toHaveLength(1);
  for(const i of [2,3])expect(groups.get(i)![0]).toHaveLength(1+Math.max(4,Math.ceil(result.rows[i].control.support*(i===2?.5:4))));
  expect(result.forkEvidence?.stateSha256).toBe(composed.stateSha256);
  expect(composed.physicalFrames).toBe(composed.preparationFrames+result.stats.sim_frames);
  expect(composed.physicalFrames).toBeLessThanOrEqual(250000);
  expect(result.track.lines.every(l=>l.type===0)).toBe(true);
  expect(JSON.stringify(reference)).toBe(saved);expect(styles).toEqual({2:{subdivisions:.5,guides:false}});
});

it('rejects unsupported styles and refuses to edit locked prefixes',()=>{
  for(const sectionStyles of [{99:{guides:false}},{1:{subdivisions:0}},{1:{guides:'false'}},{1:42},[],{1:[]}])
    expect(()=>compileArcMotion(spec,17,{...options,sectionStyles:sectionStyles as any})).toThrow('section style');
  expect(()=>compileArcMotion(spec,17,{...options,sectionStyles:{1:{guides:false}},wholeTrackRefinement:true})).toThrow('ordinary connected');
  const reference=compileArcMotion(spec,17,options),composed=composeArcSections(spec,17,reference,{2:{guides:false}},250000);
  expect(composed.result.forkEvidence?.section).toBe(2);
  const {fork}=captureArcFork(reference,2);
  expect(()=>compileArcMotion(spec,17,{...options,fork,sectionStyles:{1:{guides:false}}})).toThrow('section style');
  expect(()=>composeArcSections(spec,17,reference,{},250000)).toThrow('valid support');
});

it.each(['serpentine','terraces','scallops'] as const)('composes actual %s geometry and returns to ordinary arcs',async profile=>{
  const {verifyMainConstruction}=await import('../scripts/gallery/verify_construction.ts');
  const reference=compileArcMotion(spec,17,options),styles={2:{profile}};
  const {result}=composeArcSections(spec,17,reference,styles,250000);
  expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
  expect(result.report.off_beat_landings).toHaveLength(0);
  expect(verifyMainConstruction(result.track,result.rows,{radius:24,channel:12,sectionStyles:styles},2).mainSupportsVerified).toBe(result.rows.length-2);
  expect(()=>verifyMainConstruction(result.track,result.rows,{radius:24,channel:12},2)).toThrow('main construction differs');
  const {fork}=captureArcFork(reference,2);
  expect(()=>compileArcMotion(spec,17,{...options,fork,sectionStyles:{2:{guides:false}}})).toThrow('conflicting');
  expect(()=>compileArcMotion(spec,17,{...options,sectionStyles:{2:{profile:'unknown' as any}}})).toThrow('section style');
});
