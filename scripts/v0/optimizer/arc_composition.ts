/** Small research entry point for a deliberate local construction change.
 * Musical targets are untouched. The earlier physical history is locked, while
 * the changed supports and complete continuation are independently searched. */
import {compileArcMotion, type ArcMotionOptions} from './arc_motion.ts';
import {captureArcFork} from './arc_guide_study.ts';
import {connectedArcOptions} from './connected_arcs.ts';
import {arcRailGroups} from './arc_guidance.ts';
import type {Spec} from '../types.ts';

export type ArcSectionStyles = NonNullable<ArcMotionOptions['sectionStyles']>;
export type CompositionSearch=Pick<ArcMotionOptions,'initialRecoverySamples'|'geometryAwareControls'|'referencePreview'|'previewMaxRmsError'>;
export type CompositionReference=Pick<ReturnType<typeof compileArcMotion>,'track'|'rows'|'report'>&{
  fragmentSections?:number[];railGuides?:Record<number,number[]>;
};

export function composeArcSections(spec:Spec, seed:number,
  reference:CompositionReference, styles:ArcSectionStyles, budget:number,search:CompositionSearch={}){
  const sections=Object.keys(styles).map(Number).sort((a,b)=>a-b);
  if(!sections.length||!sections.every(i=>Number.isSafeInteger(i)&&i>=0&&i<reference.rows.length))
    throw new Error('composition requires valid support sections');
  if(reference.report.terminus.reason!=='endOfSpec'||reference.report.off_beat_landings.length||
    !reference.report.contacts.every(c=>c.status==='hit'))throw new Error('composition requires a valid complete reference');
  // Capture costs at most two replays up to the boundary. Keep enough allowance
  // for the fork's mandatory full replays before performing any preparation.
  const section=sections[0], end=Math.round(spec.duration*40)+20;
  if(reference.fragmentSections?.some(i=>!Number.isSafeInteger(i)||i<0||i>=reference.rows.length||!Array.isArray(reference.railGuides?.[i])))throw new Error('invalid preserved fragment metadata');
  if(reference.fragmentSections?.some(i=>i>=section))throw new Error('connected edits must follow preserved fragment sections');
  if(!Number.isSafeInteger(budget)||budget<=2*(reference.rows[section].frame+1)+3*(end+1))
    throw new Error('composition allowance cannot cover preparation and replay');
  const captured=captureArcFork(reference,section), allowance=budget-captured.physicsFrames;
  const fork={...captured.fork,fragmentSections:reference.fragmentSections,guides:styles[section].guides??true,
    continuation:reference.rows.slice(section).map(r=>({control:r.control,incoming:r.incoming,span:r.span}))};
  const result=compileArcMotion(spec,seed,{...connectedArcOptions(spec,allowance),...search,
    collectTrajectoryLoss:true,sectionStyles:styles,fork});
  const physicalFrames=captured.physicsFrames+result.stats.sim_frames;
  if(physicalFrames>budget)throw new Error('composition exceeded its allowance');
  const fragmentSections=reference.fragmentSections??[];
  const railGuides=fragmentSections.length?Object.fromEntries([
    ...[...arcRailGroups(result.track.lines.filter(l=>!fragmentSections.includes(Math.floor((l.id-1000)/10000))))]
      .map(([i,chains])=>[i,(chains[1]??[]).map(l=>l.id)]),
    ...fragmentSections.map(i=>[i,reference.railGuides?.[i]??[]]),
  ]):undefined;
  return {result,physicalFrames,preparationFrames:captured.physicsFrames,fragmentSections,railGuides,
    changedSections:sections,boundaryFrame:captured.frame,prefixSha256:captured.prefixSha256,
    stateSha256:captured.fork.stateSha256};
}
