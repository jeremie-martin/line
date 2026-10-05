/** Search of one support interval: from the physical state at the interval
 * start, propose connected arc geometry, measure every proposal natively and
 * refine locally around the best. All work is charged to the shared meter. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import { extendContactObserver, fragmentInterval } from './contact_interval.ts';
import { resolveIntervalOptions, openInterval, type IntervalSearch } from './arc_interval_state.ts';
import { evaluate } from './arc_evaluate.ts';
import { proposeInitialControls, proposeOpposingEntries, proposeCompactFolds, proposeObservedReceivers, recoverInitialization } from './arc_proposals.ts';
import { coordinateSearch, guidanceSearch } from './arc_local_search.ts';
import type { IntervalOverrides } from './arc_options.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';
import {arcControlMemoKey} from './arc_motion_control.ts';
import {distinctCandidates} from './arc_candidates.ts';

/** Searches interval `i` from `engine` with optional per-call overrides.
 * Engines in `protectedEngines` survive the search's engine cleanup. Returns
 * null when the interval is too short for a support. With explicit
 * `directControls`, only those controls are measured. */
export function searchInterval(ctx: ArcCompileContext, engine: Engine, i: number, overrides: IntervalOverrides = {},
  protectedEngines: Engine[] = []) {
  const options = resolveIntervalOptions(ctx, i, overrides);
  const controlMemory = ctx.memoryFor(i);
  const s = openInterval(ctx, engine, i, options, controlMemory, protectedEngines);
  if (!s) return null;
  try {
    if (options.directControls) {
      for (const control of options.directControls) evaluate(s, control);
    } else {
      proposeInitialControls(s);
      proposeOpposingEntries(s);
      proposeCompactFolds(s);
      proposeObservedReceivers(s);
      recoverInitialization(s);
      coordinateSearch(s);
      guidanceSearch(s);
    }
  } catch (error) {
    if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
    ctx.work.searchBudgetExhausted = true;
    ctx.work.budgetInterruptions.push({phase: 'local', index: i, frame: s.frame, viable: s.candidates.length, retained: !!s.best});
    // Every retained candidate already passed the complete interval replay.
    // Discard only the interrupted probe, preserving the best valid geometry.
    Engine.retainOnly([...protectedEngines, engine, ...(s.best ? [s.best.child] : [])]);
    if (!s.best) throw error;
  }
  if (s.best && options.constructionRequests?.[i]?.construction === 'scattered') replaceWithFragments(s);
  return {best: s.best, candidates: s.candidates, failures: s.failures, frame: s.frame, next: s.next, horizon: s.horizon, gap: s.gap,
    outgoing: s.outgoing, targets: s.targets, incoming: s.incoming, pace: s.pace, center: s.center, support: s.support, span: s.span,
    inputFeatures: s.inputFeatures};
}

export type IntervalResult = NonNullable<ReturnType<typeof searchInterval>>;

/** Replay contact footprints of distinct arrivals, retaining alternatives
 * for the same continuation search used by connected constructions. */
function replaceWithFragments(s: IntervalSearch) {
  const {ctx, engine, frame, horizon} = s;
  const {observerFor, observers, prefixes} = ctx.lineage;
  const stats = ctx.work.fragmentStats;
  stats.intervals++;
  const carriers = s.candidates.slice();
  const source = distinctCandidates(s.options, carriers, 4);
  s.candidates.length = 0;
  s.best = null;
  const observer = observerFor(engine);
  // A verified realization remains eligible when its control was offered in
  // this search. Unrelated cached controls must never enter an exact-control
  // probe (used by joint refinement and continuation replay).
  for (const key of new Set(carriers.map(c => arcControlMemoKey(c.c, s.options.channel)))) {
    const saved = s.memo.get(key + '|fragments');
    const candidate = saved?.candidate;
    if (candidate) evaluate(s, candidate.c, {lines: candidate.lines, guideIds: candidate.meta.railGuides});
  }
  try {
    for (const proposal of source) {
      const began = getPhysicsFrameCount();
      stats.probes++;
      const fragments = fragmentInterval(observer, proposal.lines, frame, horizon);
      const observed = getPhysicsFrameCount();
      stats.observationFrames += observed - began;
      const result = evaluate(s, proposal.c, fragments);
      stats.replayFrames += getPhysicsFrameCount() - observed;
      if (result) {
        const prefix = prefixes.get(result.child)!;
        observers.set(prefix, extendContactObserver(observer, fragments.lines));
      }
    }
  } catch (error) {
    if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
    ctx.work.searchBudgetExhausted = true;
    ctx.work.budgetInterruptions.push({phase: 'fragments', index: s.i, frame, viable: s.candidates.length, retained: !!s.best});
    Engine.retainOnly([...s.protectedEngines, engine, ...(s.best ? [s.best.child] : [])]);
    if (!s.best) throw error;
  }
}
