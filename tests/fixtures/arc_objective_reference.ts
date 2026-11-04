/** Frozen full-rescore oracle from 4edec76a. Keep its traversal independent
 * of the prefix optimization; public physical measurement definitions stay shared. */
import {detect} from '../../scripts/lib/detector.ts';
import type {Gap} from '../../scripts/v0/types.ts';
import {measureGapAxes} from '../../scripts/v0/core/measure.ts';
import type {ImpactAssessment as MusicalImpactEvaluation, ImpactObservation} from '../../scripts/v0/optimizer/impact_accounts.ts';
import {CONTACT_IMPACT_CONTRACT} from '../../scripts/lib/contact_impact.ts';
import {motionSamples, MOTION_BANDS} from '../../scripts/v0/optimizer/motion_quality.ts';
import {motionResiduals, intervalMotionSummary} from '../../scripts/v0/optimizer/motion_objective.ts';
import {engagementGains, engagementGainResidualsOver} from '../../scripts/v0/optimizer/impact_search.ts';
import type {ArcCompileContext} from '../../scripts/v0/optimizer/arc_compile_context.ts';

/** Whole authored-axis loss for an already detected physical trajectory. */
export function arcDetectedTrajectoryObjective(det:ReturnType<typeof detect>,gaps:Gap[],amplitudeWeight=1/3,impacts?:MusicalImpactEvaluation){
  const regrets=Array(gaps.length+1).fill(0),measured=gaps.map(g=>measureGapAxes(det,g,[],g.endFrame));
  let loss=0,normalizer=0;
  for(const axis of ['air','speed','amplitude','impact'] as const){
    if(axis==='impact'&&impacts){
      const {account,events,targets}=impacts,mass=Math.max(1,targets.length);
      if(!impacts.valid)return {loss:Infinity,regrets};
      normalizer+=1;loss+=account.loss;
      for(const match of account.matches)regrets[match.target+1]+=match.loss/mass;
      for(const i of account.unmatchedEvents){
        const event=events[i],gap=gaps.find(g=>event.onset>=g.startFrame&&event.onset<g.endFrame)??gaps.at(-1);
        if(gap)regrets[gap.index]+=(event.raw/CONTACT_IMPACT_CONTRACT.veryStrong)**2/mass;
      }
      continue;
    }
    const targeted=gaps.filter(g=>g.targets[axis]!==undefined);
    if(!targeted.length)continue;
    const importance=axis==='amplitude'?amplitudeWeight:1;
    const mass=targeted.reduce((s,g)=>s+(axis==='impact'?1:g.endFrame-g.startFrame),0);
    normalizer+=importance;
    for(const g of targeted){
      const value=measured[g.index][axis];if(value===undefined||!Number.isFinite(value))return {loss:Infinity,regrets};
      const contribution=importance*(axis==='impact'?1:g.endFrame-g.startFrame)*(value-g.targets[axis]!)**2/mass;
      loss+=contribution;regrets[axis==='impact'?g.index+1:g.index]+=contribution;
    }
  }
  return {loss:normalizer?loss/normalizer:0,regrets:regrets.map(v=>normalizer?v/normalizer:0)};
}

/** Adds the existing engagement and motion preferences once per physical
 * support, including startup. Authored beat windows remain the domain of
 * the musical objective above. Regrets partition exactly the same loss. */
export function arcSelectionObjective(ctx: ArcCompileContext, raw: any,
  physical: readonly ImpactObservation[] | undefined, base: {loss: number; regrets: number[]}) {
  const whole = {loss: base.loss, regrets: base.regrets.slice()};
  if (!Number.isFinite(whole.loss)) return whole;
  const {options, contacts, duration, gaps} = ctx;
  const observed = options.motionQuality ? motionSamples(raw.frames, 1, duration) : undefined;
  const gains = physical ? engagementGains(physical as any, options.impactSearch) : undefined;
  // Samples are contiguous from frame 1. Each support reads only its own
  // frames and the longest burst band before them.
  const reach = Math.max(...MOTION_BANDS.map(b => b.frames)) - 1;
  for (const [i, contact] of contacts.entries()) {
    const next = contacts[i + 1]?.frame ?? duration + 1;
    let extra = gains ? engagementGainResidualsOver(gains, contact.frame, next - 1, options.impactSearch)
      .reduce((sum, value) => sum + value * value, 0) / contacts.length : 0;
    const local = observed?.slice(Math.max(0, contact.frame - reach - 1), Math.max(0, next - 1));
    if (local?.some(s => s.frame >= contact.frame && s.frame < next)) {
      const request = options.constructionRequests?.[i];
      const impact = contact.gap >= 0 ? gaps[contact.gap].targets.impact : request?.context?.nextImpact ?? undefined;
      extra += motionResiduals(intervalMotionSummary(local, contact.frame, next - 1), impact, options.motionQuality!)
        .reduce((sum, value) => sum + value * value, 0) / contacts.length;
    }
    whole.loss += extra;
    whole.regrets[i] += extra;
  }
  return whole;
}
