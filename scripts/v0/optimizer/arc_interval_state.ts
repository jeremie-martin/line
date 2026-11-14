import {hypot2} from '../../lib/hypot2.ts';
/** State of one support-interval search: the options resolved for that
 * interval, the physical boundary it starts from (read once, on the meter),
 * and the measured candidates that proposals and local search accumulate. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getRiderMetered, getBallisticStateMetered, extractRawTrajectory, detect, DetectionContinuation } from '../../lib/detector.ts';
import { measureGapAxes, measureAmplitudePeakPx } from '../core/measure.ts';
import { CALIB, impactToRawPx, type AxisValues, type Gap } from '../types.ts';
import { catchReceivers, type ArcMotionControl } from './arc_geometry.ts';
import { arcControlNormalizer } from './arc_motion_control.ts';
import { arcPolicyArrival } from './arc_control_policy.ts';
import { arcConstructionMemoryKey, type ArcControlMemory } from './arc_memory.ts';
import { arcSpanLoss } from './arc_boundary.ts';
import { impactRuler } from './impact_accounts.ts';
import { evaluationContext, type IntervalOptions, type IntervalOverrides } from './arc_options.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';
import type {ArcObjectiveContinuation} from './arc_objective.ts';

/** A catch must have left the rail this many frames before the interval ends. */
export const RELEASE_FRAMES = 6;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const deg = (x: number) => x * 180 / Math.PI;

/** A control whose construction fell short, and by how much; seeds recovery. */
export type {Near} from './arc_candidates.ts';
import type {Near, CandidateGeometry, CandidateMemo, EvaluatedCandidate, MeasuredCandidate} from './arc_candidates.ts';
/** Contact fragments that replace a connected curve, with their guide line ids. */
export type Fragments = {lines: CandidateGeometry; guideIds: number[]};

/** Compile options with the per-call overrides and the section style applied,
 * plus the learned policy and arrival preferences this interval implies:
 * before a quiet unguided or transfer catch, arrival is passive and neither
 * the heading prior nor the learned future value applies. */
export function resolveIntervalOptions(ctx: ArcCompileContext, i: number, overrides: IntervalOverrides) {
  const compileOptions = ctx.options;
  const options: IntervalOptions = {...compileOptions, ...overrides, ...compileOptions.sectionStyles?.[i]};
  const constructionPolicy = i > 0 ? options.constructionPolicies?.[arcConstructionMemoryKey(options)] : undefined;
  if (constructionPolicy) options.controlPolicy = constructionPolicy;
  const nextRequest = options.constructionRequests?.[i + 1];
  if (nextRequest && (nextRequest.context?.quiet ?? 0) < .5 &&
    (nextRequest.guidance === 'forbidden' || nextRequest.railLayout === 'transfer')) {
    options.futureValueModel = undefined;
    options.passiveArrival = true;
    options.headingWeight = 0;
  }
  return options;
}

/** Reads the physical boundary of interval `i` from `engine` and derives its
 * targets, nominal support and turn. Returns null when the interval is too
 * short to hold a support. The calm-impact multiplier is applied to
 * `options.impactWeight` here. */
export function openInterval(ctx: ArcCompileContext, engine: Engine, i: number, options: IntervalOptions,
  controlMemory: ArcControlMemory, protectedEngines: Engine[]) {
  const {contacts, end, planned, gaps, duration, impactTargets} = ctx;
  const {frame, gap} = contacts[i], next = contacts[i + 1]?.frame ?? end + 1, horizon = next - 1;
  if (horizon <= frame + 2) return null;
  const scheduled = planned.find(g => g.startFrame === (i === 0 ? 0 : frame)) ??
    {index: gaps.length, startFrame: frame, endFrame: horizon, endsWithContact: false, targets: {}};
  // Construction timing may lead the beat; musical span measurements keep
  // the authored boundaries. Both an estimate and its later replacement use
  // the same search targets.
  const outgoing = {...(gaps[scheduled.index] ?? scheduled), targets: scheduled.targets};
  const targets = outgoing.targets;
  const objectiveEnd = Math.min(horizon, duration);

  const beforeState = getBallisticStateMetered(engine, frame - 1);
  const velocity = getRiderMetered(engine, frame).velocity;
  engine.prepareCollisionTrace(frame);
  getRiderMetered(engine, frame);
  const trace = catchReceivers(engine.readCollisionTrace()[0]);
  const prefixRaw = extractRawTrajectory(engine, frame - 1), detection = new DetectionContinuation(prefixRaw);
  const prefixImpactFrames = impactRuler.observe(engine, prefixRaw.frames);
  const impactPrefix = impactRuler.prefix(prefixImpactFrames);
  const localImpactTargets = impactTargets.filter(t => t.frame >= frame - impactRuler.matchFrames && t.frame <= horizon + impactRuler.matchFrames);
  const currentImpactTarget = localImpactTargets.findIndex(t => t === impactTargets[gap]);
  const incoming = deg(Math.atan2(velocity.y, velocity.x)), pace = hypot2(velocity.x, velocity.y);

  // A final authored contact can have no scored tail. Its support still
  // needs room to realize the impact and survive the unscored grace.
  const span = objectiveEnd > frame || i === 0 ? objectiveEnd - (i === 0 ? 0 : frame) : horizon - frame;
  // The authored objective ends with the music; the final construction still
  // has the existing physical survival horizon. Do not clamp a requested
  // shape to two frames just because its last impact is near the song end.
  const constructionSpan = options.constructionRequests && i === contacts.length - 1 ? horizon - frame : span;
  const support = clamp((1 - (targets.air ?? .5)) * (constructionSpan + 1), 3, Math.max(3, constructionSpan - RELEASE_FRAMES));
  const impact = gap >= 0 ? gaps[gap].targets.impact : undefined;
  if (impact !== undefined && options.motionQuality?.calmImpactMultiplier !== undefined)
    options.impactWeight = (options.impactWeight ?? 2) * (1 + (options.motionQuality.calmImpactMultiplier - 1) * Math.max(0, 1 - impact / .2));
  const turn = impact === undefined ? 5 : deg(impactToRawPx(impact) / Math.max(3, pace));

  const memo = selectMemo(ctx, engine, i, options);
  const authoredPrior = i > 0 ? gaps[contacts[i].gap] : undefined;
  const priorGap = authoredPrior ? {...authoredPrior, targets: planned.find(g => g.index === authoredPrior.index)?.targets ?? authoredPrior.targets} : undefined;
  const priorAxes = options.completeBoundary && priorGap
    ? objectiveAxes(detect(prefixRaw), priorGap, frame - 1) : undefined;
  const priorLoss = priorAxes && priorGap ? arcSpanLoss(priorAxes, priorGap.targets, options.amplitudeWeight ?? 1) : 0;
  const normalizeControl = arcControlNormalizer({...options, observedReceiver: true, span: constructionSpan});

  // These describe the immutable incoming prefix already measured above.
  // Reusing them avoids a new physics read after committing the search budget.
  const arrivalFeatures = arcPolicyArrival(beforeState, velocity), inputFeatures = arrivalFeatures.concat(ctx.futureFeatures(i - 1));
  // Only the learned proposal receives the longer authored window. Keep
  // response-memory and future-value inputs in their original units.
  const policyInputFeatures = options.controlPolicy?.featureCount === 67 ? arrivalFeatures.concat(ctx.futureFeatures(i - 1, 4)) : inputFeatures;
  // Every candidate in this search has the same authored future. Prepare it
  // once; only the physical arrival varies with the candidate.
  const valueFutureFeatures: readonly number[] | undefined = options.futureValueModel ? ctx.futureValueFeatures(i) : undefined;
  const max = options.samples ?? 160;
  // Combined research policies need room for every source beside memory and
  // the center, while preserving the generic quarter for novel constructors.
  // A mixture with only one active source must retain the single-policy search.
  const policy = options.controlPolicy;
  const multipleSources = policy?.models && (policy.proposalWeights ?? policy.models.map(() => 1))
    .filter((weight: number) => weight > 0).length > 1;
  const mixedPolicySlots = multipleSources
    ? 1 + (options.policySamples ?? 8) + (options.memorySamples ?? 0) + (options.memoryResponseSamples ?? 0) : 0;
  const mixedInitial = Math.ceil(mixedPolicySlots / (options.profile || options.railLayout === 'transfer' ? .75 : 1));
  const initial = Math.min(max, Math.max(Math.min(80, Math.ceil(max / 2)), mixedInitial));
  // Calm landing emphasis changes impact units between adjacent intervals.
  // Store those weights so response reuse can recover physical residuals
  // before applying this interval's weights.
  const responseAxisWeights = options.motionQuality?.calmImpactMultiplier !== undefined
    ? ['air', 'speed', 'amplitude'].map(key => key === 'amplitude' ? (options.amplitudeWeight ?? 1) : 1).concat(options.impactWeight ?? 2)
    : undefined;

  return {
    ctx, options, i, engine, protectedEngines, controlMemory,
    frame, gap, next, horizon, outgoing, targets, objectiveEnd,
    beforeState, velocity, trace,
    prefixRaw, detection, prefixImpactFrames, impactPrefix, localImpactTargets, currentImpactTarget,
    detectionFrames: frame,
    /** Candidate trajectories borrow this array; its first `replayIntact` entries match the prefix. */
    replayFrames: prefixRaw.frames.slice(), replayIntact: prefixRaw.frames.length,
    incoming, pace, span, constructionSpan, support, impact, turn,
    memo, priorGap, priorAxes, priorLoss, normalizeControl,
    inputFeatures, policyInputFeatures, valueFutureFeatures, max, initial, responseAxisWeights,
    /** Lowest optimization cost measured so far. */
    best: null as EvaluatedCandidate | null,
    terminalObjective: undefined as ArcObjectiveContinuation | undefined,
    candidates: [] as MeasuredCandidate[],
    failures: {} as Record<string, number>,
    near: [] as Near[],
    center: undefined as ArcMotionControl | undefined,
  };
}

export type IntervalSearch = NonNullable<ReturnType<typeof openInterval>>;

/** The candidate memo for this search: a fresh one, or the memo of an
 * earlier search shared from an identical physical prefix with an identical
 * memo context (see EVALUATION_IDENTITY), never while an arrival reference
 * is set or a different future-value model is in use; at most 32 such
 * contexts are kept, most recently used last. */
function selectMemo(ctx: ArcCompileContext, engine: Engine, i: number, options: IntervalOptions) {
  const {prefixes, prefixKey, memoContexts} = ctx.lineage;
  let memo = new Map<string, CandidateMemo>();
  const prefix = prefixes.get(engine);
  if (prefix &&
    (!options.futureValueModel || options.futureValueModel === ctx.options.futureValueModel)) {
    const context = prefixKey(prefix) + '|' + evaluationContext(options, i);
    const saved = memoContexts.get(context);
    if (saved) {
      memo = saved;
      memoContexts.delete(context);
    }
    memoContexts.set(context, memo);
    while (memoContexts.size > 32) memoContexts.delete(memoContexts.keys().next().value!);
  }
  return memo;
}

/** Span axes of `g` over [g.startFrame, rangeEnd]; a capped amplitude keeps
 * its raw excess as search pressure. */
export function objectiveAxes(det: ReturnType<typeof detect>, g: Gap, rangeEnd: number) {
  const axes = measureGapAxes(det, g, [], rangeEnd);
  return uncappedObjectiveAxes(det, g, rangeEnd, axes);
}

/** Reuse measured span axes without rescanning air and speed. The measurement
 * must cover the same start and range end; keep the reported axes capped. */
export function uncappedObjectiveAxes(det: ReturnType<typeof detect>, g: Gap, rangeEnd: number, measured: AxisValues) {
  if (g.targets.amplitude !== undefined && measured.amplitude === 1)
    return {...measured, amplitude: measureAmplitudePeakPx(det, g, rangeEnd)! / CALIB.AMPLITUDE_CAP};
  return measured;
}

/** Frees every engine except the caller's, this interval's prefix and the
 * current best candidate. */
export function retainSearch(s: IntervalSearch) {
  Engine.retainOnly([...s.protectedEngines, s.engine, ...(s.best ? [s.best.child] : [])]);
}
