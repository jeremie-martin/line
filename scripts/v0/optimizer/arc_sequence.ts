/** Sequential construction: intervals are searched and committed in order,
 * with lookahead, neighbour revision, bounded quality retries and
 * backtracking to an earlier retained alternative when an interval has no
 * valid arc. The committed track and engine live in an explicit sequence. */
import { LineRiderEngine as Engine, disposeAllWasmEnginesForStudy as disposeSearch } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import type { TrackLine } from '../types.ts';
import type { ArcMotionControl } from './arc_geometry.ts';
import { searchInterval, type IntervalResult } from './arc_interval.ts';
import { distinctArrival, distinctCandidates, valueRank, restoreCandidate } from './arc_candidates.ts';
import { planLookahead } from './arc_lookahead.ts';
import { reviseTransition, refineCoupledPair } from './arc_neighbor_revision.ts';
import type { IntervalOverrides } from './arc_options.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** A committed interval: where its lines start, the chosen candidate and the
 * distinct alternatives left for backtracking. */
export type SequenceStep = {lineStart: number; selected?: any; choices: any[]};

/** The committed track and the engine at its end. */
export type ArcSequence = {
  engine: Engine; lines: TrackLine[]; rows: any[]; steps: SequenceStep[]; failure: any;
  /** Warm start for a later interval, from lookahead or a backtracked choice. */
  pendingControl: {index: number; control: ArcMotionControl} | null;
  /** The longest prefix ever completed; restored if the search ends in failure. */
  deepestPrefix: {lines: TrackLine[]; rows: any[]};
};

export function startSequence(ctx: ArcCompileContext): ArcSequence {
  return {engine: ctx.lineage.rebuild([]), lines: [], rows: [], steps: [], failure: null, pendingControl: null,
    deepestPrefix: {lines: [], rows: []}};
}

/** Searches and commits every interval. Backtracking resumes after the
 * re-committed interval; `seq.failure` records why the sequence stopped early. */
export function runIntervalSequence(ctx: ArcCompileContext, seq: ArcSequence) {
  const {contacts, options, budget, end, work} = ctx;
  type Node = {seq: ArcSequence; localCost: number};
  let beam: Node[] = [{seq, localCost: 0}], observedRate = 0;
  for (let i = 0; i < contacts.length; i++) {
    const frame = contacts[i].frame, remaining = Math.max(1, end - frame);
    const rate = (budget - getPhysicsFrameCount() - 2 * (end + 1)) / remaining;
    const nominal = (options.samples ?? 80) + (options.guidanceSamples ?? 0);
    const localScale = clamp(rate / (Math.max(nominal * .7, observedRate || nominal) * beam.length * 1.1), .05, 1);
    const protectedEngines = beam.map(b => b.seq.engine);
    const offered: Array<{parent: Node; interval: IntervalResult; candidate: any; localCost: number; rank: number}> = [];
    const began = getPhysicsFrameCount();
    let searched = 0;
    try {
      for (const parent of beam) {
        const interval = searchInterval(ctx, parent.seq.engine, i, {
          samples: Math.max(12, Math.floor((options.samples ?? 80) * localScale)),
          guidanceSamples: Math.floor((options.guidanceSamples ?? 0) * localScale),
          responseSamples: Math.floor((options.responseSamples ?? 0) * localScale),
        }, protectedEngines);
        searched++;
        if (!interval?.best) continue;
        const candidates = i === contacts.length - 1 ? interval.candidates : distinctCandidates(options, interval.candidates, 8);
        for (const candidate of candidates) offered.push({parent, interval, candidate,
          localCost: parent.localCost + candidate.localCost,
          rank: i === contacts.length - 1 ? candidate.terminalLoss : parent.localCost + valueRank(options, candidate)});
        Engine.retainOnly(protectedEngines);
      }
    } catch (error) {
      if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
      work.searchBudgetExhausted = true;
      work.budgetInterruptions.push({phase: 'planning', index: i, frame, viable: offered.length, retained: !!offered.length});
      Engine.retainOnly(protectedEngines);
    }
    if (!offered.length) {seq.failure = {frame, reason: 'beam_no_arc'}; return;}
    const measuredRate = (getPhysicsFrameCount() - began) / Math.max(1, searched * localScale * ((contacts[i + 1]?.frame ?? end + 1) - frame));
    observedRate = observedRate ? .8 * observedRate + .2 * measuredRate : measuredRate;
    work.observedConstructionRate = observedRate;
    offered.sort((a, b) => a.rank - b.rank);
    const chosen: typeof offered = [];
    for (const proposal of offered) {
      if (chosen.every(other => distinctArrival(other.candidate, proposal.candidate))) chosen.push(proposal);
      if (chosen.length >= (i === contacts.length - 1 ? 1 : 4)) break;
    }
    const nextBeam: Node[] = [];
    for (const proposal of chosen) {
      const parent = proposal.parent.seq;
      const nextSeq: ArcSequence = {...parent, lines: parent.lines.slice(), rows: parent.rows.slice(), steps: parent.steps.slice(), pendingControl: null};
      const child = ctx.lineage.add(parent.engine, proposal.candidate.lines);
      commitInterval(ctx, nextSeq, i, proposal.interval, restoreCandidate(proposal.candidate, child), null, null,
        [...protectedEngines, ...nextBeam.map(b => b.seq.engine)]);
      nextBeam.push({seq: nextSeq, localCost: proposal.localCost});
    }
    beam = nextBeam;
    Object.assign(seq, beam[0].seq);
    Engine.retainOnly(beam.map(b => b.seq.engine));
    work.planningDecisions.push({index:i, frame, beamWidth:beam.length, offered:offered.length, localScale, physicsFrames:getPhysicsFrameCount()-began});
  }
}

/** Per-interval search allowance and warm start. Budget-adaptive local search
 * shrinks the sample counts when the remaining work per remaining frame
 * falls below the observed construction rate. */
function intervalAllowance(ctx: ArcCompileContext, seq: ArcSequence, i: number) {
  const {options, contacts, end, budget, work} = ctx;
  const overrides: IntervalOverrides = seq.pendingControl?.index === i ? {warmStart: seq.pendingControl.control} : {};
  // Normalize the observed rate back to the full local allocation, so an
  // emergency reduction does not falsely make later full searches look cheap.
  let localScale = 1;
  if (options.budgetAdaptiveLocal) {
    const nominal = (options.samples ?? 160) + (options.guidance ? options.guidanceSamples ?? 48 : 0);
    const remaining = Math.max(1, end - contacts[i].frame), available = (budget - getPhysicsFrameCount() - 2 * (end + 1)) / remaining;
    localScale = clamp(available / (Math.max(nominal * .7, work.observedConstructionRate || nominal) * 1.1), .05, 1);
    overrides.samples = Math.max(12, Math.floor((options.samples ?? 160) * localScale));
    overrides.guidanceSamples = Math.floor((options.guidanceSamples ?? 48) * localScale);
    overrides.responseSamples = Math.floor((options.responseSamples ?? 0) * localScale);
  }
  return {overrides, localScale};
}

/** A speed miss above 0.3 may resume from an earlier alternative, a bounded
 * number of times per contact, when the remaining work covers the rebuild.
 * Returns the index to resume after, or null. */
function qualityRetry(ctx: ArcCompileContext, seq: ArcSequence, interval: IntervalResult, best: any): number | null {
  const {options, end, budget, work} = ctx;
  const {frame, targets} = interval;
  // A quality retry resumes at an earlier fork and rebuilds its engine.
  // Estimate from that boundary, including its cold prefix, rather than
  // granting a retry using only the shorter suffix at the current contact.
  let retryIndex = seq.steps.length - 1;
  while (retryIndex >= 0 && !seq.steps[retryIndex].choices.length) retryIndex--;
  const retryFrame = retryIndex < 0 ? frame : seq.rows[retryIndex].frame;
  if (!(best && (options.qualityRetries ?? 0) > 0 && targets.speed !== undefined && Math.abs(best.achieved.speed - targets.speed) > .3 &&
    (work.qualityRetries.get(frame) ?? 0) < options.qualityRetries! &&
    getPhysicsFrameCount() + retryFrame + (end - retryFrame) * (options.samples ?? 160) * 1.1 < budget - 2 * (end + 1))) return null;
  work.qualityRetries.set(frame, (work.qualityRetries.get(frame) ?? 0) + 1);
  return seq.steps.some(s => s.choices.length) ? backtrack(ctx, seq) : null;
}

/** Walks back to the latest committed interval with an untried alternative,
 * commits that alternative and returns its index; null when none is left.
 * Saves the deepest completed prefix before discarding anything. */
function backtrack(ctx: ArcCompileContext, seq: ArcSequence): number | null {
  // Save completed intervals before destructively walking to an earlier fork.
  if (seq.rows.length > seq.deepestPrefix.rows.length) seq.deepestPrefix = {lines: seq.lines.slice(), rows: seq.rows.slice()};
  seq.pendingControl = null;
  while (seq.steps.length > 0) {
    const step = seq.steps.pop()!, old = seq.rows.pop();
    seq.lines.length = step.lineStart;
    if (!step.choices.length) continue;
    const choice = step.choices.shift();
    seq.lines.push(...choice.lines);
    disposeSearch();
    seq.engine = ctx.lineage.rebuild(seq.lines);
    seq.rows.push({...old, ...choice.meta, control: choice.c, cost: choice.cost, spent: getPhysicsFrameCount()});
    seq.steps.push(step);
    ctx.work.backtracks++;
    if (choice.futureControl) seq.pendingControl = {index: seq.rows.length, control: choice.futureControl};
    return seq.rows.length - 1;
  }
  return null;
}

/** On the final interval, choose among the already simulated complete
 * alternatives by whole-trajectory loss; this costs no physics. */
function selectTerminal(ctx: ArcCompileContext, i: number, interval: IntervalResult, best: any) {
  const {contacts, work} = ctx;
  if (i !== contacts.length - 1) return {best, childLines: null};
  const candidates = interval.candidates;
  const original = candidates.find(c => JSON.stringify(c.c) === JSON.stringify(best.c));
  // Infinity is a measured invalid complete trajectory (for example a
  // reconstructed prefix lost an earlier landing), not a missing value.
  // Preserve that failed outcome for the final judge instead of crashing.
  if (!original || candidates.some(c => typeof c.terminalLoss !== 'number' || Number.isNaN(c.terminalLoss)))
    throw new Error('missing complete-trajectory candidate loss');
  const selected = candidates.reduce((a, b) => b.terminalLoss < a.terminalLoss - 1e-15 ? b : a, original);
  const changed = selected !== original;
  work.terminalSelectionStats = {candidates: candidates.length, initialLoss: original.terminalLoss, finalLoss: selected.terminalLoss, changed};
  if (!changed) return {best, childLines: null};
  return {best: restoreCandidate(selected, best.child), childLines: selected.lines as TrackLine[]};
}

/** Commits `best` as interval `i`: keeps up to twelve distinct alternatives
 * for backtracking, remembers the control, extends lines and engine, and
 * appends the row. */
function commitInterval(ctx: ArcCompileContext, seq: ArcSequence, i: number, interval: IntervalResult, best: any,
  terminalChildLines: TrackLine[] | null, lookahead: any, protectedEngines: Engine[] = []) {
  const {options, memoryFor} = ctx;
  const {candidates, failures, frame, next, horizon, incoming} = interval;
  seq.failure = null;
  const alternatives: any[] = [];
  const planRank = (c: any) => c.lookaheadValue === undefined ? 1 : Number.isFinite(c.lookaheadValue) ? 0 : 2;
  for (const candidate of candidates.sort((a, b) =>
    planRank(a) - planRank(b) || ((a.lookaheadValue ?? a.cost) - (b.lookaheadValue ?? b.cost)))) {
    if (alternatives.every(a => distinctArrival(a, candidate))) alternatives.push(candidate);
    if (alternatives.length >= 12) break;
  }
  seq.steps.push({lineStart: seq.lines.length, selected: candidates.find(c => c.lines === best.lines),
    choices: alternatives.filter(a => JSON.stringify(a.c) !== JSON.stringify(best.c))});
  if ((options.memorySamples ?? 0) > 0 && i > 0)
    memoryFor(i).rememberControl({features: interval.inputFeatures, incoming, span: horizon - frame, control: best.c});
  // Incoming features were captured before candidate construction, which
  // can invalidate cached prefix frames even for a validated child.
  if (terminalChildLines) best.child = ctx.lineage.add(seq.engine, terminalChildLines);
  seq.lines.push(...best.lines);
  seq.engine = ctx.lineage.detach(best.child);
  Engine.retainOnly([...protectedEngines, seq.engine]);
  const selectedMeta = candidates.find(c => c.lines === best.lines)?.meta;
  seq.rows.push({frame, next, incoming, span: interval.span, features: interval.inputFeatures, cost: best.cost, control: best.c,
    achieved: best.achieved, impact: best.actualImpact, release: best.release, lines: best.lines.length,
    railGuides: selectedMeta?.railGuides ?? best.railGuides,
    ...(options.motionQuality ? {motion: selectedMeta?.motion ?? best.motion, motionCost: selectedMeta?.motionCost ?? best.motionCost} : {}),
    failures, lookahead, spent: getPhysicsFrameCount()});
}
