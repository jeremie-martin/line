/** Refinement of a complete committed track: supplies the whole-track
 * objective, construction validation and engine lineage to refineArcTrack,
 * and adopts its result. */
import type { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { setPhysicsFrameLimit } from '../../lib/detector.ts';
import type { TrackLine } from '../types.ts';
import { refineArcTrack, arcWholeTrajectoryObjective } from './arc_refinement.ts';
import { arcRailGroups } from './arc_guidance.ts';
import { inspectConstructionWindow } from './repertoire_candidate.ts';
import { motionSamples } from './motion_quality.ts';
import { motionResiduals, intervalMotionSummary } from './motion_objective.ts';
import { engagementGainResiduals } from './impact_search.ts';
import { impactAccount } from './impact_accounts.ts';
import { searchInterval } from './arc_interval.ts';
import type { ConstructionRequest } from './repertoire_policy.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';
import type { ArcSequence } from './arc_sequence.ts';

/** Refines the complete track in `seq` within the remaining allowance and
 * replaces its lines, rows and engine with the result. */
export function refineCommittedTrack(ctx: ArcCompileContext, seq: ArcSequence) {
  const {options, contacts, end, start, budget, lineage} = ctx;
  setPhysicsFrameLimit(budget - 2 * (end + 1));
  const requests = Object.values(options.constructionRequests ?? {});
  const refined = refineArcTrack({engine: seq.engine, lines: seq.lines, rows: seq.rows, alternatives: seq.steps.map(s => s.choices),
    contacts, end, start, budget, options,
    search: (engine, i, overrides, protectedEngines) => searchInterval(ctx, engine, i, overrides, protectedEngines),
    report: ctx.reportFor,
    objective: options.wholeTrackRefinement ? wholeTrackObjective(ctx, requests) : undefined,
    validate: requests.length ? constructionValidator(requests) : undefined,
    engines: requests.length ? {create: lineage.rebuild, add: lineage.add, detach: lineage.detach} : undefined});
  seq.lines.splice(0, seq.lines.length, ...refined.lines);
  seq.rows.splice(0, seq.rows.length, ...refined.rows);
  seq.engine = refined.engine;
  ctx.work.refinementStats = refined.stats;
}

/** Every requested construction must still be realized by the proposed track. */
function constructionValidator(requests: ConstructionRequest[]) {
  return (candidate: Engine, geometry: TrackLine[], raw: any, candidateRows: any[]) => requests.every(request => {
    const section = geometry.filter(l => Math.floor((l.id - 1000) / 10000) === request.section);
    const guideIds = request.construction === 'scattered'
      ? candidateRows[request.section]?.railGuides ?? []
      : (arcRailGroups(section).get(request.section)?.[1] ?? []).map(l => l.id);
    return inspectConstructionWindow(request, section, new Set<number>(guideIds), raw.frames,
      request.context || request.railLayout === 'transfer' ? (frame: number) => candidate.getAllContactLineIdsAtFrame(frame) : undefined).fulfilled;
  });
}

/** Whole authored-timeline loss with per-section regrets, plus the
 * engagement-gain and motion terms of each requested section. */
function wholeTrackObjective(ctx: ArcCompileContext, requests: ConstructionRequest[]) {
  const {options, contacts, duration, gaps, impactTargets} = ctx;
  return (raw: any, report: any, candidate: Engine) => {
    const ruler = options.impactContract ? impactAccount(options.impactContract) : undefined;
    const physical = ruler ? ruler.observe(candidate, raw.frames) : undefined;
    const impacts = physical ? ruler!.evaluate(physical, impactTargets, duration, report.terminus.reason === 'endOfSpec') : undefined;
    const whole = arcWholeTrajectoryObjective(raw, report, gaps, options.amplitudeWeight, impacts);
    if (physical && Number.isFinite(whole.loss)) for (const request of requests) {
      const extra = engagementGainResiduals(physical as any, request.frame, request.next - 1, options.impactSearch)
        .reduce((n, v) => n + v * v, 0) / contacts.length;
      whole.loss += extra;
      whole.regrets[request.section] += extra;
    }
    if (options.motionQuality && Number.isFinite(whole.loss)) {
      const observed = motionSamples(raw.frames, 1, duration);
      for (const request of requests) {
        const samples = observed.filter(s => s.frame >= request.frame && s.frame < request.next);
        if (!samples.length) continue;
        const impact = request.context?.impact ??
          (request.section ? gaps[request.section - 1]?.targets.impact : request.context?.nextImpact) ?? undefined;
        const extra = motionResiduals(intervalMotionSummary(observed, request.frame, request.next - 1), impact, options.motionQuality)
          .reduce((n, v) => n + v * v, 0) / contacts.length;
        whole.loss += extra;
        whole.regrets[request.section] += extra;
      }
    }
    return whole;
  };
}
