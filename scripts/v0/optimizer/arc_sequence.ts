/** Persistent physical-prefix search. Every retained path has been replayed.
 * One shared allowance covers expansion, bounded recovery and final replay;
 * complete tracks are selected by the shared whole-ride objective. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import type { TrackLine } from '../types.ts';
import { searchInterval, type IntervalResult } from './arc_interval.ts';
import { distinctArrival, distinctCandidates, valueRank, reportedAxes, type MeasuredCandidate, type EvaluatedCandidate } from './arc_candidates.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';
import { constructionStyle } from './repertoire_policy.ts';
import { steepArrival } from './arc_evaluate.ts';

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

/** Study-only access to measured offers. Counterfactual studies may inspect the
 * search context as read-only. Counterfactual search uses withArcStudy with
 * owned context and engines; observers must never mutate the active compile. */
type SequenceObserver = (i: number, offered: ReadonlyArray<{parent: {seq: ArcSequence}; interval: IntervalResult; candidate: MeasuredCandidate; rank: number}>,
  chosen: ReadonlyArray<{parent: {seq: ArcSequence}; candidate: MeasuredCandidate}>, ctx: ArcCompileContext, protectedEngines: readonly Engine[]) => void;
let sequenceObserver: SequenceObserver | undefined;

/** Install a study observer for one isolated worker task, including async input
 * loading. Overlapping studies are rejected; success and failure both remove it. */
export async function withSequenceObserver<T>(observer: SequenceObserver, run: () => Promise<T>): Promise<T> {
  if (sequenceObserver) throw new Error('a sequence study is already active in this worker');
  sequenceObserver = observer;
  try { return await run(); }
  finally { sequenceObserver = undefined; }
}

/** Expand distinct physical prefixes until the track is complete. A dead end
 * may reopen untried alternatives at a recent boundary. */
export function runIntervalSequence(ctx: ArcCompileContext, seq: ArcSequence) {
  const {contacts, options, budget, end, work} = ctx;
  type Node = {seq: ArcSequence; localCost: number};
  type Offer = {parent: Node; interval: IntervalResult; candidate: MeasuredCandidate; localCost: number; rank: number};
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
        {candidate: proposal.candidate, child}, [...protectedEngines, ...nodes.map(b => b.seq.engine)]);
      nodes.push({seq: nextSeq, localCost: proposal.localCost});
    }
    return nodes;
  };
  for (let i = 0; i < contacts.length; i++) {
    const frame = contacts[i].frame, remaining = Math.max(1, end - frame);
    const rate = (budget - getPhysicsFrameCount() - 2 * (end + 1)) / remaining;
    const nominal = (options.samples ?? 80) + (options.guidanceSamples ?? 0);
    const localScale = clamp(rate / (Math.max(nominal * .7, observedRate || nominal) * beam.length * 1.1), .05, 1);
    // A strong catch gets more local search, phased in with the steep arrival
    // (ask 0.4 none, 0.8 all): its strength is decided here.
    const effort = 1 + .6 * (i > 0 ? steepArrival(ctx.gaps[contacts[i].gap]?.targets.impact ?? 0, options.impactSearch) : 0);
    const protectedEngines = beam.map(b => b.seq.engine);
    const offered: Offer[] = [];
    const began = getPhysicsFrameCount();
    let searched = 0;
    try {
      for (const parent of beam) {
        const interval = searchInterval(ctx, parent.seq.engine, i, {
          samples: Math.max(12, Math.floor((options.samples ?? 80) * localScale * effort)),
          guidanceSamples: Math.floor((options.guidanceSamples ?? 0) * localScale * effort),
          responseSamples: Math.floor((options.responseSamples ?? 0) * localScale * effort),
        }, protectedEngines);
        searched++;
        if (!interval?.best) continue;
        const candidates = i === contacts.length - 1 ? interval.candidates : distinctCandidates(options, interval.candidates, 8);
        for (const candidate of candidates) offered.push({parent, interval, candidate,
          localCost: parent.localCost + candidate.localCost,
          rank: i === contacts.length - 1 ? candidate.terminalLoss! : parent.localCost + valueRank(options, candidate)});
        Engine.retainOnly(protectedEngines);
      }
    } catch (error) {
      if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
      work.searchBudgetExhausted = true;
      work.budgetInterruptions.push({phase: 'planning', index: i, frame, viable: offered.length, retained: !!offered.length});
      Engine.retainOnly(protectedEngines);
    }
    // A shaped section that offers nothing is asked for plain arcs, with the same
    // guidance and rail layout, before any earlier boundary is reopened: whether a
    // shape fits is discovered by the search, not predicted from the section's
    // length. The request is updated where every later stage reads it.
    const request = options.constructionRequests?.[i];
    if (!offered.length && !work.searchBudgetExhausted && request && request.construction !== 'arcs') {
      const simpler = {...request, construction: 'arcs' as const};
      work.sectionFallbacks.push([i, request.construction, simpler.construction]);
      options.constructionRequests![i] = simpler;
      if (options.sectionStyles) options.sectionStyles[i] = constructionStyle(simpler);
      i--;
      continue;
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
    const measuredRate = (getPhysicsFrameCount() - began) / Math.max(1, searched * localScale * effort * ((contacts[i + 1]?.frame ?? end + 1) - frame));
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
    // When the beam has room for two, one slot keeps the continuation with the
    // lowest measured cost (accumulated local cost: no arrival prior, no
    // prediction), so what its arrival costs the next catch is measured by the
    // next interval's search rather than predicted.
    if (width >= 2 && i < contacts.length - 1) {
      let measured: Offer | undefined;
      for (const {parent, interval} of new Map(offered.map(o => [o.interval, o])).values())
        for (const candidate of interval.candidates) {
          const localCost = parent.localCost + candidate.localCost;
          if (!measured || localCost < measured.localCost)
            measured = {parent, interval, candidate, localCost, rank: parent.localCost + valueRank(options, candidate)};
        }
      if (measured && chosen.every(o => o.candidate !== measured!.candidate && distinctArrival(o.candidate, measured!.candidate))) {
        if (chosen.length >= width) chosen.pop();
        chosen.push(measured);
      }
    }
    sequenceObserver?.(i, offered, chosen, ctx, protectedEngines);
    if (firstComplete) work.terminalSelectionStats = {candidates: offered.length, initialLoss: firstComplete.candidate.terminalLoss,
      finalLoss: chosen[0].candidate.terminalLoss, changed: chosen[0] !== firstComplete};
    // Keep all distinct measured alternatives at four recent boundaries,
    // reopening at most eight at a time. Only a physical dead end reopens one; its cold
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
function commitInterval(ctx: ArcCompileContext, seq: ArcSequence, i: number, interval: IntervalResult, evaluated: EvaluatedCandidate,
  protectedEngines: Engine[] = []) {
  const {options, memoryFor} = ctx;
  const {failures, frame, next, horizon, incoming} = interval;
  const {candidate: best, child} = evaluated;
  seq.failure = null;
  if ((options.memorySamples ?? 0) > 0 && i > 0)
    memoryFor(i).rememberControl({features: interval.inputFeatures, incoming, span: horizon - frame, control: best.c});
  // Incoming features were captured before candidate construction, which
  // can invalidate cached prefix frames even for a validated child.
  seq.lines.push(...best.lines);
  seq.engine = ctx.lineage.detach(child);
  Engine.retainOnly([...protectedEngines, seq.engine]);
  seq.rows.push({frame, next, incoming, span: interval.span, features: interval.inputFeatures, cost: best.cost, control: best.c,
    achieved: reportedAxes(best), impact: best.actualImpact, release: best.release, lines: best.lines.length,
    railGuides: best.railGuides,
    ...(options.motionQuality ? {motion: best.motion, motionCost: best.motionCost} : {}),
    failures, spent: getPhysicsFrameCount()});
}
