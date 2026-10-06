/** Refinement of a complete committed track: supplies the whole-track
 * objective, construction validation and engine lineage to refineArcTrack,
 * and adopts its result. */
import type { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { setPhysicsFrameLimit } from '../../lib/detector.ts';
import type { TrackLine } from '../types.ts';
import { refineArcTrack } from './arc_refinement.ts';
import { arcWholeTrajectoryObjective, arcSelectionObjective } from './arc_objective.ts';
import { arcRailGroups } from './arc_guidance.ts';
import { inspectConstructionWindow } from './repertoire_candidate.ts';
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
  const refined = refineArcTrack({engine: seq.engine, lines: seq.lines, rows: seq.rows,
    contacts, end, start, budget, options,
    search: (engine, i, overrides, protectedEngines) => searchInterval(ctx, engine, i, overrides, protectedEngines),
    report: ctx.reportFor,
    objective: (raw, report, candidate) => {
      const ruler = options.impactContract ? impactAccount(options.impactContract) : undefined;
      const physical = ruler?.observe(candidate, raw.frames);
      const impacts = physical ? ruler!.evaluate(physical, ctx.impactTargets, ctx.duration, report.terminus.reason === 'endOfSpec') : undefined;
      return arcSelectionObjective(ctx, raw, physical, arcWholeTrajectoryObjective(raw, report, ctx.gaps, options.amplitudeWeight, impacts));
    },
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

