/** Final stage of an arc compilation: cold replay of the chosen geometry,
 * pruning of untouched guide segments, an independent fixed-engine replay
 * that must agree exactly, and the measured result. */
import { disposeAllWasmEnginesForStudy as disposeSearch, type LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, setPhysicsFrameLimit, extractRawTrajectory } from '../../lib/detector.ts';
import { buildTrackJson } from '../core/substrate.ts';
import type { TrackLine } from '../types.ts';
import { createArcEngine } from './arc_engine.ts';
import { trimUnusedArcGuides, arcRailGroups } from './arc_guidance.ts';
import { arcWholeTrajectoryObjective } from './arc_refinement.ts';
import { inspectConstructionWindow } from './repertoire_candidate.ts';
import { motionSamples } from './motion_quality.ts';
import { motionResiduals, intervalMotionSummary } from './motion_objective.ts';
import { engagementGainResiduals } from './impact_search.ts';
import { impactAccount } from './impact_accounts.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';

// The frozen judge wrapper has an isolate-wide handle registry, not individual
// disposal. A private module instance gives replay its own WASM instance and
// registry without changing judge code or freeing engines retained by callers.
// Keep these handles local to the synchronous replay and dispose them below.
const {LineRiderEngine: Judge, disposeAllWasmEnginesForStudy: disposeJudge} =
  await import(new URL('../../lib/_lr_engine_wasm.ts?arc-compiler-replay', import.meta.url).href);
export {disposeJudge};

const sectionOf = (line: TrackLine) => Math.floor((line.id - 1000) / 10000);

/** Geometry and rows committed by the search, plus the deepest prefix it ever completed. */
export type CommittedTrack = {
  lines: TrackLine[]; rows: any[]; failure: any;
  deepestPrefix: {lines: TrackLine[]; rows: any[]};
};

/** Measures the committed track and assembles the compiler result. `lines`
 * and `rows` are updated in place when an earlier prefix or pruning wins. */
export function finalizeArcTrack(ctx: ArcCompileContext, track: CommittedTrack) {
  const {options, budget, end, duration, start, gaps, impactTargets, work} = ctx;
  const {lines, rows, failure} = track;
  if (failure && track.deepestPrefix.rows.length > rows.length) {
    lines.splice(0, lines.length, ...track.deepestPrefix.lines);
    rows.splice(0, rows.length, ...track.deepestPrefix.rows);
  }
  const constructionFrames = getPhysicsFrameCount();
  setPhysicsFrameLimit(budget);
  const coldEngine = createArcEngine(start, lines);
  const raw = extractRawTrajectory(coldEngine, end);
  const guidanceReduction = pruneUntouchedGuides(ctx, lines, coldEngine, raw);
  const ruler = options.impactContract ? impactAccount(options.impactContract) : undefined;
  const finalImpactFrames = ruler ? ruler.observe(coldEngine, raw.frames) : undefined;
  disposeSearch();
  try {
    const base = new Judge().setStart(start.position, start.velocity), judge = lines.length ? base.addLine(lines) : base;
    const replay = extractRawTrajectory(judge, end);
    if (JSON.stringify(replay) !== JSON.stringify(raw)) throw new Error('fixed-engine replay mismatch');
    if (finalImpactFrames && JSON.stringify(ruler!.observe(judge, replay.frames)) !== JSON.stringify(finalImpactFrames))
      throw new Error('fixed-engine impact observation mismatch');
  } finally {
    disposeJudge();
    setPhysicsFrameLimit(null);
  }
  const report = ctx.reportFor(raw, lines);
  const impactEvaluation = finalImpactFrames
    ? ruler!.evaluate(finalImpactFrames, impactTargets, duration, report.terminus.reason === 'endOfSpec') : undefined;
  const trajectoryLoss = options.collectTrajectoryLoss ? arcWholeTrajectoryObjective(raw, report, gaps, options.amplitudeWeight).loss : undefined;
  const impactTrajectoryLoss = impactEvaluation
    ? arcWholeTrajectoryObjective(raw, report, gaps, options.amplitudeWeight, impactEvaluation).loss : undefined;
  const selectionLoss = completeSelectionLoss(ctx, raw, finalImpactFrames, impactTrajectoryLoss ?? trajectoryLoss);
  return {
    track: buildTrackJson(lines, end, start), report,
    ...(ctx.hasFragments ? {fragmentStats: work.fragmentStats} : {}),
    ...(options.initialRecoverySamples ? {initializationRecovery: work.initializationRecovery} : {}),
    stats: {viable_candidate_samples: work.viableCandidates, sim_frames: getPhysicsFrameCount(),
      gap_commits: report.contacts.filter(c => c.status === 'hit').length},
    rows, initialProposalWork: work.initialProposalWork, observedReceiverWork: work.observedReceiverWork,
    ...(options.opposingEntryProposals ? {opposingEntryWork: work.opposingEntryWork} : {}),
    coupledIntervalWork: work.coupledIntervalWork, transitionRevisionWork: work.transitionRevisionWork,
    constructionImprovement: work.constructionImprovement, failure, budget,
    searchBudgetExhausted: work.searchBudgetExhausted, budgetInterruptions: work.budgetInterruptions,
    candidateMemo: {hits: work.memoHits, rejectedHits: work.memoRejectedHits}, samples: work.samples, backtracks: work.backtracks,
    qualityRetries: Object.fromEntries(work.qualityRetries), lookaheadStats: work.lookaheadStats, trajectoryLoss, selectionLoss,
    planningDecisions: work.planningDecisions, refinementStats: work.refinementStats, terminalSelectionStats: work.terminalSelectionStats,
    ...(impactEvaluation ? {impactEvaluation, impactTrajectoryLoss} : {}),
    guidanceReduction: guidanceReduction.stats, constructionFrames,
  };
}

/** Removes guide segments the final ride never touches. Fragment sections
 * have no guide rail; a contextual or transfer construction that pruning
 * would leave unfulfilled keeps its full guide. */
function pruneUntouchedGuides(ctx: ArcCompileContext, lines: TrackLine[], coldEngine: Engine, raw: any) {
  const {options, end} = ctx;
  const fragments = new Set(Object.values(options.constructionRequests ?? {}).filter(r => r.construction === 'scattered').map(r => r.section));
  const guidanceReduction = trimUnusedArcGuides(lines, coldEngine, end, fragments);
  const requests = Object.values(options.constructionRequests ?? {}).filter(r => r.context || r.railLayout === 'transfer');
  if (requests.length) {
    const contacts = raw.frames.map((f: {frame: number; position: {x: number; y: number}}) =>
      ({position: f.position, contactLineIds: coldEngine.getAllContactLineIdsAtFrame(f.frame)}));
    const restore = new Set<number>();
    for (const request of requests) {
      if (request.construction === 'scattered') continue;
      const original = lines.filter(l => sectionOf(l) === request.section);
      const proposed = guidanceReduction.lines.filter(l => sectionOf(l) === request.section);
      if (original.length === proposed.length) continue;
      const guides = new Set((arcRailGroups(original).get(request.section)?.[1] ?? []).map(l => l.id));
      if (inspectConstructionWindow(request, original, guides, contacts).fulfilled &&
        !inspectConstructionWindow(request, proposed, guides, contacts).fulfilled) restore.add(request.section);
    }
    if (restore.size) {
      const kept = new Set(guidanceReduction.lines.map(l => l.id));
      guidanceReduction.lines = lines.filter(l => restore.has(sectionOf(l)) || kept.has(l.id));
      const spans = guidanceReduction.stats.spans.map(s => restore.has(s.group) ? {...s, after: s.before, lengthAfter: s.lengthBefore} : s);
      Object.assign(guidanceReduction.stats, {spans, retainedForConstruction: [...restore],
        removedSegments: lines.length - guidanceReduction.lines.length,
        removedGuides: spans.filter(s => s.before > 0 && s.after === 0).length,
        shortenedGuides: spans.filter(s => s.after > 0 && s.after < s.before).length,
        lengthAfter: spans.reduce((n, s) => n + s.lengthAfter, 0)});
    }
  }
  lines.splice(0, lines.length, ...guidanceReduction.lines);
  return guidanceReduction;
}

/** The authored trajectory loss plus, per support, the engagement-gain and
 * motion terms that interval search optimized (each averaged over supports). */
function completeSelectionLoss(ctx: ArcCompileContext, raw: any, finalImpactFrames: any[] | undefined, loss: number | undefined) {
  const {options, contacts, duration, gaps} = ctx;
  let selectionLoss = loss;
  if (selectionLoss !== undefined && finalImpactFrames) for (const [i, contact] of contacts.entries()) {
    const next = contacts[i + 1]?.frame ?? duration + 1;
    selectionLoss += engagementGainResiduals(finalImpactFrames as any, contact.frame, next - 1, options.impactSearch)
      .reduce((n, v) => n + v * v, 0) / contacts.length;
  }
  if (selectionLoss !== undefined && options.motionQuality) {
    const observed = motionSamples(raw.frames, 1, duration);
    for (const [i, contact] of contacts.entries()) {
      const next = contacts[i + 1]?.frame ?? duration + 1, request = options.constructionRequests?.[i];
      const samples = observed.filter(s => s.frame >= contact.frame && s.frame < next);
      if (!samples.length) continue;
      const impact = contact.gap >= 0 ? gaps[contact.gap].targets.impact : request?.context?.nextImpact ?? undefined;
      selectionLoss += motionResiduals(intervalMotionSummary(observed, contact.frame, next - 1), impact, options.motionQuality)
        .reduce((n, r) => n + r * r, 0) / contacts.length;
    }
  }
  return selectionLoss;
}
