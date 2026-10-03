/** Measured arc search: one connected physical support curve per contact interval.
 * The curve's entry, impact-window turn, later slope and release length are
 * corrected using actual engine measurements. No point controls or scenery. */
import { disposeAllWasmEnginesForStudy as disposeSearch } from '../../lib/native_motion/engine.ts';
import { resetFrameCount, setPhysicsFrameLimit, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import { validateSpec } from '../core/substrate.ts';
import { validProfileControls } from './motion_profiles.ts';
import { arcMainSteps, type ArcMotionControl, type ArcGeometryStyle, type ArcSectionStyle } from './arc_geometry.ts';
export { motionArc, type ArcMotionControl } from './arc_geometry.ts';
import type { ArcControlExample } from './arc_memory.ts';
import { normalizeCompilerTimeline } from './compiler_input.ts';
import { createArcCompileContext } from './arc_compile_context.ts';
import { startSequence, runIntervalSequence } from './arc_sequence.ts';
import { transitionRevisionSettings } from './arc_neighbor_revision.ts';
import { refineCommittedTrack } from './arc_complete_refinement.ts';
import { finalizeArcTrack, disposeJudge } from './arc_finalize.ts';
import { arcAttemptTelemetry } from './arc_attempts.ts';
import type { Spec } from '../types.ts';
import type { ConstructionRequest } from './repertoire_policy.ts';
import type { MotionSearchOptions } from './motion_objective.ts';
import { CONTACT_IMPACT_CONTRACT } from '../../lib/contact_impact.ts';
import { validateImpactSearchOptions, type ImpactSearchOptions } from './impact_search.ts';
/** Per-section construction style: the geometry fields constructionStyle() emits. */
export type SectionStyle=Omit<ArcSectionStyle,'subdivisions'|'alignedFoldEntry'>;
export type ArcMotionOptions= Omit<ArcGeometryStyle,'contour'|'alignedFoldEntry'> & {
  budget:number;
  /** Explicit experimental ruler; absent means the qualified landing contract. */
  impactContract?:typeof CONTACT_IMPACT_CONTRACT.id;
  impactSearch?:ImpactSearchOptions;
  /** Prepare physical contact before its authored response time. Musical
   * targets and construction requests remain at their original timestamps. */
  impactPreparationFrames?:number;
  opposingEntryProposals?:number;
  /** Explicit motion research/production mode; absent in frozen ordinary/V5 defaults. */
  motionQuality?:MotionSearchOptions;
  /** Explicit repertoire search options. Production defaults are unchanged. */
  initialRecoverySamples?:number;
  /** Cover contact geometry before a first fully realized candidate exists. */
  constructionProposals?:boolean;
  constructionRecovery?:boolean;
  observedReceiver?:boolean;
  compactFoldProposals?:boolean;
  /** Native joint adjustment of neighboring supports, within the shared budget. */
  coupledIntervalSamples?:number;
  constructionAwareArrival?:boolean;
  /** Research composition by support index (startup is zero). Applied to every
   * proposal, lookahead and rebuilt continuation. Omitted sections inherit the
   * global settings; this changes construction, never the musical specification. */
  sectionStyles?:Record<number,SectionStyle>;
  /** Physical construction requirements participate in every proposal and continuation. */
  constructionRequests?:Record<number,ConstructionRequest>;
  constructionExamples?:Readonly<Record<string,readonly ArcControlExample[]>>;
  constructionPolicies?:Readonly<Record<string,any>>;
  /** Preserve distinct expressive geometry in learned and memory proposals. */
  controlDiversity?:'inherited'|'geometry';
  wholeTrackRefinement?:boolean;
  /** Rank already simulated complete alternatives by the full authored loss. */
  terminalSelection?:boolean;
  /** Keep the inherited five-frame turn representable during refinement. */
  preserveTurnTiming?:boolean;
  /** Measure the final objective at the authored end; still validate the grace. */
  authoredHorizon?:boolean;
  /** Retain useful search pressure beyond the public amplitude cap. */
  amplitudeOverflow?:'raw'|'log';
  /** Preserve the proposal mix within the slots a local probe can evaluate. */
  budgetedProposals?:boolean;
  /** Give unusable response-round remainders back to coordinate exploration. */
  completeGuidanceBudget?:boolean;
  /** Keep learned responses local to their physical geometry and guide permission. */
  memoryScope?:'construction';
  memorySamples?:number;
  memoryResponseSamples?:number;
  /** Replace the preceding truncated span once its contact boundary is measured. */
  completeBoundary?:boolean;
  samples?:number;
  arrivalWeight?:number;
  channel?:number;
  radius?:number;
  arrivalMode?:string;
  bidirectional?:boolean;
  impactWeight?:number;
  amplitudeWeight?:number;
  qualityRetries?:number;
  /** Revisit the preceding choice using a stronger measured current interval. */
  transitionRevision?:{errorThreshold?:number;width?:number;samples?:number;guidanceSamples?:number;responseSamples?:number};
  headingWeight?:number;
  guidance?:'span'|'clearance'|'full';
  guidanceSamples?:number;
  lookaheadWidth?:number;
  lookaheadSamples?:number;
  collectTrajectoryLoss?:boolean;
  warmStart?:ArcMotionControl;
  warmIncoming?:number;
  pruneGuidance?:boolean;
  lookaheadObjective?:'local'|'terminal';
  reserveFactor?:number;
  reuseContinuations?:boolean;
  guidanceJoint?:boolean;
  expressive?:boolean;
  localOnly?:boolean;
  arrivalReference?:any;
  refineAttempts?:number;
  refineSamples?:number;
  refineGuidanceSamples?:number;
  refineWidth?:number;
  refineMode?:'translate'|'reflow';
  adaptivePlanning?:boolean;
  strictHorizon?:boolean;
  directControls?:ArcMotionControl[];
  /** Spend remaining work on the ending without reconstructing a long suffix. */
  refineTailSections?:number;
  responseSamples?:number;
  cachePrefixReads?:boolean;
  /** Reuse completed evaluations only within the same physical search prefix. */
  memoCandidates?:boolean;
  /** Reuse complete measurements across searches with identical geometry prefixes. */
  reuseEvaluations?:boolean;
  controlPolicy?:any;
  policySamples?:number;
  /** Reduce local work if observed construction cost outgrows remaining capacity. */
  budgetAdaptiveLocal?:boolean;
  futureValueModel?:any;
  /** Research: use the learned value at the unresolved continuation boundary. */
  continuationValueWeight?:number;
  valueWeight?:number;
  /** Blend learned arrival value into local geometry optimization as well as ranking. */
  valueGuidanceWeight?:number};

export function compileArcMotion(spec:Spec,seed:number,options:ArcMotionOptions){
  const result=compileArcMotionOnce(spec,seed,options);
  return {...result,...arcAttemptTelemetry(result,options),budget:options.budget};
}

/** One complete search: validate, construct interval by interval, refine
 * the complete track when configured, then replay and measure it. Two cold
 * replays are reserved out of the allowance for the final stage. */
function compileArcMotionOnce(spec: Spec, seed: number, options: ArcMotionOptions) {
  validateArcOptions(seed, options);
  spec = normalizeCompilerTimeline(spec);
  validateSpec(spec);
  resetFrameCount();
  const budget = options.budget, duration = Math.round(spec.duration * 40), end = duration + 20;
  if (duration < 1) throw new Error('arc duration must cover at least one frame');
  if (budget <= 2 * (end + 1)) throw new Error('arc budget must cover two complete replays and construction work');
  try {
    const ctx = createArcCompileContext(spec, seed, options);
    const seq = startSequence(ctx);
    setPhysicsFrameLimit(budget - 2 * (end + 1));
    validateSectionStyles(options, ctx.contacts.length);
    try {
      runIntervalSequence(ctx, seq);
      if (!seq.failure && (options.refineAttempts ?? 0) > 0 && seq.rows.length === ctx.contacts.length) refineCommittedTrack(ctx, seq);
    } catch (error) {
      if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
      ctx.work.searchBudgetExhausted = true;
      seq.failure = {reason: 'budget'};
    }
    return finalizeArcTrack(ctx, seq);
  } finally {
    disposeSearch();
    disposeJudge();
    setPhysicsFrameLimit(null);
  }
}

function validateArcOptions(seed: number, options: ArcMotionOptions) {
  if (options.refineTailSections !== undefined && (!Number.isSafeInteger(options.refineTailSections) || options.refineTailSections < 1))
    throw new Error('invalid refinement tail window');
  transitionRevisionSettings(options);
  if (options.initialRecoverySamples !== undefined && (!Number.isSafeInteger(options.initialRecoverySamples) ||
    options.initialRecoverySamples < 0 || options.initialRecoverySamples > 320)) throw new Error('invalid initialization recovery allowance');
  if (options.coupledIntervalSamples !== undefined && (!Number.isSafeInteger(options.coupledIntervalSamples) ||
    options.coupledIntervalSamples < 0 || options.coupledIntervalSamples > 512)) throw new Error('invalid coupled interval allowance');
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(options.budget) || options.budget <= 0) throw new Error('invalid arc compiler input');
  if (!validProfileControls(options)) throw new Error('invalid profile controls');
  if (options.impactContract !== undefined && options.impactContract !== CONTACT_IMPACT_CONTRACT.id) throw new Error('unknown impact contract');
  validateImpactSearchOptions(options.impactSearch);
  if (options.impactSearch && !options.impactContract) throw new Error('impact search options require their measurement contract');
  if (options.opposingEntryProposals !== undefined && (!options.impactContract || !Number.isSafeInteger(options.opposingEntryProposals) ||
    options.opposingEntryProposals < 0 || options.opposingEntryProposals > 64)) throw new Error('invalid opposing-entry allowance');
  if (options.impactPreparationFrames !== undefined && (!options.impactContract || !Number.isSafeInteger(options.impactPreparationFrames) ||
    options.impactPreparationFrames < 0 || options.impactPreparationFrames > 2)) throw new Error('invalid impact preparation');
  arcMainSteps(1, undefined, options.faces);
}

const SECTION_STYLE_KEYS = ['guides', 'faces', 'profile', 'profileStrength', 'profileStart', 'rippleCycles', 'foldAngle', 'railLayout', 'independentGuide'];

/** Section styles must name existing supports and use only the fields that
 * constructionStyle() produces, with valid values. */
function validateSectionStyles(options: ArcMotionOptions, supports: number) {
  if (!options.sectionStyles) return;
  if (typeof options.sectionStyles !== 'object' || Array.isArray(options.sectionStyles)) throw new Error('invalid section styles');
  for (const [key, style] of Object.entries(options.sectionStyles)) {
    const index = Number(key);
    if (!Number.isSafeInteger(index) || String(index) !== key || index < 0 || index >= supports ||
      !style || typeof style !== 'object' || Array.isArray(style) || Object.keys(style).some(k => !SECTION_STYLE_KEYS.includes(k)) ||
      (style.railLayout !== undefined && !['paired', 'transfer'].includes(style.railLayout)) ||
      (style.independentGuide !== undefined && typeof style.independentGuide !== 'boolean') ||
      (style.guides !== undefined && typeof style.guides !== 'boolean') ||
      !validProfileControls({...options, ...style}))
      throw new Error('invalid section style');
    arcMainSteps(1, undefined, style.faces ?? options.faces);
  }
}
