/** Persistent physical-prefix search. Every retained path has been replayed.
 * One shared allowance covers expansion, bounded recovery and final replay;
 * complete tracks are selected by the shared whole-ride objective. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import type { TrackLine } from '../types.ts';
import { searchInterval, type IntervalResult } from './arc_interval.ts';
import { distinctArrival, distinctCandidates, valueRank, restoreCandidate } from './arc_candidates.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';
import { constructionStyle, constructions, type ConstructionRequest } from './repertoire_policy.ts';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** How much worse (in local-cost units) an alternative may be and still be
 * chosen now and then: each offer's rank is perturbed by Gumbel noise of this
 * scale, which samples the kept prefixes with probability falling smoothly as
 * exp(−Δcost / CHOICE_SCALE). 0.02 ≈ missing one hit's strength by 0.1. */
const CHOICE_SCALE = 0;
const gumbel = (random: () => number) => -Math.log(-Math.log(Math.max(1e-12, random())));

/** A free gap (request.free, the neutral plain-arcs request) is searched with
 * every geometry: plain arcs without the rail, and each family with the rail
 * offered. An explicit request is searched as asked. */
type Family = {ctx: ArcCompileContext; request?: ConstructionRequest};
function familiesFor(ctx: ArcCompileContext, i: number): Family[] {
  const request = ctx.options.constructionRequests?.[i];
  const free = request?.free && request.construction === 'arcs' && request.guidance === 'optional' && request.railLayout === 'paired';
  if (!free) return [{ctx, request}];
  const {free: _free, ...base} = request;
  const asks: ConstructionRequest[] = [{...base, construction: 'arcs', guidance: 'forbidden'},
    ...constructions.map(construction => ({...base, construction, guidance: 'optional' as const}))];
  return asks.map(ask => {
    const options = {...ctx.options, sectionStyles: {...ctx.options.sectionStyles, [i]: constructionStyle(ask)},
      constructionRequests: {...ctx.options.constructionRequests, [i]: ask}};
    return {ctx: {...ctx, options, memoryFor: (index: number) => ctx.memoryFor(index, options)}, request: ask};
  });
}
/** The chosen geometry of each free gap becomes its request, where every later
 * stage (finalize, realization, reports) reads it. */
function realizeFamilies(ctx: ArcCompileContext, rows: any[]) {
  for (const [i, row] of rows.entries()) if (row.realized) {
    ctx.options.constructionRequests![i] = row.realized;
    if (ctx.options.sectionStyles) ctx.options.sectionStyles[i] = constructionStyle(row.realized);
  }
}

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
  type Offer = {parent: Node; interval: IntervalResult; candidate: any; localCost: number; rank: number; family: Family};
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
      commitInterval(proposal.family.ctx, nextSeq, index, {...proposal.interval, candidates: [proposal.candidate]},
        restoreCandidate(proposal.candidate, child), [...protectedEngines, ...nodes.map(b => b.seq.engine)],
        proposal.family.ctx !== ctx ? proposal.family.request : undefined);
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
    // Every geometry of a free gap shares the gap's sampling effort.
    const families = familiesFor(ctx, i), share = localScale / families.length;
    try {
      for (const parent of beam) {
        for (const family of families) {
          const interval = searchInterval(family.ctx, parent.seq.engine, i, {
            samples: Math.max(12, Math.floor((options.samples ?? 80) * share)),
            guidanceSamples: Math.floor((options.guidanceSamples ?? 0) * share),
            responseSamples: Math.floor((options.responseSamples ?? 0) * share),
            ...(families.length > 1 ? {initialRecoverySamples: Math.floor((options.initialRecoverySamples ?? 0) / families.length)} : {}),
          }, protectedEngines);
          Engine.retainOnly(protectedEngines);
          if (!interval?.best) continue;
          const candidates = i === contacts.length - 1 ? interval.candidates : distinctCandidates(options, interval.candidates, 8);
          for (const candidate of candidates) offered.push({parent, interval, candidate, family,
            localCost: parent.localCost + candidate.localCost,
            rank: i === contacts.length - 1 ? candidate.terminalLoss : parent.localCost + valueRank(options, candidate)});
        }
        searched++;
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
        realizeFamilies(ctx, deepest.rows);
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
    // Where the gap was free, near-best alternatives are kept now and then
    // (never for the final, whole-ride choice).
    if (families.length > 1 && i < contacts.length - 1) for (const offer of offered) offer.rank -= CHOICE_SCALE * gumbel(ctx.random);
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
  realizeFamilies(ctx, seq.rows);
}

/** Materialize a selected, already verified physical prefix. */
function commitInterval(ctx: ArcCompileContext, seq: ArcSequence, i: number, interval: IntervalResult, best: any,
  protectedEngines: Engine[] = [], realized?: ConstructionRequest) {
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
    failures, spent: getPhysicsFrameCount(), ...(realized ? {realized} : {})});
}
