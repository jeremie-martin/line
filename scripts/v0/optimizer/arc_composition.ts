/** Small research entry point for a deliberate local construction change.
 * Musical targets are untouched. The earlier physical history is locked, while
 * the changed supports and complete continuation are independently searched. */
import {compileArcMotion, type ArcMotionOptions} from './arc_motion.ts';
import {captureArcFork} from './arc_guide_study.ts';
import {connectedArcOptions} from './connected_arcs.ts';
import type {Spec} from '../types.ts';

export type ArcSectionStyles = NonNullable<ArcMotionOptions['sectionStyles']>;

export function composeArcSections(spec:Spec, seed:number,
  reference:ReturnType<typeof compileArcMotion>, styles:ArcSectionStyles, budget:number){
  const sections=Object.keys(styles).map(Number).sort((a,b)=>a-b);
  if(!sections.length||!sections.every(i=>Number.isSafeInteger(i)&&i>=0&&i<reference.rows.length))
    throw new Error('composition requires valid support sections');
  if(reference.report.terminus.reason!=='endOfSpec'||reference.report.off_beat_landings.length||
    !reference.report.contacts.every(c=>c.status==='hit'))throw new Error('composition requires a valid complete reference');
  // Capture costs at most two replays up to the boundary. Keep enough allowance
  // for the fork's mandatory full replays before performing any preparation.
  const section=sections[0], end=Math.round(spec.duration*40)+20;
  if(!Number.isSafeInteger(budget)||budget<=2*(reference.rows[section].frame+1)+3*(end+1))
    throw new Error('composition allowance cannot cover preparation and replay');
  const captured=captureArcFork(reference,section), allowance=budget-captured.physicsFrames;
  const fork={...captured.fork,guides:styles[section].guides??true,
    continuation:reference.rows.slice(section).map(r=>({control:r.control,incoming:r.incoming,span:r.span}))};
  const result=compileArcMotion(spec,seed,{...connectedArcOptions(spec,allowance),
    collectTrajectoryLoss:true,sectionStyles:styles,fork});
  const physicalFrames=captured.physicsFrames+result.stats.sim_frames;
  if(physicalFrames>budget)throw new Error('composition exceeded its allowance');
  return {result,physicalFrames,preparationFrames:captured.physicsFrames,
    changedSections:sections,boundaryFrame:captured.frame,prefixSha256:captured.prefixSha256,
    stateSha256:captured.fork.stateSha256};
}
