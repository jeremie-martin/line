/** Realize selected supports as measured disconnected contacts. The rest of the
 * complete source track is retained, and every candidate continuation is replayed.
 * Source planning is charged separately by the caller; this meter covers observation
 * and all reconstruction attempts. Failed candidates never become an arc fallback. */
import assert from 'node:assert/strict';
import {contactFragments,observeContactReference,trajectoryDifference} from './normal_contacts.ts';
import {arcRailGroups} from './arc_guidance.ts';
import {arcWholeTrajectoryObjective} from './arc_refinement.ts';
import {normalizeCompilerTimeline} from './compiler_input.ts';
import {sliceTimeline,effectiveAxes,buildDriftReport,validateSpec} from '../core/substrate.ts';
import {detect,extractRawTrajectory,resetFrameCount,getPhysicsFrameCount,setPhysicsFrameLimit} from '../../lib/detector.ts';
import {compileArcMotion} from './arc_motion.ts';
import type {ArcSectionStyles,CompositionSearch} from './arc_composition.ts';
import {captureArcFork} from './arc_guide_study.ts';
import {connectedArcOptions} from './connected_arcs.ts';
import type {Spec,TrackLine} from '../types.ts';
const {LineRiderEngine:Judge,disposeAllWasmEnginesForStudy:dispose}=
  await import(new URL('../../lib/_lr_engine_wasm.ts?contact-composition',import.meta.url).href);
type Source=Pick<ReturnType<typeof compileArcMotion>,'track'|'rows'>&{fragmentSections?:number[];railGuides?:Record<number,number[]>};
export function composeContactSections(input:Spec,source:Source,options:{sections:number[];widths:number[];budget:number;selectionEndFrame?:number}){
  const spec=normalizeCompilerTimeline(input);validateSpec(spec);
  const existing=new Set(source.fragmentSections??[]);
  if(existing.size!==(source.fragmentSections??[]).length||[...existing].some(i=>!Number.isSafeInteger(i)||i<0||i>=source.rows.length||!Array.isArray(source.railGuides?.[i])))throw new Error('invalid preserved fragment metadata');
  const {sections,widths,budget}=options,groups=arcRailGroups(source.track.lines.filter(l=>!existing.has(Math.floor((l.id-1000)/10000))));
  if(!sections.length||new Set(sections).size!==sections.length||!sections.every(i=>Number.isSafeInteger(i)&&i>=0&&i<source.rows.length&&groups.has(i)))throw new Error('invalid fragment sections');
  if(!widths.length||new Set(widths).size!==widths.length||!widths.every(w=>Number.isFinite(w)&&w>0))throw new Error('invalid fragment widths');
  const duration=Math.round(spec.duration*40),end=duration+20,replayFrames=end+1;
  if(!Number.isSafeInteger(budget)||budget<(widths.length+3)*replayFrames)throw new Error('fragment budget cannot cover observation and replay');
  if(Object.keys(spec.axes).some(axis=>!['air','speed','amplitude'].includes(axis)))throw new Error('unsupported fragment axes');
  const changed=new Set(sections),first=Math.min(...sections),boundary=source.rows[first].frame-1;
  if([...existing].some(i=>i>=first))throw new Error('fragment edits must follow preserved fragment sections');
  const selectionEnd=options.selectionEndFrame??end;
  if(!Number.isSafeInteger(selectionEnd)||selectionEnd<boundary||selectionEnd>end)throw new Error('invalid fragment selection boundary');
  const contacts=spec.contacts.map(c=>Math.round(c.t*40)),gaps=sliceTimeline(contacts,duration);
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact&&spec.contacts[g.index].impact!==undefined)g.targets.impact=spec.contacts[g.index].impact;}
  const reportFor=(raw:ReturnType<typeof extractRawTrajectory>)=>buildDriftReport(detect(raw),spec,gaps,contacts,duration,[],gaps.map(()=>({lines:[]})) as any,gaps.map(g=>g.targets));
  resetFrameCount();setPhysicsFrameLimit(budget);
  const replay=(lines:TrackLine[])=>{try{
    const base=new Judge().setStart(source.track.startPosition,source.track.riders[0].startVelocity);
    return extractRawTrajectory(lines.length?base.addLine(lines):base,end);
  }finally{dispose();}};
  try{
    const {raw:reference,footprints}=observeContactReference(source.track,end);
    assert.deepEqual(reference,replay(source.track.lines),'contact observer disagrees with fixed judge');
    const referenceReport=reportFor(reference),referenceLoss=arcWholeTrajectoryObjective(reference,referenceReport,gaps).loss;
    if(!Number.isFinite(referenceLoss))throw new Error('fragment composition requires a valid complete source');
    const observationFrames=getPhysicsFrameCount(),probes:any[]=[];let chosen:any;
    for(const width of widths){
      const lines:TrackLine[]=[],railGuides:Record<number,number[]>={},provenance:Record<number,number>={};
      for(const section of new Set(source.track.lines.map(l=>Math.floor((l.id-1000)/10000)))){
        if(existing.has(section)){
          lines.push(...source.track.lines.filter(l=>Math.floor((l.id-1000)/10000)===section));
          railGuides[section]=[...source.railGuides![section]];continue;
        }
        const chains=groups.get(section)!;
        const originalGuide=new Set((chains[1]??[]).map(l=>l.id));railGuides[section]=[];
        if(!changed.has(section)){
          lines.push(...chains.flat());railGuides[section]=[...originalGuide];continue;
        }
        // Retain each support's ID namespace and source orientation; record the
        // exact parent of every fragment for faithful guide/contact inspection.
        let id=1000+section*10000;
        for(const line of chains.flat())for(const f of contactFragments([line],new Map(footprints.has(line.id)?[[line.id,footprints.get(line.id)!]]:[]),width)){
          if(id>=1000+(section+1)*10000)throw new Error('fragment support exceeds ID namespace');
          lines.push({...f,id});provenance[id]=line.id;if(originalGuide.has(line.id))railGuides[section].push(id);id++;
        }
      }
      const raw=replay(lines),report=reportFor(raw),loss=arcWholeTrajectoryObjective(raw,report,gaps).loss;
      const prefixMatches=JSON.stringify(raw.frames.slice(0,boundary+1))===JSON.stringify(reference.frames.slice(0,boundary+1));
      const difference=trajectoryDifference(reference,raw);
      const localDifference=trajectoryDifference({...reference,duration:selectionEnd,frames:reference.frames.slice(0,selectionEnd+1)},
        {...raw,duration:selectionEnd,frames:raw.frames.slice(0,selectionEnd+1)});
      const selectionCost=options.selectionEndFrame===undefined?loss:localDifference;
      probes.push({width,lines:lines.length,valid:Number.isFinite(loss)&&prefixMatches,loss:Number.isFinite(loss)?loss:null,prefixMatches,
        maximumMotionDifference:Number.isFinite(difference)?difference:null,localMotionDifference:Number.isFinite(localDifference)?localDifference:null});
      if(!chosen||(prefixMatches&&(!chosen.prefixMatches||selectionCost<chosen.selectionCost)))chosen={lines,railGuides,provenance,raw,report,loss,width,prefixMatches,difference,localDifference,selectionCost};
    }
    assert.ok(chosen);assert.deepEqual(replay(chosen.lines),chosen.raw,'fragment composition is not deterministic');
    const valid=Number.isFinite(chosen.loss)&&chosen.prefixMatches;
    return {track:{...source.track,lines:chosen.lines},report:chosen.report,trajectoryLoss:chosen.loss,valid,
      physicalFrames:getPhysicsFrameCount(),boundaryFrame:boundary,railGuides:chosen.railGuides,
      construction:{method:'partial-contact-fragments',sections:[...sections].sort((a,b)=>a-b),width:chosen.width,
        referenceLoss,probes,observationFrames,reconstructionFrames:getPhysicsFrameCount()-observationFrames,
        selectionEndFrame:selectionEnd,selection:options.selectionEndFrame===undefined?'whole-ride-target-loss':'source-motion-through-return',
        localMotionDifference:Number.isFinite(chosen.localDifference)?chosen.localDifference:null,
        maximumMotionDifference:Number.isFinite(chosen.difference)?chosen.difference:null,prefixMatches:chosen.prefixMatches,
        provenance:chosen.provenance},failure:valid?null:{reason:'contact_reconstruction',probes}};
  }finally{dispose();setPhysicsFrameLimit(null);}
}

/** Replan the return from the realized fragments' actual state. Tiny reconstruction
 * differences can grow over a long fixed suffix; the source suffix is a proposal,
 * not a requirement to reproduce its floating-point trajectory indefinitely. */
export function composeScatteredPhrase(spec:Spec,seed:number,source:Source,sections:number[],widths:number[],budget:number,
  sectionStyles:ArcSectionStyles={},search:CompositionSearch={}){
  const end=Math.round(spec.duration*40)+20,resumeAt=Math.max(...sections)+1;
  if(!source.rows[resumeAt]||Object.keys(sectionStyles).some(i=>Number(i)<resumeAt))throw new Error('scattered phrase requires a later continuation');
  const reconstructionCeiling=(widths.length+3)*(end+1);
  if(budget<=reconstructionCeiling+2*(source.rows[resumeAt].frame+1)+3*(end+1))throw new Error('scattered allowance cannot cover reconstruction and continuation');
  const fragments=composeContactSections(spec,source,{sections,widths,budget:reconstructionCeiling,selectionEndFrame:source.rows[resumeAt].frame-1});
  const captured=captureArcFork({...source,track:fragments.track} as any,resumeAt);
  const preparationFrames=fragments.physicalFrames+captured.physicsFrames;
  const fragmentSections=[...source.fragmentSections??[],...sections].sort((a,b)=>a-b);
  const fork={...captured.fork,fragmentSections,guides:sectionStyles[resumeAt]?.guides??true,
    continuation:source.rows.slice(resumeAt).map(r=>({control:r.control,incoming:r.incoming,span:r.span}))};
  const result=compileArcMotion(spec,seed,{...connectedArcOptions(spec,budget-preparationFrames),...search,collectTrajectoryLoss:true,sectionStyles,fork});
  const connected=arcRailGroups(result.track.lines.filter(l=>!fragmentSections.includes(Math.floor((l.id-1000)/10000))));
  const railGuides:Record<number,number[]>={};
  for(const [section,chains]of connected)railGuides[section]=(chains[1]??[]).map(l=>l.id);
  for(const section of fragmentSections)railGuides[section]=fragments.railGuides[section];
  return {result,physicalFrames:preparationFrames+result.stats.sim_frames,preparationFrames,
    changedSections:[...new Set([...sections,...Object.keys(sectionStyles).map(Number)])].sort((a,b)=>a-b),
    boundaryFrame:fragments.boundaryFrame,railGuides,fragmentSections,
    fragmentConstruction:{...fragments.construction,fixedSuffixValid:fragments.valid,continuationBoundary:captured.frame,
      realizationFrames:fragments.physicalFrames,continuationPreparationFrames:captured.physicsFrames}};
}
