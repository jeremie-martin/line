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

/** A scattered section keeps only the contact footprints of its curves: the
 * four cheapest are observed as fragments and the first valid one wins. */
function replaceWithFragments(s: IntervalSearch) {
  const {ctx, engine, frame, horizon} = s;
  const {observerFor, observers, prefixes} = ctx.lineage;
  const stats = ctx.work.fragmentStats;
  stats.intervals++;
  const source = s.candidates.slice().sort((a, b) => a.cost - b.cost).slice(0, 4);
  s.candidates.length = 0;
  s.best = null;
  const observer = observerFor(engine);
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
      break;
    }
  }
}
