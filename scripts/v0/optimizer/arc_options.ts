/** Configuration of the arc compiler.
 *
 * ArcMotionOptions is what a compile is called with. In production every
 * field comes from one of four places:
 * - connectedArcOptions(): the base allocation, scaled by ride length and budget;
 * - repertoireSearchOptions(): intentional repertoire plans;
 * - IMPACT_SEARCH_PROFILE: the impact search preferences;
 * - constructionStyle(): the geometry style of each section.
 *
 * IntervalOverrides are set only inside the compiler, per interval search
 * (allowance scaling, research probes and tests). IntervalOptions is what one interval search sees. */
import type { ArcMotionControl, ArcGeometryStyle, ArcSectionStyle } from './arc_geometry.ts';
import type { ArcControlExample } from './arc_memory.ts';
import type { ConstructionRequest } from './repertoire_policy.ts';
import type { MotionSearchOptions } from './motion_objective.ts';
import { validProfileControls } from './motion_profiles.ts';
import { arcMainSteps } from './arc_geometry.ts';
import { validateImpactSearchOptions, type ImpactSearchOptions } from './impact_search.ts';

/** Geometry style of one section: the fields constructionStyle() produces
 * (guides, faces, profile, profileStrength, profileStart, rippleCycles,
 * foldAngle, railLayout, independentGuide). */
export type SectionStyle = Omit<ArcSectionStyle, 'subdivisions' | 'alignedFoldEntry'>;

/** Compile configuration. Section style fields at this level are defaults
 * for sections without a style; production sets them per section. */
export type ArcMotionOptions = Omit<ArcGeometryStyle, 'alignedFoldEntry'> & {
  // --- connectedArcOptions(): base allocation ---------------------------------
  /** Total physics-frame allowance, including two cold replays. */
  budget: number;
  /** Proposal and coordinate-search evaluations per interval. */
  samples?: number;
  /** Guide clearance and smoothing radius of the constructed curves. */
  channel?: number;
  radius?: number;
  /** Objective weights. */
  impactWeight?: number;
  amplitudeWeight?: number;
  /** Arrival priors toward the next catch: the speed prior (with heading too
   * for a passive arrival, see IntervalOptions) and the heading-band prior. */
  arrivalWeight?: number;
  headingWeight?: number;
  /** Clearance, shape and core controls searched jointly after the core
   * curve, and their allowance; absent when the allowance has none. */
  guidance?: 'clearance';
  guidanceSamples?: number;
  /** Finite-difference response evaluations within the guidance allowance. */
  responseSamples?: number;
  /** Replace the preceding truncated span once its contact boundary is measured. */
  completeBoundary?: boolean;
  /** Remembered controls, remembered responses and learned proposals per interval. */
  memorySamples?: number;
  memoryResponseSamples?: number;
  policySamples?: number;
  /** Learned future value of an arrival, used to rank candidates and guide search. */
  futureValueModel?: any;
  valueWeight?: number;

  // --- repertoireSearchOptions(): intentional repertoire plans --------------------
  /** Generic samples to keep searching an interval with no valid curve yet. */
  initialRecoverySamples?: number;
  /** Geometry style by support index (startup is zero), applied to every
   * proposal and rebuilt continuation of that section. */
  sectionStyles?: Record<number, SectionStyle>;
  /** Physical construction requirements by support index. */
  constructionRequests?: Record<number, ConstructionRequest>;
  /** Motion-quality residuals and the calm-impact weighting. */
  motionQuality?: MotionSearchOptions;
  /** Learned construction memory and policies, by construction memory key. */
  constructionExamples?: Readonly<Record<string, readonly ArcControlExample[]>>;
  constructionPolicies?: Readonly<Record<string, any>>;

  // --- IMPACT_SEARCH_PROFILE ------------------------------------------------------
  impactSearch?: ImpactSearchOptions;
  /** Prepare physical contact before its authored response time. Musical
   * targets and construction requests remain at their original timestamps. */
  impactPreparationFrames?: number;
  /** Proposals offering the same curve from the opposite contact side. */
  opposingEntryProposals?: number;
};

/** Set only by the compiler for one interval search. */
export type IntervalOverrides = Partial<Pick<ArcMotionOptions,
  'samples' | 'guidanceSamples' | 'responseSamples' | 'initialRecoverySamples' | 'arrivalWeight' | 'headingWeight' | 'guidance'>> & {
  /** A control evaluated before the ordinary proposals. */
  warmStart?: ArcMotionControl;
  /** A guided plain arc inside a strong chain steers after the hit: its normalized controls hold the catch's heading
   * and exit below it (arc_motion_control.ts). Set per interval (arc_interval_state.ts). */
  steering?: boolean;
  /** Measure exactly these controls and nothing else. */
  directControls?: ArcMotionControl[];
};

/** Options of one interval search: configuration, overrides and section
 * style, plus what resolveIntervalOptions derives for that section: the
 * learned policy, and whether the next catch is prepared passively (arrival
 * heading as well as speed). */
export type IntervalOptions = ArcMotionOptions & IntervalOverrides & {controlPolicy?: any; passiveArrival?: boolean};

/** How an interval option relates to a memoized evaluation, i.e. the
 * measurement of one control from one physical prefix:
 * - 'key', 'keyPresence', 'keySection': part of the memo context (the value,
 *   its presence, or its entry at the interval index);
 * - 'fixed': can change a measurement but is constant within one compile, and
 *   memo contexts never outlive a compile;
 * - 'search': shapes which controls are measured, never a measurement.
 * Every option must be classified. Key entries serialize in this order. */
type EvaluationRole = 'key' | 'keyPresence' | 'keySection' | 'fixed' | 'search';
export const EVALUATION_IDENTITY = {
  channel: 'key', radius: 'key', faces: 'key', profile: 'key', profileStrength: 'key', profileStart: 'key',
  rippleCycles: 'key', foldAngle: 'key', guides: 'key', railLayout: 'key', independentGuide: 'key',
  amplitudeWeight: 'key', impactWeight: 'key', arrivalWeight: 'key', passiveArrival: 'key', headingWeight: 'key',
  completeBoundary: 'key',
  constructionRequests: 'keySection', motionQuality: 'key', impactSearch: 'key',
  futureValueModel: 'keyPresence',

  impactPreparationFrames: 'fixed', sectionStyles: 'fixed',

  budget: 'search', samples: 'search', guidance: 'search',
  guidanceSamples: 'search',
  responseSamples: 'search', memorySamples: 'search',
  memoryResponseSamples: 'search', policySamples: 'search', valueWeight: 'search',
  initialRecoverySamples: 'search',
  constructionExamples: 'search', constructionPolicies: 'search', opposingEntryProposals: 'search',
  warmStart: 'search', directControls: 'search', controlPolicy: 'search', steering: 'search',
} as const satisfies Record<keyof IntervalOptions, EvaluationRole>;

const MEMO_CONTEXT = (Object.entries(EVALUATION_IDENTITY) as Array<[keyof IntervalOptions, EvaluationRole]>)
  .filter(([, role]) => role === 'key' || role === 'keyPresence' || role === 'keySection');

/** The memo context of interval `i`: the interval index followed by every
 * memo-context option of EVALUATION_IDENTITY, in declaration order. */
export function evaluationContext(options: IntervalOptions, i: number) {
  return JSON.stringify([i, ...MEMO_CONTEXT.map(([field, role]) =>
    role === 'keyPresence' ? !!options[field] : role === 'keySection' ? (options[field] as any)?.[i] : options[field])]);
}

/** Rejects out-of-range allowances and inconsistent impact settings before any work. */
export function validateArcOptions(seed: number, options: ArcMotionOptions) {
  if (options.initialRecoverySamples !== undefined && (!Number.isSafeInteger(options.initialRecoverySamples) ||
    options.initialRecoverySamples < 0 || options.initialRecoverySamples > 320)) throw new Error('invalid initialization recovery allowance');
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(options.budget) || options.budget <= 0) throw new Error('invalid arc compiler input');
  if (!validProfileControls(options)) throw new Error('invalid profile controls');
  validateImpactSearchOptions(options.impactSearch);
  if (options.opposingEntryProposals !== undefined && (!Number.isSafeInteger(options.opposingEntryProposals) ||
    options.opposingEntryProposals < 0 || options.opposingEntryProposals > 64)) throw new Error('invalid opposing-entry allowance');
  if (options.impactPreparationFrames !== undefined && (!Number.isSafeInteger(options.impactPreparationFrames) ||
    options.impactPreparationFrames < 0 || options.impactPreparationFrames > 2)) throw new Error('invalid impact preparation');
  arcMainSteps(1, undefined, options.faces);
}

const SECTION_STYLE_KEYS = ['guides', 'faces', 'profile', 'profileStrength', 'profileStart', 'rippleCycles', 'foldAngle', 'railLayout', 'independentGuide'];

/** Section styles must name existing supports and use only the fields that
 * constructionStyle() produces, with valid values. */
export function validateSectionStyles(options: ArcMotionOptions, supports: number) {
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
