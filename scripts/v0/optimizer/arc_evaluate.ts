import {hypot2} from '../../lib/hypot2.ts';
/** Evaluation of one control in an interval search. The control is built as
 * normal-line geometry and replayed on the native engine from the interval's
 * physical prefix; only a replay that meets every physical, musical and
 * construction requirement becomes a candidate. Measurements and rejections
 * are memoized by control within the search's memo context. */
import { getBallisticStateMetered, matchesBallisticStateMetered, boundThroughMetered, getPhysicsFrameCount, extractRawTrajectoryWindow, DetectionContinuation, type Detection, type RawFrame } from '../../lib/detector.ts';
import { AXIS_MEASURE, measureTrajectoryAxes } from '../core/measure.ts';
import { authoredSpeedToPx, impactToRawPx } from '../types.ts';
import {solidPathLines} from '../arc.ts';
import type {SolidPath} from '../../lib/track.ts';
import type { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { motionArc, motionArcPaths, receiverPoints, type ArcMotionControl } from './arc_geometry.ts';
import { arcRailGroups } from './arc_guidance.ts';
import {ArcObjectiveContinuation} from './arc_objective.ts';
import { arcBoundaryCorrection } from './arc_boundary.ts';
import { arcArrivalFeatures, arcFutureValue } from './arc_value.ts';
import { arcControlMemoKey, arcControlsSimilar } from './arc_motion_control.ts';
import { inspectConstructionWindow } from './repertoire_candidate.ts';
import { motionSamples, effectiveBodyVelocity, MOTION_BANDS } from './motion_quality.ts';
import { constructionDeficit } from './repertoire_feasibility.ts';
import { motionResiduals, intervalMotionSummary } from './motion_objective.ts';
import { observedReceiver } from './observed_receiver.ts';
import { impactSearchResiduals, engagementGainResiduals } from './impact_search.ts';
import { impactRuler } from './impact_accounts.ts';
import { objectiveAxes, uncappedObjectiveAxes, type IntervalSearch, type Near, type Fragments } from './arc_interval_state.ts';
import {restoreCandidate, type CandidateGeometry, type CandidateMemo, type EvaluatedCandidate, type MeasuredCandidate} from './arc_candidates.ts';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const deg = (x: number) => x * 180 / Math.PI;

type Rejection = {reason: string; near?: Near};

/** Measures control `c` (or explicit contact `fragments`) in search `s`.
 * Returns the measured candidate, or null when it is rejected; a valid
 * candidate with a lower optimization cost becomes `s.best`. */
export function evaluate(s: IntervalSearch, c: ArcMotionControl, fragments?: Fragments) {
  const observed = c.receiverFlight !== undefined && !fragments;
  if (!observed) return evaluateCandidate(s, c, fragments);
  const work = s.ctx.work.observedReceiverWork, began = getPhysicsFrameCount();
  work.attempts++;
  try {
    const result = evaluateCandidate(s, c, fragments);
    if (result) work.viable++;
    return result;
  } finally {
    work.physicsFrames += getPhysicsFrameCount() - began;
  }
}

/** Keeps the twelve smallest-deficit distinct constructions that fell short. */
export function rememberNear(s: IntervalSearch, candidate: Near) {
  const near = s.near;
  const similar = near.findIndex(n => arcControlsSimilar(n.c, candidate.c));
  if (similar >= 0) {
    if (near[similar].deficit <= candidate.deficit) return;
    near.splice(similar, 1);
  }
  near.push(candidate);
  near.sort((a, b) => a.deficit - b.deficit);
  near.length = Math.min(near.length, 12);
}

function evaluateCandidate(s: IntervalSearch, c: ArcMotionControl, fragments?: Fragments) {
  const {options, memo} = s, work = s.ctx.work;
  c = s.normalizeControl(c);
  const key = arcControlMemoKey(c, options.channel) + (fragments ? '|fragments' : '');
  work.samples++;
  const saved = memo.get(key);
  if (saved) return reuseMeasurement(s, c, saved);
  const reject = (reason: string, near?: Near) => {
    if (c.receiverFlight !== undefined)
      work.observedReceiverWork.failures[reason] = (work.observedReceiverWork.failures[reason] ?? 0) + 1;
    memo.set(key, {reason, near});
    s.failures[reason] = (s.failures[reason] ?? 0) + 1;
    return null;
  };
  const built = buildGeometry(s, c, fragments);
  if ('reason' in built) return reject(built.reason);
  const {child} = built;
  const count = built.added ? built.added.length : built.paths.reduce((n, p) => n + Math.max(0, p.points.length - 1), 0);
  if (!count) return null;
  const prefixFrames = Math.min(built.prefixFrames, child.getLastFrameIndex() + 1);
  if (count >= 10000) throw new Error('arc geometry id range exhausted');
  const replay = replayCandidate(s, child, prefixFrames);
  if ('reason' in replay) return reject(replay.reason);
  const added = built.added ?? solidPathLines(built.paths);
  s.ctx.lineage.record(s.engine, child, added);
  // Borrowed detector storage is consumed entirely within this evaluation.
  // Candidate records and memo entries contain only owned measurements.
  const consume = (det: Detection) => {
    const traced = inspectTrajectory(s, c, added, child, fragments, replay, det);
    if ('reason' in traced) {
      if (traced.near) rememberNear(s, traced.near);
      return reject(traced.reason, traced.near);
    }
    const measured = measureObjective(s, added, traced);
    if ('reason' in measured) return reject(measured.reason);
    return recordCandidate(s, c, key, added, child, fragments, traced, measured);
  };
  if (prefixFrames < s.detectionFrames) {
    // Geometry can invalidate only part of the prefix. Move the checkpoint
    // back to the unchanged boundary, including the detector's lookahead.
    // Later candidates can keep this earlier checkpoint even if they preserve more.
    s.detection = new DetectionContinuation({duration: prefixFrames - 1, frames: s.prefixRaw.frames.slice(0, prefixFrames)});
    s.detectionFrames = prefixFrames;
  }
  return s.detection.withDetection(replay.raw, consume);
}

/** A memoized measurement competes again in this search; its engine is rebuilt
 * from the validated geometry, so later simulation stays metered. */
function reuseMeasurement(s: IntervalSearch, c: ArcMotionControl, saved: CandidateMemo) {
  const work = s.ctx.work;
  work.memoHits++;
  if ('reason' in saved) {
    if (saved.near) rememberNear(s, saved.near);
    work.memoRejectedHits++;
    s.failures[saved.reason] = (s.failures[saved.reason] ?? 0) + 1;
    return null;
  }
  work.viableCandidates++;
  const candidate = {...saved, c};
  s.candidates.push(candidate);
  // Never reuse saved wrappers: retainOnly may already have freed them.
  // Rebuild from validated geometry; subsequent simulations stay metered.
  // A measurement from an earlier search must compete in this search.
  // Skipping this add for a losing hit would move charged frames: it truncates
  // the shared cache, and later candidates replay from that boundary.
  const result = restoreCandidate(candidate, s.ctx.lineage.add(s.engine, saved.lines));
  if (!s.best || candidate.cost < s.best.candidate.cost) s.best = result;
  return result;
}

/** Support geometry for `c` on the interval's prefix engine: a connected arc,
 * explicit fragments, or (transfer layouts) a support plus a receiving curve
 * placed from the observed free flight. */
function buildGeometry(s: IntervalSearch, c: ArcMotionControl, fragments?: Fragments): ({added: CandidateGeometry; paths?: never} | {added?: never; paths: SolidPath[]}) & {child: Engine; prefixFrames: number} | Rejection {
  const {ctx, options, i, engine} = s;
  const {add, prefixes} = ctx.lineage;
  if (c.receiverFlight !== undefined && options.railLayout === 'transfer' && !fragments) {
    const main = motionArc(receiverPoints(s.trace, c.contactSide), s.velocity, c, 1000 + i * 10000, options.channel, options.radius, undefined, {...options, guides: false});
    const supportEngine = add(engine, main), id = Math.max(...main.map(l => l.id)) + 1;
    // Receiver placement simulates before adding its guide. Remember what the
    // first edit preserved; the guide's later cache boundary cannot recover it.
    const prefixFrames = Math.min(s.frame, supportEngine.getLastFrameIndex() + 1);
    const receiver = observedReceiver(supportEngine, main, s.frame, Math.min(s.horizon, ctx.duration), c, id, options, i === ctx.contacts.length - 1);
    if (!receiver) return {reason: 'receiver_no_window'};
    const added = [...main, ...receiver.guide], child = add(supportEngine, receiver.guide);
    const parent = prefixes.get(engine);
    if (parent) prefixes.set(child, {parent, lines: added});
    return {added, child, prefixFrames};
  }
  if (fragments) return {added: fragments.lines, child: add(engine, fragments.lines), prefixFrames: s.frame};
  const paths = motionArcPaths(receiverPoints(s.trace, c.contactSide), s.velocity, c, 1000 + i * 10000, options.channel, options.radius, undefined, options);
  return {paths, child: engine.addSolidPaths(paths), prefixFrames: s.frame};
}

/** Check the prefix and replay to the interval horizon. A candidate whose
 * rider or sled comes apart stops there and is charged only that far. */
function replayCandidate(s: IntervalSearch, child: Engine, prefixFrames: number) {
  const {frame, horizon} = s;
  if (!matchesBallisticStateMetered(child, frame - 1, s.beforeState)) return {reason: 'prefix'} as Rejection;
  if (!boundThroughMetered(child, horizon)) return {reason: 'binding'} as Rejection;
  const state = getBallisticStateMetered(child, horizon);
  const raw = {duration: horizon, frames: candidateFrames(s, prefixFrames, extractRawTrajectoryWindow(child, prefixFrames, horizon).frames)};
  return {state, raw};
}

/** The unchanged prefix followed by `suffix`, in the search's one reusable array.
 * Borrowed like the detection: valid only until the next replay of this search. */
function candidateFrames(s: IntervalSearch, prefixFrames: number, suffix: RawFrame[]) {
  const {replayFrames: frames, prefixRaw} = s;
  for (let k = s.replayIntact; k < prefixFrames; k++) frames[k] = prefixRaw.frames[k];
  s.replayIntact = prefixFrames;
  frames.length = prefixFrames;
  for (let k = 0; k < suffix.length; k++) frames.push(suffix[k]);
  return frames;
}

/** Validates the detected trajectory and observes its requested impact and
 * construction. Detector arrays are borrowed only for this evaluation. */
function inspectTrajectory(s: IntervalSearch, c: ArcMotionControl, added: CandidateGeometry, child: Engine, fragments: Fragments | undefined,
  replay: Exclude<ReturnType<typeof replayCandidate>, Rejection>, det: Detection) {
  const {ctx, options, i, frame, horizon} = s;
  const {contacts, duration} = ctx;
  const {state, raw} = replay;
  if (det.terminus.reason !== 'endOfSpec') return {reason: det.terminus.reason} as Rejection;
  if (i === 0 && !raw.frames.slice(1, 4).some(f => f.sledContacts.length)) return {reason: 'startup'} as Rejection;
  if (i < contacts.length - 1 && s.releaseFrames > 0 && !raw.frames.slice(-s.releaseFrames).every(f => f.sledContacts.length === 0))
    return {reason: 'late_release'} as Rejection;
  const observedImpacts = impactRuler.observe(child, raw.frames.slice(frame), state);
  const allImpactEvents = impactRuler.continue(s.impactPrefix, observedImpacts);
  const impactEvents = allImpactEvents.filter(e => e.onset >= frame - impactRuler.matchFrames && e.onset <= Math.min(duration, horizon));
  const impactAccount = impactRuler.account(impactEvents, s.localImpactTargets);
  const impactMatch = impactAccount.matches.find(m => m.target === s.currentImpactTarget);
  if (i > 0 && !impactMatch) return {reason: 'missed_impact'} as Rejection;
  const request = options.constructionRequests?.[i];
  if (request && (request.construction === 'scattered' ? !!fragments : request.guidance === 'required' || request.construction !== 'arcs')) {
    const guideIds = fragments?.guideIds ?? (arcRailGroups(added).get(i)![1] ?? []).map(l => l.id);
    const allContacts = request.context || request.railLayout === 'transfer'
      ? (frame: number) => child.getAllContactLineIdsAtFrame(frame) : undefined;
    const fulfillment = inspectConstructionWindow(request, added, new Set(guideIds), raw.frames, allContacts);
    if (!fulfillment.fulfilled) {
      return {reason: 'construction:' + fulfillment.reasons.join(','), near: {c, deficit: constructionDeficit(fulfillment)}} as Rejection;
    }
  }
  return {state, raw, det, observedImpacts, allImpactEvents, impactEvents, impactAccount, impactMatch, request};
}

type Trace = Exclude<ReturnType<typeof inspectTrajectory>, Rejection>;

/** Weighted residuals and cost of a valid replay: authored span axes, the
 * impact at this contact (and, with the impact contract, its event account),
 * the corrected preceding span, motion quality, then the arrival priors that
 * only guide search. `localCost` excludes the arrival priors. */
function measureObjective(s: IntervalSearch, added: CandidateGeometry, traced: Trace) {
  const {ctx, options, i, frame, next, horizon, targets, impact, gap} = s;
  const {contacts, duration, gaps} = ctx;
  const {det, raw, state, impactEvents, impactAccount, impactMatch, observedImpacts, request} = traced;
  const achieved = measureTrajectoryAxes(det, {...s.outgoing, endFrame: s.objectiveEnd}, s.objectiveEnd);
  const measuredObjective = uncappedObjectiveAxes(det, s.outgoing, s.objectiveEnd, achieved);
  const residuals: number[] = ['air', 'speed', 'amplitude'].map(key => targets[key as keyof typeof targets] === undefined ? 0 :
    ((measuredObjective as any)[key] - (targets as any)[key]) * Math.sqrt(key === 'amplitude' ? (options.amplitudeWeight ?? 1) : 1));
  let cost = residuals.reduce((sum, x) => sum + x * x, 0);
  let actualImpact: number | undefined;
  if (impact !== undefined) {
    actualImpact = impactMatch ? impactEvents[impactMatch.event].strength
      : AXIS_MEASURE.impact({det, gap: gaps[gap], gapLines: added, rangeEndFrame: frame});
    if (actualImpact === undefined) return {reason: 'impact'} as Rejection;
    cost += (options.impactWeight ?? 2) * (actualImpact - impact) ** 2;
  }
  residuals.push(impact === undefined ? 0 : Math.sqrt(options.impactWeight ?? 2) * (actualImpact! - impact));
  const extra = impactSearchResiduals(impactEvents, impactAccount, s.currentImpactTarget < 0 ? undefined : s.currentImpactTarget,
    frame - impactRuler.matchFrames, i < contacts.length - 1 ? next - impactRuler.matchFrames : duration + 1, options.impactSearch);
  extra.push(...engagementGainResiduals([...s.impactPrefix.pending, ...observedImpacts] as any, frame, Math.min(duration, horizon), options.impactSearch));
  residuals.push(...extra);
  cost += extra.reduce((sum, r) => sum + r * r, 0);
  if (options.completeBoundary && s.priorGap) {
    const priorGap = s.priorGap;
    const actual = objectiveAxes(det, priorGap, priorGap.endFrame);
    const correction = arcBoundaryCorrection(actual, priorGap.targets, s.priorLoss, options.amplitudeWeight ?? 1, cost);
    residuals.push(...correction.residuals);
    cost = correction.cost;
  }
  const motion = options.motionQuality ? intervalMotionSummary(motionSamples(raw.frames,
    Math.max(1, frame - Math.max(...MOTION_BANDS.map(b => b.frames)) + 1), horizon, effectiveBodyVelocity(state)), frame, horizon) : undefined;
  // Startup has no preceding impact, but the next authored landing still
  // provides musical context. Do not silently exempt its internal motion.
  const motionImpact = impact ?? request?.context?.nextImpact ?? undefined;
  const motionErrors = motion ? motionResiduals(motion, motionImpact, options.motionQuality!) : [];
  const motionCost = motionErrors.reduce((n, r) => n + r * r, 0);
  residuals.push(...motionErrors);
  cost += motionCost;
  const localCost = cost, localResidualCount = residuals.length;
  const finalVelocity = raw.frames.at(-1)!.velocity;
  if (i < contacts.length - 1 && finalVelocity.x < 1) return {reason: 'unusable_arrival'} as Rejection;
  // Keep future catches physically accessible; this is an optimizer prior,
  // never a change to the scored result.
  cost += .01 * Math.max(0, -finalVelocity.x / Math.max(1, s.pace)) ** 2;
  const priors = addArrivalPriors(s, finalVelocity, state, residuals, cost);
  return {achieved, actualImpact, residuals, cost: priors.cost, localCost, localResidualCount, motion, motionCost, finalVelocity, headingPrior: priors.heading};
}

/** How much of the steep, kinetic arrival prior applies before a catch asked
 * at `ask`: a smooth step centred on `steepArrivalFrom`, none 0.2 below it,
 * all of it 0.2 above. */
export function steepArrival(ask: number, search: {steepArrivalFrom?: number} | undefined) {
  if (search?.steepArrivalFrom === undefined) return 0;
  const t = Math.max(0, Math.min(1, (ask - search.steepArrivalFrom + .2) / .4));
  return t * t * (3 - 2 * t);
}

/** Arrival speed and heading priors toward the next catch, and (in repair)
 * the distance to a reference arrival state. Appends residuals; returns the
 * cost with each term added in order, and the heading prior's part of it. */
function addArrivalPriors(s: IntervalSearch, finalVelocity: {x: number; y: number}, state: any, residuals: number[], cost: number) {
  let heading = 0;
  const {ctx, options, i, targets} = s;
  const {contacts, gaps, planned} = ctx;
  const nextImpact = i < contacts.length - 1 ? gaps[contacts[i + 1].gap].targets.impact ?? 0 : 0;
  // A strong next ask gets the same steep, kinetic arrival prior as a passive catch:
  // a whole-body hit needs speed into the surface, which a shallow arrival lacks.
  // `steep` is how much of that prior applies (0 to 1); it shifts the arrival
  // speed and angle toward the kinetic ones and replaces the ordinary heading prior.
  const steep = i < contacts.length - 1 ? steepArrival(nextImpact, options.impactSearch) : 0;
  if (i < contacts.length - 1 && (options.arrivalWeight ?? 0) > 0) {
    const nextSpeed = authoredSpeedToPx(planned[contacts[i + 1].gap + 1]?.targets.speed ?? targets.speed ?? .55);
    // A passive catch redirects incoming speed into the next surface.
    // Prepare kinetic headroom for an unguided landing.
    // This is a proposal prior; actual native continuation decides merit.
    const kinetic = options.passiveArrival && options.constructionRequests?.[i + 1]?.guidance === 'forbidden' ? 1 : steep;
    const impulse = impactToRawPx(nextImpact), arrivalSpeed = (1 - kinetic) * nextSpeed + kinetic * hypot2(nextSpeed, impulse);
    const desiredArrival = clamp(15 + deg((1 - kinetic) * (impulse / nextSpeed) + kinetic * Math.atan2(impulse, nextSpeed)), 20, 70);
    const weight = Math.sqrt(options.arrivalWeight ?? 0), angled = options.passiveArrival ? 1 : steep;
    const r1 = angled > 0 ? weight * Math.sqrt(angled) * (deg(Math.atan2(finalVelocity.y, finalVelocity.x)) - desiredArrival) / 45 : 0;
    const r2 = weight * (hypot2(finalVelocity.x, finalVelocity.y) - arrivalSpeed) / 7.2;
    // A passive catch benefits from an upright arrival: the sled's nose-to-tail
    // axis past vertical, or pointing against the travel (uprightArrival).
    let r3 = 0;
    if (kinetic > 0 && options.impactSearch?.uprightArrival && state?.points) {
      const ax = state.points.NOSE.x - state.points.TAIL.x, ay = state.points.NOSE.y - state.points.TAIL.y, len = hypot2(ax, ay) || 1;
      const backward = Math.max(0, -(ax * finalVelocity.x + ay * finalVelocity.y) / (len * (hypot2(finalVelocity.x, finalVelocity.y) || 1)));
      const inverted = Math.max(0, -ax / len);   // past vertical: the nose points backward on screen
      r3 = weight * Math.sqrt(kinetic) * options.impactSearch.uprightArrival * (backward + inverted);
    }
    residuals.push(r1, r2, ...(options.impactSearch?.uprightArrival ? [r3] : []));
    cost += r1 * r1 + r2 * r2 + r3 * r3;
  }
  if (i < contacts.length - 1 && (options.headingWeight ?? 0) > 0 && steep < 1) {
    const angle = deg(Math.atan2(finalVelocity.y, finalVelocity.x));
    const r = Math.sqrt(options.headingWeight! * (1 - steep)) * Math.max(0, Math.abs(angle - 15) - 30) / 30;
    residuals.push(r);
    cost += r * r;
    heading = r * r;
  }
  if (options.arrivalReference) {
    const target = options.arrivalReference, weight = Math.sqrt(1 / 10);
    const here = state.points.PEG, there = target.state.points.PEG;
    for (const key of Object.keys(state.points)) {
      const a = state.points[key], b = target.state.points[key];
      for (const r of [weight * ((a.x - here.x) - (b.x - there.x)) / 18, weight * ((a.y - here.y) - (b.y - there.y)) / 18,
        weight * (a.vx - b.vx) / 7.2, weight * (a.vy - b.vy) / 7.2]) {
        residuals.push(r);
        cost += r * r;
      }
    }
  }
  return {cost, heading};
}

/** Turns a valid measurement into a candidate: arrival description, the
 * terminal loss of a final support, the learned future value, and the memo
 * entry. Updates `s.best`. */
function recordCandidate(s: IntervalSearch, c: ArcMotionControl, key: string, added: CandidateGeometry, child: Engine,
  fragments: Fragments | undefined, traced: Trace, measured: Exclude<ReturnType<typeof measureObjective>, Rejection>): EvaluatedCandidate {
  const {ctx, options, i, frame, horizon} = s;
  const {contacts, duration, impactTargets} = ctx;
  const {state, raw, det, observedImpacts} = traced;
  const {achieved, actualImpact, residuals, cost, localCost, localResidualCount, motion, motionCost, finalVelocity, headingPrior} = measured;
  const tail = state.points.TAIL, nose = state.points.NOSE, dx = nose.x - tail.x, dy = nose.y - tail.y;
  const angularRate = (dx * (nose.vy - tail.vy) - dy * (nose.vx - tail.vx)) / Math.max(1, dx * dx + dy * dy);
  const terminalPhysical = i === contacts.length - 1 ? [...s.prefixImpactFrames, ...observedImpacts] : undefined;
  const terminalImpacts = terminalPhysical ? impactRuler.evaluateEvents(traced.allImpactEvents, impactTargets, duration, true) : undefined;
  const terminalLoss = i === contacts.length - 1
    ? (s.terminalObjective ??= new ArcObjectiveContinuation(ctx, s.prefixRaw, options.amplitudeWeight))
      .score(raw, det, terminalPhysical, terminalImpacts).loss : undefined;
  let release: number | undefined;
  for (let k = raw.frames.length - 1; k >= 0 && release === undefined; k--) if (raw.frames[k].sledContacts.length) release = raw.frames[k].frame;
  const finalState = state.points;
  const heading = deg(Math.atan2(finalVelocity.y, finalVelocity.x)), endSpeed = hypot2(finalVelocity.x, finalVelocity.y);
  const pose = deg(Math.atan2(finalState.NOSE.y - finalState.TAIL.y, finalState.NOSE.x - finalState.TAIL.x));
  ctx.work.viableCandidates++;
  const valueFeatures = options.futureValueModel
    ? arcArrivalFeatures(state, heading, endSpeed, pose, angularRate, horizon - (release ?? frame)).concat(s.valueFutureFeatures!) : undefined;
  const predictedFuture = options.futureValueModel ? arcFutureValue(valueFeatures!, options.futureValueModel) : undefined;
  const contactPositions = !fragments && options.constructionRequests?.[i]?.construction === 'scattered'
    ? child.getCachedContactPositions(s.frame, s.horizon) : undefined;
  const candidate: MeasuredCandidate = {lines: added, c, cost, localCost, residuals, localResidualCount,
    trajectoryAxes: achieved, actualImpact, terminalLoss, release, railGuides: fragments?.guideIds, motion, motionCost,
    contactPositions, headingPrior, heading, endSpeed, pose, valueFeatures, predictedFuture};
  s.candidates.push(candidate);
  // Interrupted evaluations never reach this cache insertion.
  s.memo.set(key, candidate);
  const result = restoreCandidate(candidate, child);
  if (!s.best || cost < s.best.candidate.cost) s.best = result;
  return result;
}
