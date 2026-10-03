/** Immutable timeline and shared mutable accounting of one arc compilation.
 * Every search stage receives this context explicitly instead of closing
 * over compile-local variables. */
import { detect } from '../../lib/detector.ts';
import { sliceTimeline, effectiveAxes, resolveStartState, buildDriftReport, sampleGapTargets } from '../core/substrate.ts';
import { authoredSpeedToPx, PREROLL, CALIB, type Spec, type TrackLine } from '../types.ts';
import { makeRng } from '../../lib/rng.ts';
import { scheduleNativeContacts } from './native_motion_schedule.ts';
import { ArcControlMemory, arcConstructionMemoryKey } from './arc_memory.ts';
import { createArcLineage } from './arc_lineage.ts';
import type { ArcMotionOptions } from './arc_options.ts';

const rad = (x: number) => x * Math.PI / 180;

export type BudgetInterruption = {
  phase: 'local' | 'planning' | 'continuation' | 'revision';
  index: number; frame: number; viable: number; retained: boolean;
};

/** Counters and telemetry accumulated by every stage of one compilation. */
export function createSearchWork() {
  return {
    samples: 0,
    viableCandidates: 0,
    memoHits: 0,
    memoRejectedHits: 0,
    backtracks: 0,
    searchBudgetExhausted: false,
    observedConstructionRate: 0,
    refinementStats: null as any,
    terminalSelectionStats: null as any,
    qualityRetries: new Map<number, number>(),
    budgetInterruptions: [] as BudgetInterruption[],
    planningDecisions: [] as any[],
    lookaheadStats: {probes: 0, changedChoices: 0, failedProbes: 0, physicsFrames: 0, continuationNodes: 0, maxDepth: 0},
    transitionRevisionWork: [] as Array<{index: number; error: number; proposals: number; viable: number; accepted: boolean;
      before: number; after: number; physicsFrames: number}>,
    fragmentStats: {intervals: 0, probes: 0, observationFrames: 0, replayFrames: 0},
    coupledIntervalWork: [] as Array<{index: number; proposals: number; viable: number; accepted: number; physicsFrames: number;
      before: number; after: number}>,
    observedReceiverWork: {attempts: 0, viable: 0, physicsFrames: 0, failures: {} as Record<string, number>},
    opposingEntryWork: {attempts: 0, viable: 0, physicsFrames: 0, failures: {} as Record<string, number>},
    // compactProfile stays as a zero entry so stored construction evidence keeps one schema.
    initialProposalWork: Object.fromEntries(['center', 'learned', 'memory', 'response', 'generic', 'compactFold', 'compactProfile']
      .map(k => [k, {attempts: 0, viable: 0, physicsFrames: 0}])),
    initializationRecovery: [] as Array<{index: number; frame: number; proposals: number; viable: number; physicalFrames: number}>,
    // No production stage records construction improvement any more; the V6
    // construction evidence still stores this (empty) list.
    constructionImprovement: [] as Array<{index: number; frame: number; proposals: number; viable: number; physicalFrames: number;
      before: number | null; after: number | null}>,
  };
}

export type ArcSearchWork = ReturnType<typeof createSearchWork>;

/** Timeline, start state, engine lineage, memory and accounting for a
 * normalized spec. Draws the per-gap target jitter from the seeded stream. */
export function createArcCompileContext(spec: Spec, seed: number, options: ArcMotionOptions) {
  const budget = options.budget, duration = Math.round(spec.duration * 40), end = duration + 20;
  const frames = spec.contacts.map(c => Math.round(c.t * 40));
  const impactTargets = spec.contacts.map((c, i) => ({frame: frames[i], impact: c.impact}));
  const gaps = sliceTimeline(frames, duration);
  for (const g of gaps) {
    g.targets = effectiveAxes(g, spec);
    if (g.endsWithContact && spec.contacts[g.index].impact !== undefined) g.targets.impact = spec.contacts[g.index].impact;
  }
  const rng = makeRng(seed);
  const preparation = options.impactPreparationFrames ?? 0;
  const planned = scheduleNativeContacts(gaps.map(g => ({...g,
    startFrame: g.startFrame ? g.startFrame - preparation : 0,
    endFrame: g.endsWithContact ? g.endFrame - preparation : g.endFrame,
    targets: {...g.targets, ...sampleGapTargets(g.targets, spec.jitter ?? CALIB.SIGMA, rng)}})));
  const fixed = spec.start || (spec.preroll ?? PREROLL.DEFAULT_S) <= 0 ? resolveStartState(spec) : null;
  const speed = authoredSpeedToPx(gaps[0].targets.speed ?? .55);
  const pitch = rad(8.59436692696);
  const start = fixed ?? {position: {x: 0, y: 0}, velocity: {x: speed * Math.cos(pitch), y: speed * Math.sin(pitch)}};

  const hasFragments = Object.values(options.constructionRequests ?? {}).some(r => r.construction === 'scattered');
  const lineage = createArcLineage(start, !!options.reuseEvaluations || hasFragments, hasFragments);
  const contacts = [{frame: 1, gap: -1}, ...planned.filter(g => g.endsWithContact).map(g => ({frame: g.endFrame, gap: g.index}))];

  const controlMemory = new ArcControlMemory(), constructionMemories = new Map<string, ArcControlMemory>();
  /** Learned responses stay local to their physical constructor and guide permission. */
  const memoryFor = (index: number) => {
    if (options.memoryScope !== 'construction') return controlMemory;
    const key = arcConstructionMemoryKey({...options, ...options.sectionStyles?.[index]});
    let memory = constructionMemories.get(key);
    if (!memory) {
      memory = new ArcControlMemory();
      for (const example of options.constructionExamples?.[key] ?? []) memory.rememberControl(example);
      constructionMemories.set(key, memory);
    }
    return memory;
  };

  /** Arrival features followed by the duration, impact and span targets of the next `count` supports. */
  const futureFeatures = (arrival: number[], i: number, count = 2) => {
    const features = [...arrival];
    for (let k = 1; k <= count; k++) {
      const contact = contacts[i + k], target = contact ? planned.find(g => g.startFrame === contact.frame)?.targets : undefined;
      features.push(contact ? ((contacts[i + k + 1]?.frame ?? end + 1) - contact.frame) / 40 : 0,
        contact ? (gaps[contact.gap]?.targets.impact ?? -1) : -1, target?.air ?? -1, target?.speed ?? -1, target?.amplitude ?? -1);
    }
    return features;
  };

  const reportFor = (trajectory: any, geometry: TrackLine[]) => buildDriftReport(detect(trajectory), spec, gaps, frames, duration, [],
    gaps.map(g => ({lines: geometry.filter(l => Math.floor((l.id - 1000) / 10000) === g.index + 1)})) as any, gaps.map(g => g.targets));

  return {options, budget, spec, duration, end, frames, impactTargets, gaps, planned, start, contacts, hasFragments,
    lineage, work: createSearchWork(), memoryFor, futureFeatures, reportFor};
}

export type ArcCompileContext = ReturnType<typeof createArcCompileContext>;
