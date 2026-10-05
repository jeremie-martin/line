/** Improve complete physical arc tracks; every offered continuation is simulated. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, getRiderMetered, extractRawTrajectory, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import type { DriftReport, TrackLine } from '../types.ts';
import { createArcEngine } from './arc_engine.ts';
import type { ArcMotionOptions, IntervalOverrides } from './arc_options.ts';
import type { IntervalResult } from './arc_interval.ts';

export type ArcRefinementInput = {
  engine: Engine; lines: TrackLine[]; rows: any[]; alternatives?: any[][];
  contacts: Array<{frame: number; gap: number}>; end: number;
  start: {position: {x: number; y: number}; velocity: {x: number; y: number}};
  budget: number; options: ArcMotionOptions;
  search: (engine: Engine, index: number, overrides: IntervalOverrides, protectedEngines: Engine[]) => IntervalResult | null;
  report: (raw: any, lines: TrackLine[]) => DriftReport;
  objective: (raw:any, report:DriftReport, engine:Engine) => {loss:number;regrets:number[]};
  validate?: (engine:Engine,lines:TrackLine[],raw:any,rows:any[])=>boolean;
  engines?: {create:(lines:TrackLine[])=>Engine;add:(base:Engine,lines:TrackLine[])=>Engine;detach:(base:Engine)=>Engine};
};

type EngineOperations = NonNullable<ArcRefinementInput['engines']>;
type Objective = {loss: number; regrets: number[]};
/** The complete track currently kept by refinement, with its measurements. */
type Incumbent = {engine: Engine; lines: TrackLine[]; rows: any[]; report: DriftReport; objective: Objective; loss: number};

const sectionOf = (line: TrackLine) => Math.floor((line.id - 1000) / 10000);

/** Repeatedly revises the support with the highest remaining regret: a local
 * search proposes alternatives for it, each is completed into a whole track
 * and replayed, and a strictly better complete track replaces the
 * incumbent. Stops when attempts, regret or the allowance run out. */
export function refineArcTrack(input: ArcRefinementInput) {
  const {contacts, end, start, options, search, report} = input;
  const operations: EngineOperations = input.engines ?? {create: (lines: TrackLine[]) => createArcEngine(start, lines),
    add: (base: Engine, lines: TrackLine[]) => base.addLine(lines), detach: (base: Engine) => base.detach()};
  const began = getPhysicsFrameCount(), ceiling = input.budget - 2 * (end + 1);
  const lines = input.lines.slice(), rows = input.rows.slice();
  const initialRaw = extractRawTrajectory(input.engine, end);
  const initialReport = report(initialRaw, lines);
  const initialObjective = input.objective(initialRaw, initialReport, input.engine);
  const incumbent: Incumbent = {engine: input.engine, lines, rows, report: initialReport, objective: initialObjective,
    loss: initialObjective.loss};
  // Body-only strikes may have no historical sled-landing measurement. The
  // shared account checks their authored targets independently.
  const observationContract = (r: DriftReport) => JSON.stringify(r.gaps.map(g => Object.entries(g.axes)
    .filter(([axis]) => !options.impactContract || axis !== 'impact').map(([axis, value]) => [axis, value?.target])));
  const expectedObservations = observationContract(incumbent.report);
  const initialLoss = incumbent.loss, tries = contacts.map(() => 0), records: any[] = [];
  const counts: Record<string, number> = {proposals: 0, complete: 0, accepted: 0, prefixChanged: 0, failedContinuation: 0,
    failedConstruction: 0, duplicateFinalCandidates: 0};
  const finalCandidates = new Set<string>();
  const result = () => ({lines: incumbent.lines, rows: incumbent.rows, engine: incumbent.engine,
    stats: {initialLoss, finalLoss: incumbent.loss, frames: getPhysicsFrameCount() - began, counts, records}});
  if (!Number.isFinite(incumbent.loss)) return result();
  try {
    for (let attempt = 0; attempt < (options.refineAttempts ?? 32); attempt++) {
      const width = options.refineWidth ?? 4, samples = options.refineSamples ?? 48;
      const targets = refinementTargets(input, incumbent, tries, samples, width, ceiling);
      if (!targets.length) break;
      const selected = targets[0], i = selected.index, frame = contacts[i].frame;
      const horizon = (contacts[i + 1]?.frame ?? end + 1) - 1;
      tries[i]++;
      const spent = getPhysicsFrameCount(), lossBefore = incumbent.loss;
      const sourceLines = incumbent.lines, sourceRows = incumbent.rows;
      const prefix = sourceLines.filter(l => sectionOf(l) < i);
      const base = operations.create(prefix);
      const before = JSON.stringify(getRiderMetered(base, frame - 1).ballisticState());
      const boundary = getRiderMetered(incumbent.engine, horizon);
      const reference = {position: boundary.position, velocity: boundary.velocity, state: boundary.ballisticState()};
      const searchResult = search(base, i, {warmStart: sourceRows[i].control, localOnly: true,
        samples, guidanceSamples: options.refineGuidanceSamples ?? 24,
        arrivalWeight: 0, headingWeight: 0, arrivalReference: i + 1 === contacts.length ? undefined : reference,
        completeGuidanceBudget: true}, [incumbent.engine]);
      if (!searchResult) {
        Engine.retainOnly([incumbent.engine]);
        continue;
      }
      const attemptState = {i, base, prefix, sourceRows, searchResult};
      const candidates = searchResult.candidates.slice().sort((a: any, b: any) => a.cost - b.cost);
      const offered = new Set<string>();
      let evaluated = 0;
      for (const candidate of candidates) {
        const key = JSON.stringify(candidate.c);
        if (offered.has(key) || key === JSON.stringify(sourceRows[i].control)) continue;
        offered.add(key);
        // A fixed final-support control has no stochastic continuation. Avoid
        // judging the identical complete geometry repeatedly for one incumbent.
        // Earlier supports remain eligible: rebuilding their suffix can differ.
        if (i === contacts.length - 1 && finalCandidates.has(key)) {
          counts.duplicateFinalCandidates++;
          continue;
        }
        if (evaluated >= width || getPhysicsFrameCount() + 2 * (end + 1) > ceiling) break;
        if (i === contacts.length - 1) finalCandidates.add(key);
        evaluated++;
        counts.proposals++;
        const revision = completeRevision(input, operations, attemptState, candidate, incumbent.engine);
        if (!revision) {
          counts.failedContinuation++;
          Engine.retainOnly([incumbent.engine, base]);
          continue;
        }
        const {child, proposed, proposedRows} = revision;
        if (JSON.stringify(getRiderMetered(child, frame - 1).ballisticState()) !== before) {
          counts.prefixChanged++;
          Engine.retainOnly([incumbent.engine, base]);
          continue;
        }
        const candidateRaw = extractRawTrajectory(child, end), candidateReport = report(candidateRaw, proposed);
        if (input.validate && !input.validate(child, proposed, candidateRaw, proposedRows)) {
          counts.failedConstruction++;
          Engine.retainOnly([incumbent.engine, base]);
          continue;
        }
        const candidateObjective = input.objective(candidateRaw, candidateReport, child);
        const candidateLoss = observationContract(candidateReport) === expectedObservations ? candidateObjective.loss : Infinity;
        if (Number.isFinite(candidateLoss)) counts.complete++;
        if (candidateLoss + 1e-12 < incumbent.loss) {
          Object.assign(incumbent, {engine: operations.detach(child), lines: proposed, rows: proposedRows,
            report: candidateReport, objective: candidateObjective, loss: candidateLoss});
          counts.accepted++;
          finalCandidates.clear();
        }
        Engine.retainOnly([incumbent.engine, base]);
      }
      records.push({attempt, anchor: i, selectedRegret: selected.error, estimate: selected.estimate,
        frames: getPhysicsFrameCount() - spent, evaluated, lossBefore, lossAfter: incumbent.loss});
      Engine.retainOnly([incumbent.engine]);
    }
  } catch (error) {
    if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
  }
  Engine.retainOnly([incumbent.engine]);
  return result();
}

/** Supports worth revising, highest regret per previous try first: those in
 * the refinement window with positive regret whose estimated cost fits. */
function refinementTargets(input: ArcRefinementInput, incumbent: Incumbent, tries: number[], samples: number, width: number, ceiling: number) {
  const {contacts, end, options} = input;
  return contacts.map((contact, i) => {
    const error = incumbent.objective.regrets[i];
    const span = (contacts[i + 1]?.frame ?? end + 1) - contact.frame;
    const estimate = contact.frame + span * (samples + (options.refineGuidanceSamples ?? 24) + 8) + (end - contact.frame + 1) * width;
    const priority = error / (1 + tries[i]);
    return {index: i, error, estimate, priority};
  }).filter(x => x.index >= Math.max(0, options.refineTailSections === undefined ? 0 : contacts.length - options.refineTailSections) &&
    x.error > 0 && getPhysicsFrameCount() + x.estimate <= ceiling)
    .sort((a, b) => b.priority - a.priority || a.index - b.index);
}

type AttemptState = {i: number; base: Engine; prefix: TrackLine[]; sourceRows: any[]; searchResult: any};

/** The complete track obtained by replacing support i with `candidate`: each
 * later support is rebuilt from its recorded (or planned) control. Returns
 * null when a rebuilt support has no valid arc. */
function completeRevision(input: ArcRefinementInput, operations: EngineOperations, attempt: AttemptState, candidate: any, incumbent: Engine) {
  const {contacts, options, search} = input;
  const {i, base, prefix, sourceRows, searchResult} = attempt;
  let child = operations.add(base, candidate.lines), proposed = [...prefix, ...candidate.lines];
  const proposedRows = sourceRows.slice();
  proposedRows[i] = {...sourceRows[i], control: candidate.c, cost: candidate.cost,
    incoming: searchResult.incoming, span: searchResult.span, features: searchResult.inputFeatures,
    ...candidate.meta, lookahead: null, spent: getPhysicsFrameCount()};
  for (let j = i + 1; j < contacts.length; j++) {
    const planned = j === i + 1 ? input.alternatives?.[i]?.find(a => JSON.stringify(a.c) === JSON.stringify(candidate.c))?.futureControl : undefined;
    const next = search(child, j, {samples: 0, localOnly: true, guidance: undefined, warmStart: planned ?? sourceRows[j].control,
      ...(!planned && options.constructionRequests ? {warmIncoming: sourceRows[j].incoming} : {})}, [incumbent, base]);
    if (!next?.best) return null;
    proposed.push(...next.best.lines);
    child = operations.detach(next.best.child);
    proposedRows[j] = {...sourceRows[j], control: next.best.c, cost: next.best.cost,
      incoming: next.incoming, span: next.span, features: next.inputFeatures,
      achieved: next.best.achieved, impact: next.best.actualImpact,
      release: next.best.release, lines: next.best.lines.length, railGuides: next.best.railGuides,
      failures: next.failures, lookahead: null, spent: getPhysicsFrameCount()};
    Engine.retainOnly([incumbent, base, child]);
  }
  return {child, proposed, proposedRows};
}
