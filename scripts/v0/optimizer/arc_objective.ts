/** Shared whole-track objective. Search, refinement and final selection use
 * the same authored axes and physical-support motion preferences. */
import {detect, type Detection, type RawTrajectory} from '../../lib/detector.ts';
import type {AxisValues, DriftReport, Gap} from '../types.ts';
import {AXIS_MEASURE} from '../core/measure.ts';
import type {ImpactAssessment, ImpactObservation} from './impact_accounts.ts';
import {CONTACT_IMPACT_CONTRACT} from '../../lib/contact_impact.ts';
import {validRide} from './ride_validity.ts';
import {motionSamples, MOTION_BANDS} from './motion_quality.ts';
import {motionResiduals, intervalMotionSummary} from './motion_objective.ts';
import {engagementGains, engagementGainResidualsOver} from './impact_search.ts';
import type {ArcCompileContext} from './arc_compile_context.ts';

/** Compiler objective over the whole authored timeline. Span axes represent
 * time; impacts represent events. No benchmark IDs or benchmark code are used. */
export function arcWholeTrajectoryObjective(raw:any, report:DriftReport, gaps:Gap[], amplitudeWeight=1/3, impacts:ImpactAssessment) {
  const regrets=Array(gaps.length+1).fill(0);
  // The account's survival flag comes from the caller, so survival is checked here too.
  if(report.terminus.reason!=='endOfSpec'||!validRide({impactEvaluation:impacts}))return {loss:Infinity,regrets};
  return arcDetectedTrajectoryObjective(detect(raw),gaps,amplitudeWeight,impacts);
}

/** Whole authored-axis loss for an already detected physical trajectory. */
export function arcDetectedTrajectoryObjective(det:ReturnType<typeof detect>,gaps:Gap[],amplitudeWeight=1/3,impacts?:ImpactAssessment){
  return trajectoryObjective(det,gaps,amplitudeWeight,impacts);
}

function trajectoryObjective(det: Detection, gaps: Gap[], amplitudeWeight: number, impacts?: ImpactAssessment, prefix?: ObjectivePrefix) {
  const regrets=Array(gaps.length+1).fill(0);
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
      // Only measure axes used by the objective. Completed span reductions
      // are prefix-local; impact reads later events and is always measured.
      const cached = axis !== 'impact' && prefix && g.endFrame < prefix.raw.frames.length;
      const saved = cached ? (prefix.axes[g.index] ??= {}) : undefined;
      const value = saved?.[axis] ?? AXIS_MEASURE[axis]({det, gap: g, gapLines: [], rangeEndFrame: g.endFrame});
      if (saved) saved[axis] = value;
      if(value===undefined||!Number.isFinite(value))return {loss:Infinity,regrets};
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
  return selectionObjective(ctx, raw, physical, base);
}

type ObjectivePrefix = {
  raw: RawTrajectory;
  axes: AxisValues[];
  motionCosts: Array<number | undefined>;
  gains?: {boundary: ImpactObservation; from: number; completed: ReturnType<typeof engagementGains>};
};

/** One search's immutable prefix and scoring configuration. Only owned scalar
 * reductions survive a borrowed detection. Boundary impacts, open engagements
 * and unfinished supports are measured again; accumulation order is unchanged. */
export class ArcObjectiveContinuation {
  private readonly ctx: ArcCompileContext;
  private readonly amplitudeWeight: number;
  private readonly prefix: ObjectivePrefix;

  constructor(ctx: ArcCompileContext, raw: RawTrajectory, amplitudeWeight = 1 / 3) {
    this.ctx = ctx;
    this.amplitudeWeight = amplitudeWeight;
    this.prefix = {raw, axes: [], motionCosts: []};
  }

  score(raw: RawTrajectory, det: Detection, physical: readonly ImpactObservation[] | undefined, impacts?: ImpactAssessment) {
    const prefix = this.prefix, last = prefix.raw.frames.length - 1;
    // Like DetectionContinuation, the caller appends to an immutable prefix.
    // A replay invalidated before that boundary uses the complete observation.
    if (last < 0 || raw.frames[last] !== prefix.raw.frames[last])
      return arcSelectionObjective(this.ctx, raw, physical,
        arcDetectedTrajectoryObjective(det, this.ctx.gaps, this.amplitudeWeight, impacts));
    return selectionObjective(this.ctx, raw, physical,
      trajectoryObjective(det, this.ctx.gaps, this.amplitudeWeight, impacts, prefix), prefix);
  }
}

function selectionObjective(ctx: ArcCompileContext, raw: RawTrajectory,
  physical: readonly ImpactObservation[] | undefined, base: {loss: number; regrets: number[]}, prefix?: ObjectivePrefix) {
  const whole = {loss: base.loss, regrets: base.regrets.slice()};
  if (!Number.isFinite(whole.loss)) return whole;
  const {options, contacts, duration, gaps} = ctx;
  const reach = Math.max(...MOTION_BANDS.map(b => b.frames)) - 1;
  const firstMotion = prefix ? contacts.findIndex((_, i) => prefix.motionCosts[i] === undefined) : 0;
  // Completed supports need no samples. Restart at the first unfinished
  // support's burst history; speedBefore is identical at a restarted window.
  const from = firstMotion < 0 ? duration + 1 : Math.max(1, (contacts[firstMotion]?.frame ?? 1) - reach);
  const observed = options.motionQuality && from <= duration ? motionSamples(raw.frames, from, duration) : undefined;
  let gains: ReturnType<typeof engagementGains> | undefined;
  if (physical && options.impactSearch?.engagementGainWeight) {
    const last = prefix ? prefix.raw.frames.length - 1 : -1;
    if (prefix && !prefix.gains && physical[0]?.frame === 0 && physical[last]?.frame === last) {
      let from = last + 1;
      // A contact-free frame closes an engagement. Never split its sums or
      // strongest interval across the prefix boundary.
      while (from > 0 && physical[from - 1].contact) from--;
      prefix.gains = {boundary: physical[last], from, completed: engagementGains(physical.slice(0, from) as any, options.impactSearch)};
    }
    const saved = prefix?.gains;
    gains = saved && physical[last] === saved.boundary
      ? saved.completed.concat(engagementGains(physical.slice(saved.from) as any, options.impactSearch))
      : engagementGains(physical as any, options.impactSearch);
  }
  for (const [i, contact] of contacts.entries()) {
    const next = contacts[i + 1]?.frame ?? duration + 1;
    let extra = gains ? engagementGainResidualsOver(gains, contact.frame, next - 1, options.impactSearch)
      .reduce((sum, value) => sum + value * value, 0) / contacts.length : 0;
    let motionCost = prefix?.motionCosts[i];
    if (motionCost === undefined) {
      const local = observed?.slice(Math.max(0, contact.frame - reach - from), Math.max(0, next - from));
      if (local?.some(s => s.frame >= contact.frame && s.frame < next)) {
        const request = options.constructionRequests?.[i];
        const impact = contact.gap >= 0 ? gaps[contact.gap].targets.impact : request?.context?.nextImpact ?? undefined;
        motionCost = motionResiduals(intervalMotionSummary(local, contact.frame, next - 1), impact, options.motionQuality!)
          .reduce((sum, value) => sum + value * value, 0) / contacts.length;
        // The final sample needs the next frame's velocity in the prefix too.
        if (prefix && next < prefix.raw.frames.length) prefix.motionCosts[i] = motionCost;
      }
    }
    if (motionCost !== undefined) extra += motionCost;
    whole.loss += extra;
    whole.regrets[i] += extra;
  }
  return whole;
}
