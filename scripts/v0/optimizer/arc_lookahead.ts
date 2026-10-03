/** Lookahead planning: before committing an interval, simulate the following
 * interval(s) from a shortlist of distinct arrivals and prefer the candidate
 * whose continuation is cheapest. Continuations are ordinary, smaller
 * interval searches on the shared meter. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import { searchInterval, type IntervalResult } from './arc_interval.ts';
import { distinctCandidates, restoreCandidate } from './arc_candidates.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';
import type { ArcSequence } from './arc_sequence.ts';

type Continuation = {value: number; localValue: number; control: any; depth: number};

/** Estimated evaluations per continuation sample, counting its local correction. */
const PROBE_RATE = 1.4;

/** Value of continuing from `base` at interval `index`, `depth` intervals
 * deep. A leaf is one simulated interval (optionally valued by the learned
 * future model); a deeper node continues from its two most distinct
 * candidates. Returns null when no continuation exists and the horizon is strict. */
export function continuation(ctx: ArcCompileContext, base: Engine, index: number, depth: number, probeSamples: number,
  protectedEngines: Engine[]): Continuation | null {
  const {options, contacts, work} = ctx;
  const searched = searchInterval(ctx, base, index, {samples: probeSamples,
    guidanceSamples: Math.min(12, options.guidanceSamples ?? 48),
    responseSamples: options.responseSamples}, protectedEngines);
  work.lookaheadStats.continuationNodes++;
  if (!searched?.best) return null;
  const anchor = searched.best;
  if (depth <= 1 || index + 1 >= contacts.length) {
    // A leaf has an exactly simulated local interval and unresolved future
    // work. Blend its heuristic arrival prior with the learned future loss.
    // Completed timelines have no remaining value to predict.
    if ((options.continuationValueWeight ?? 0) > 0 && index + 1 < contacts.length && options.futureValueModel) {
      const weight = options.continuationValueWeight!;
      let winner: Continuation | null = null;
      for (const candidate of searched.candidates) {
        const value = candidate.predictedFuture === undefined ? candidate.cost :
          candidate.cost + weight * (candidate.localCost + candidate.predictedFuture - candidate.cost);
        if (!winner || value < winner.value) winner = {value, localValue: candidate.localCost, control: candidate.c, depth: 1};
      }
      if (winner) return winner;
    }
    return {value: anchor.cost, localValue: anchor.localCost, control: anchor.c, depth: 1};
  }
  let winner: Continuation | null = null, completed = 0;
  try {
    for (const candidate of distinctCandidates(options, searched.candidates, 2)) {
      const branch = ctx.lineage.add(base, candidate.lines);
      const tail = continuation(ctx, branch, index + 1, depth - 1, probeSamples, [...protectedEngines, base, anchor.child]);
      if (tail) {
        completed++;
        const value = candidate.localCost + tail.value;
        if (!winner || value < winner.value) winner = {value, localValue: value, control: candidate.c, depth: 1 + tail.depth};
      }
      Engine.retainOnly([...protectedEngines, base, anchor.child]);
    }
  } catch (error) {
    if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
    work.searchBudgetExhausted = true;
    work.budgetInterruptions.push({phase: 'continuation', index, frame: contacts[index].frame, viable: completed, retained: !!winner});
    Engine.retainOnly([...protectedEngines, base, anchor.child]);
    // A completed branch remains usable when exploration of a sibling stops.
    // Without one, propagate the interruption instead of inventing a horizon.
    if (!winner) throw error;
  }
  return winner ?? (options.strictHorizon ? null : {value: anchor.cost, localValue: anchor.localCost, control: anchor.c, depth: 1});
}

/** Lookahead for interval `i` when configured and a later interval exists.
 * Returns the (possibly changed) best candidate and the probe record, and
 * sets the warm start of interval i+1 from the winning continuation. */
export function planLookahead(ctx: ArcCompileContext, seq: ArcSequence, i: number, interval: IntervalResult, best: any) {
  const {options, contacts, end, budget, work} = ctx;
  if (!(best && (options.lookaheadWidth ?? 0) > 1 && i + 1 < contacts.length)) return {best, lookahead: null};
  const {candidates, frame, next} = interval;
  const {width, probeSamples, depth, nominalRate, constructionReserveRate} = planningAllocation(ctx, i, frame, next);
  let shortlist = distinctCandidates(options, candidates, options.reuseContinuations ? Math.max(12, width) : width);
  if (options.futureValueModel) {
    const original = candidates.find(c => JSON.stringify(c.c) === JSON.stringify(best.c));
    if (original) shortlist = [original, ...shortlist.filter(c => c !== original)];
  }
  const original = best, startFrames = getPhysicsFrameCount(), probes: any[] = [];
  let winner: any = null;
  try {
    for (const candidate of shortlist) {
      if (probes.length >= width && winner) break;
      const reserve = options.adaptivePlanning ? (end - frame) * constructionReserveRate : (end - frame) * nominalRate * (options.reserveFactor ?? 1.1);
      let probeAllowance = 0;
      for (let d = 0; d < depth && i + d + 1 < contacts.length; d++)
        probeAllowance += Math.pow(2, d) * ((contacts[i + d + 2]?.frame ?? end + 1) - contacts[i + d + 1].frame) * probeSamples * PROBE_RATE;
      if (getPhysicsFrameCount() + reserve + probeAllowance > budget - 2 * (end + 1)) break;
      const branch = ctx.lineage.add(seq.engine, candidate.lines);
      const future = continuation(ctx, branch, i + 1, depth, probeSamples, [seq.engine, original.child]);
      work.lookaheadStats.probes++;
      if (!future) work.lookaheadStats.failedProbes++;
      work.lookaheadStats.maxDepth = Math.max(work.lookaheadStats.maxDepth, future?.depth ?? 0);
      const terminal = options.lookaheadObjective === 'terminal' || depth > 1;
      const value = future ? (terminal ? candidate.localCost : candidate.cost) + (terminal ? future.value : future.localValue) : Infinity;
      if (options.reuseContinuations) {
        candidate.lookaheadValue = value;
        candidate.futureControl = future?.control;
      }
      probes.push({control: candidate.c, currentCost: candidate.cost, localCost: candidate.localCost, futureCost: future?.value ?? null,
        depth: future?.depth ?? 0, value: Number.isFinite(value) ? value : null, predictedFuture: candidate.predictedFuture});
      if (future && (!winner || value < winner.value)) winner = {candidate, value, futureControl: future.control};
      Engine.retainOnly([seq.engine, original.child]);
    }
  } catch (error) {
    if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
    work.searchBudgetExhausted = true;
    work.budgetInterruptions.push({phase: 'planning', index: i, frame, viable: probes.length, retained: true});
    Engine.retainOnly([seq.engine, original.child]);
  }
  if (winner && JSON.stringify(winner.candidate.c) !== JSON.stringify(original.c)) {
    const c = winner.candidate;
    best = restoreCandidate(c, ctx.lineage.add(seq.engine, c.lines));
    work.lookaheadStats.changedChoices++;
  }
  if (winner) seq.pendingControl = {index: i + 1, control: winner.futureControl};
  work.lookaheadStats.physicsFrames += getPhysicsFrameCount() - startFrames;
  return {best, lookahead: {probes, selected: winner?.candidate.c ?? original.c}};
}

/** Width, probe samples and depth of lookahead at interval `i`. Adaptive
 * planning widens and deepens the tree when the work available per remaining
 * frame, beyond the reserved construction rate, affords it. */
function planningAllocation(ctx: ArcCompileContext, i: number, frame: number, next: number) {
  const {options, contacts, end, budget, work} = ctx;
  let width = options.lookaheadWidth!, probeSamples = options.lookaheadSamples ?? 32, depth = 1;
  const nominalRate = (options.samples ?? 160) + (options.guidance ? options.guidanceSamples ?? 48 : 0);
  const constructionReserveRate = (options.adaptivePlanning ? Math.max(nominalRate, work.observedConstructionRate) : nominalRate) *
    (options.reserveFactor ?? 1.1);
  if (options.adaptivePlanning) {
    const remaining = Math.max(1, end - frame), rate = (budget - getPhysicsFrameCount() - 2 * (end + 1)) / remaining;
    const localAllowance = Math.max(0, rate - constructionReserveRate) * (next - frame);
    for (let d = Math.min(2, contacts.length - i - 1); d >= 1; d--) {
      let framesPerProbe = 0;
      for (let k = 0; k < d; k++)
        framesPerProbe += Math.pow(2, k) * ((contacts[i + k + 2]?.frame ?? end + 1) - contacts[i + k + 1].frame) * PROBE_RATE;
      const affordable = localAllowance / Math.max(1, framesPerProbe);
      if (affordable < width * probeSamples) continue;
      width = Math.max(width, Math.min(5, Math.floor(affordable / probeSamples)));
      probeSamples = Math.max(probeSamples, Math.min(48, Math.floor(affordable / width)));
      depth = d;
      break;
    }
    work.planningDecisions.push({index: i, frame, observedConstructionRate: work.observedConstructionRate, constructionReserveRate,
      localAllowance, width, probeSamples, depth});
  }
  return {width, probeSamples, depth, nominalRate, constructionReserveRate};
}
