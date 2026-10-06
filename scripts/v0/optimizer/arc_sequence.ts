/** Persistent physical-prefix search. Every retained path has been replayed.
 * One shared allowance covers expansion, bounded recovery and final replay;
 * complete tracks are selected by the shared whole-ride objective. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import type { TrackLine } from '../types.ts';
import { searchInterval, type IntervalResult } from './arc_interval.ts';
import { distinctArrival, distinctCandidates, valueRank, restoreCandidate } from './arc_candidates.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** The committed track and the engine at its end. */
export type ArcSequence = {
  engine: Engine; lines: TrackLine[]; rows: any[]; failure: any;
  /** The longest prefix ever completed; restored if the search ends in failure. */
  deepestPrefix: {lines: TrackLine[]; rows: any[]};
};

export function startSequence(ctx: ArcCompileContext): ArcSequence {
  return {engine: ctx.lineage.rebuild([]), lines: [], rows: [], failure: null,
    deepestPrefix: {lines: [], rows: []}};
}

/** Expand distinct physical prefixes until the track is complete. A dead end
 * may reopen untried alternatives at a recent boundary. */
export function runIntervalSequence(ctx: ArcCompileContext, seq: ArcSequence) {
  const {contacts, options, budget, end, work} = ctx;
  type Node = {seq: ArcSequence; localCost: number};
  type Offer = {parent: Node; interval: IntervalResult; candidate: any; localCost: number; rank: number};
  let beam: Node[] = [{seq: {...seq, lines: seq.lines.slice(), rows: seq.rows.slice()}, localCost: 0}], observedRate = 0;
  const frontier: Offer[][] = [];
  let deepest = {lines: seq.lines.slice(), rows: seq.rows.slice()};
  const choose = (offers: Offer[], width: number) => {
    const selected: Offer[] = [];
    for (const proposal of offers) {
      if (selected.every(other => distinctArrival(other.candidate, proposal.candidate))) selected.push(proposal);
      if (selected.length >= width) break;
    }
    return selected;
  };
  const materialize = (offers: Offer[], index: number, rebuild: boolean, protectedEngines: Engine[]) => {
    const nodes: Node[] = [];
    for (const proposal of offers) {
      const parent = proposal.parent.seq;
      const parentEngine = rebuild ? ctx.lineage.rebuild(parent.lines) : parent.engine;
      const nextSeq: ArcSequence = {...parent, engine: parentEngine, lines: parent.lines.slice(), rows: parent.rows.slice(),
        failure: null};
      const child = ctx.lineage.add(parentEngine, proposal.candidate.lines);
      commitInterval(ctx, nextSeq, index, {...proposal.interval, candidates: [proposal.candidate]},
        restoreCandidate(proposal.candidate, child), [...protectedEngines, ...nodes.map(b => b.seq.engine)]);
      nodes.push({seq: nextSeq, localCost: proposal.localCost});
    }
    return nodes;
  };
  for (let i = 0; i < contacts.length; i++) {
    const frame = contacts[i].frame, remaining = Math.max(1, end - frame);
    const rate = (budget - getPhysicsFrameCount() - 2 * (end + 1)) / remaining;
    const nominal = (options.samples ?? 80) + (options.guidanceSamples ?? 0);
    const localScale = clamp(rate / (Math.max(nominal * .7, observedRate || nominal) * beam.length * 1.1), .05, 1);
    const protectedEngines = beam.map(b => b.seq.engine);
    const offered: Offer[] = [];
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
    if (!offered.length) {
      let previous = i - 1;
      while (previous >= 0 && !frontier[previous]?.length) previous--;
      if (previous < 0 || work.searchBudgetExhausted) {
        seq.deepestPrefix = deepest;
        seq.failure = {frame, reason: work.searchBudgetExhausted ? 'budget' : 'no_arc'};
        return;
      }
      const retained = frontier[previous].splice(0, 8);
      frontier.length = previous + 1;
      beam = materialize(retained, previous, true, []);
      Object.assign(seq, beam[0].seq);
      Engine.retainOnly(beam.map(b => b.seq.engine));
      work.backtracks++;
      i = previous;
      continue;
    }
    const measuredRate = (getPhysicsFrameCount() - began) / Math.max(1, searched * localScale * ((contacts[i + 1]?.frame ?? end + 1) - frame));
    observedRate = observedRate ? .8 * observedRate + .2 * measuredRate : measuredRate;
    work.observedConstructionRate = observedRate;
    const firstComplete = i === contacts.length - 1 ? offered[0] : undefined;
    offered.sort((a, b) => a.rank - b.rank);
    // Do not keep more prefixes than the remaining allowance can search
    // at the minimum local sampling floor. Each retained branch costs work.
    const nextFrame = contacts[i + 1]?.frame ?? end;
    const remainingRate = (budget - getPhysicsFrameCount() - 2 * (end + 1)) / Math.max(1, end - nextFrame);
    const minimumScale = Math.max(.05, 12 / Math.max(12, options.samples ?? 80));
    const width = clamp(Math.floor(remainingRate / Math.max(1, observedRate * minimumScale * 1.1)), 1, 8);
    const chosen = choose(offered, i === contacts.length - 1 ? 1 : width);
    if (firstComplete) work.terminalSelectionStats = {candidates: offered.length, initialLoss: firstComplete.candidate.terminalLoss,
      finalLoss: chosen[0].candidate.terminalLoss, changed: chosen[0] !== firstComplete};
    // A bounded beam stack keeps the next distinct alternatives at each of
    // four recent boundaries. Only a physical dead end reopens one; its cold
    // prefix and all renewed search remain charged to the ordinary meter.
    frontier[i] = choose(offered.filter(p => !chosen.includes(p)), offered.length).map(p =>
      ({...p, interval: {...p.interval, best: null, candidates: [p.candidate]}}));
    for (let j = 0; j < i - 3; j++) frontier[j] = [];
    beam = materialize(chosen, i, false, protectedEngines);
    Object.assign(seq, beam[0].seq);
    Engine.retainOnly(beam.map(b => b.seq.engine));
    if (seq.rows.length > deepest.rows.length) deepest = {lines: seq.lines.slice(), rows: seq.rows.slice()};
    seq.deepestPrefix = deepest;
    work.planningDecisions.push({index:i, frame, beamWidth:beam.length, offered:offered.length, localScale, physicsFrames:getPhysicsFrameCount()-began});
  }
}

/** Materialize a selected, already verified physical prefix. */
function commitInterval(ctx: ArcCompileContext, seq: ArcSequence, i: number, interval: IntervalResult, best: any,
  protectedEngines: Engine[] = []) {
  const {options, memoryFor} = ctx;
  const {candidates, failures, frame, next, horizon, incoming} = interval;
  seq.failure = null;
  if ((options.memorySamples ?? 0) > 0 && i > 0)
    memoryFor(i).rememberControl({features: interval.inputFeatures, incoming, span: horizon - frame, control: best.c});
  // Incoming features were captured before candidate construction, which
  // can invalidate cached prefix frames even for a validated child.
  seq.lines.push(...best.lines);
  seq.engine = ctx.lineage.detach(best.child);
  Engine.retainOnly([...protectedEngines, seq.engine]);
  const selectedMeta = candidates.find(c => c.lines === best.lines)?.meta;
  seq.rows.push({frame, next, incoming, span: interval.span, features: interval.inputFeatures, cost: best.cost, control: best.c,
    achieved: best.achieved, impact: best.actualImpact, release: best.release, lines: best.lines.length,
    railGuides: selectedMeta?.railGuides ?? best.railGuides,
    ...(options.motionQuality ? {motion: selectedMeta?.motion ?? best.motion, motionCost: selectedMeta?.motionCost ?? best.motionCost} : {}),
    failures, spent: getPhysicsFrameCount()});
}
