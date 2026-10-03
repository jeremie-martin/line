/** State of one support-interval search: the options resolved for that
 * interval, the physical boundary it starts from (read once, on the meter),
 * and the measured candidates that proposals and local search accumulate. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getRiderMetered, extractRawTrajectory, detect } from '../../lib/detector.ts';
import { measureGapAxes, measureAmplitudePeakPx } from '../core/measure.ts';
import { CALIB, impactToRawPx, type Gap, type TrackLine } from '../types.ts';
import type { ArcMotionControl } from './arc_geometry.ts';
import { arcPolicyArrival } from './arc_control_policy.ts';
import { arcConstructionMemoryKey, type ArcControlMemory } from './arc_memory.ts';
import { arcSpanLoss } from './arc_boundary.ts';
import { CONTACT_IMPACT_CONTRACT, contactImpactPrefix } from '../../lib/contact_impact.ts';
import { impactFrames } from './impact_search.ts';
import type { ArcMotionOptions } from './arc_motion.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const deg = (x: number) => x * 180 / Math.PI;

/** A control whose construction fell short, and by how much; seeds recovery. */
export type Near = {c: ArcMotionControl; deficit: number};
/** Contact fragments that replace a connected curve, with their guide line ids. */
export type Fragments = {lines: TrackLine[]; guideIds: number[]};

/** Compile options with the per-call overrides and the section style applied,
 * plus the learned policy and arrival preferences this interval implies. */
export function resolveIntervalOptions(ctx: ArcCompileContext, i: number, overrides: Partial<ArcMotionOptions>) {
  const compileOptions = ctx.options;
  const options: ArcMotionOptions = {...compileOptions, ...overrides, ...compileOptions.sectionStyles?.[i]};
  const constructionPolicy = i > 0 ? options.constructionPolicies?.[arcConstructionMemoryKey(options)] : undefined;
  if (constructionPolicy) options.controlPolicy = constructionPolicy;
  const nextRequest = options.constructionRequests?.[i + 1];
  if (options.constructionAwareArrival && nextRequest && (nextRequest.context?.quiet ?? 0) < .5 &&
    (nextRequest.guidance === 'forbidden' || nextRequest.railLayout === 'transfer')) {
    options.futureValueModel = undefined;
    if (options.arrivalMode !== 'kinetic') options.arrivalMode = 'passive';
    options.headingWeight = 0;
  }
  return options;
}

/** Reads the physical boundary of interval `i` from `engine` and derives its
 * targets, nominal support and turn. Returns null when the interval is too
 * short to hold a support. The calm-impact multiplier is applied to
 * `options.impactWeight` here. */
export function openInterval(ctx: ArcCompileContext, engine: Engine, i: number, options: ArcMotionOptions,
  controlMemory: ArcControlMemory, protectedEngines: Engine[]) {
  const {contacts, end, planned, gaps, duration, impactTargets} = ctx;
  const {frame, gap} = contacts[i], next = contacts[i + 1]?.frame ?? end + 1, horizon = next - 1;
  if (horizon <= frame + 2) return null;
  const outgoing = planned.find(g => g.startFrame === (i === 0 ? 0 : frame)) ??
    {index: gaps.length, startFrame: frame, endFrame: horizon, endsWithContact: false, targets: {}};
  const targets = outgoing.targets;
  const objectiveEnd = options.authoredHorizon ? Math.min(horizon, duration) : horizon;

  const beforeState = getRiderMetered(engine, frame - 1).ballisticState(), before = JSON.stringify(beforeState);
  const velocity = getRiderMetered(engine, frame).velocity;
  engine.prepareCollisionTrace(frame);
  getRiderMetered(engine, frame);
  const trace = engine.readCollisionTrace()[0];
  const points = ['PEG', 'TAIL', 'NOSE', 'STRING'].map(key => trace[key]);
  const prefixRaw = options.cachePrefixReads || options.impactContract ? extractRawTrajectory(engine, frame - 1) : null;
  const prefixImpactFrames = options.impactContract ? impactFrames(engine, prefixRaw!.frames, beforeState) : undefined;
  const impactPrefix = prefixImpactFrames ? contactImpactPrefix(prefixImpactFrames) : undefined;
  const localImpactTargets = options.impactContract
    ? impactTargets.filter(t => t.frame >= frame - CONTACT_IMPACT_CONTRACT.matchFrames && t.frame <= horizon + CONTACT_IMPACT_CONTRACT.matchFrames)
    : [];
  const currentImpactTarget = localImpactTargets.findIndex(t => t === impactTargets[gap]);
  const incoming = deg(Math.atan2(velocity.y, velocity.x)), pace = Math.hypot(velocity.x, velocity.y);

  // A final authored contact can have no scored tail. Its support still
  // needs room to realize the impact and survive the unscored grace.
  const span = objectiveEnd > frame || i === 0 ? objectiveEnd - (i === 0 ? 0 : frame) : horizon - frame;
  // The authored objective ends with the music; the final construction still
  // has the existing physical survival horizon. Do not clamp a requested
  // shape to two frames just because its last impact is near the song end.
  const constructionSpan = options.constructionRequests && i === contacts.length - 1 ? horizon - frame : span;
  const releaseFrames = options.impactSearch?.releaseFrames ?? 6;
  const support = clamp((1 - (targets.air ?? .5)) * (constructionSpan + 1), 3, Math.max(3, constructionSpan - releaseFrames));
  const impact = gap >= 0 ? gaps[gap].targets.impact : undefined;
  if (impact !== undefined && options.motionQuality?.calmImpactMultiplier !== undefined)
    options.impactWeight = (options.impactWeight ?? 2) * (1 + (options.motionQuality.calmImpactMultiplier - 1) * Math.max(0, 1 - impact / .2));
  const turn = impact === undefined ? 5 : deg(impactToRawPx(impact) / Math.max(3, pace));

  const memo = selectMemo(ctx, engine, i, options);
  const priorGap = i > 0 ? gaps[contacts[i].gap] : undefined;
  const priorAxes = options.completeBoundary && priorGap
    ? objectiveAxes(options, detect(prefixRaw ?? extractRawTrajectory(engine, frame - 1)), priorGap, frame - 1) : undefined;
  const priorLoss = priorAxes && priorGap ? arcSpanLoss(priorAxes, priorGap.targets, options.amplitudeWeight ?? 1) : 0;
  const controlContext = {...options, span: constructionSpan, releaseReserveFrames: options.impactSearch?.releaseFrames};

  // These describe the immutable incoming prefix already measured above.
  // Reusing them avoids a new physics read after committing the search budget.
  const arrivalFeatures = arcPolicyArrival(beforeState, velocity), inputFeatures = ctx.futureFeatures(arrivalFeatures, i - 1);
  // Only the learned proposal receives the longer authored window. Keep
  // response-memory and future-value inputs in their original units.
  const policyInputFeatures = options.controlPolicy?.featureCount === 67 ? ctx.futureFeatures(arrivalFeatures, i - 1, 4) : inputFeatures;
  const max = options.samples ?? 160, initial = options.localOnly ? 0 : Math.min(80, Math.ceil(max / 2));
  // Calm landing emphasis changes impact units between adjacent intervals.
  // Store those weights so response reuse can recover physical residuals
  // before applying this interval's weights.
  const responseAxisWeights = options.motionQuality?.calmImpactMultiplier !== undefined
    ? ['air', 'speed', 'amplitude'].map(key => key === 'amplitude' ? (options.amplitudeWeight ?? 1) : 1).concat(options.impactWeight ?? 2)
    : undefined;

  return {
    ctx, options, i, engine, protectedEngines, controlMemory,
    frame, gap, next, horizon, outgoing, targets, objectiveEnd,
    beforeState, before, velocity, trace, points,
    prefixRaw, prefixImpactFrames, impactPrefix, localImpactTargets, currentImpactTarget,
    incoming, pace, span, constructionSpan, releaseFrames, support, impact, turn,
    memo, priorGap, priorAxes, priorLoss, controlContext,
    inputFeatures, policyInputFeatures, max, initial, responseAxisWeights,
    /** Lowest optimization cost measured so far. */
    best: null as any,
    candidates: [] as any[],
    failures: {} as Record<string, number>,
    near: [] as Near[],
    center: undefined as ArcMotionControl | undefined,
  };
}

export type IntervalSearch = NonNullable<ReturnType<typeof openInterval>>;

/** The candidate memo for this search. Measurements are shared between
 * searches only from an identical physical prefix with identical evaluation
 * settings; at most 32 such contexts are kept, most recently used last. */
function selectMemo(ctx: ArcCompileContext, engine: Engine, i: number, options: ArcMotionOptions) {
  const {prefixes, prefixKey, memoContexts} = ctx.lineage;
  let memo = options.memoCandidates ? new Map<string, any>() : null;
  const prefix = prefixes.get(engine);
  if (options.reuseEvaluations && prefix && !options.arrivalReference &&
    (!options.futureValueModel || options.futureValueModel === ctx.options.futureValueModel)) {
    const context = prefixKey(prefix) + '|' + JSON.stringify([i, options.channel, options.radius, options.faces, options.profile,
      options.profileStrength, options.profileStart, options.rippleCycles, options.foldAngle, options.guides, options.railLayout,
      options.independentGuide, options.amplitudeWeight, options.impactWeight, options.arrivalWeight, options.arrivalMode,
      options.headingWeight, options.completeBoundary, options.authoredHorizon, options.amplitudeOverflow, options.terminalSelection,
      options.valueGuidanceWeight, options.constructionRequests?.[i], options.motionQuality, options.impactContract, options.impactSearch,
      !!options.futureValueModel, !!options.observedReceiver]);
    const saved = memoContexts.get(context);
    if (saved) {
      memo = saved;
      memoContexts.delete(context);
    } else memo = new Map();
    memoContexts.set(context, memo!);
    while (memoContexts.size > 32) memoContexts.delete(memoContexts.keys().next().value!);
  }
  return memo;
}

/** Span axes of `g` over [g.startFrame, rangeEnd]; with amplitude overflow a
 * capped amplitude keeps its raw (or logarithmic) excess as search pressure. */
export function objectiveAxes(options: ArcMotionOptions, det: ReturnType<typeof detect>, g: Gap, rangeEnd: number) {
  const axes = measureGapAxes(det, g, [], rangeEnd);
  if (options.amplitudeOverflow && g.targets.amplitude !== undefined && axes.amplitude === 1) {
    const rawAmplitude = measureAmplitudePeakPx(det, g, rangeEnd)! / CALIB.AMPLITUDE_CAP;
    axes.amplitude = options.amplitudeOverflow === 'raw' ? rawAmplitude : 1 + Math.log(rawAmplitude);
  }
  return axes;
}

/** Frees every engine except the caller's, this interval's prefix and the
 * current best candidate. */
export function retainSearch(s: IntervalSearch) {
  Engine.retainOnly([...s.protectedEngines, s.engine, ...(s.best ? [s.best.child] : [])]);
}
