/** Evaluation of one control in an interval search. The control is built as
 * normal-line geometry and replayed on the native engine from the interval's
 * physical prefix; only a replay that meets every physical, musical and
 * construction requirement becomes a candidate. Measurements and rejections
 * are memoized by control within the search's memo context. */
import { getRiderMetered, getPhysicsFrameCount, extractRawTrajectory, extractRawTrajectoryWindow, detect } from '../../lib/detector.ts';
import { findAuthoredContactNearFrame } from '../core/substrate.ts';
import { measureGapAxes } from '../core/measure.ts';
import { authoredSpeedToPx, impactToRawPx, type TrackLine } from '../types.ts';
import type { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { motionArc, type ArcMotionControl } from './arc_geometry.ts';
import { arcRailGroups } from './arc_guidance.ts';
import { arcDetectedTrajectoryObjective } from './arc_refinement.ts';
import { arcBoundaryCorrection } from './arc_boundary.ts';
import { arcArrivalFeatures, arcFutureValue, arcValueGuidance } from './arc_value.ts';
import { normalizeArcControl, arcControlMemoKey, arcControlsSimilar } from './arc_motion_control.ts';
import { inspectConstructionWindow } from './repertoire_candidate.ts';
import { motionSamples, effectiveBodyVelocity, MOTION_BANDS } from './motion_quality.ts';
import { constructionDeficit } from './repertoire_feasibility.ts';
import { motionResiduals, intervalMotionSummary } from './motion_objective.ts';
import { observedReceiver } from './observed_receiver.ts';
import { impactSearchResiduals, engagementGainResiduals } from './impact_search.ts';
import { impactAccount as impactAccountFor } from './impact_accounts.ts';
import { objectiveAxes, type IntervalSearch, type Near, type Fragments } from './arc_interval_state.ts';

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
  c = normalizeArcControl(c, s.controlContext);
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
  const {added, child} = built;
  if (!added.length) return null;
  const prefixReusable = child.getLastFrameIndex() >= s.frame - 1;
  if (added.length >= 10000) throw new Error('arc geometry id range exhausted');
  const traced = traceCandidate(s, c, added, child, fragments, prefixReusable);
  if ('reason' in traced) {
    if (traced.near) rememberNear(s, traced.near);
    return reject(traced.reason, traced.near);
  }
  const measured = measureObjective(s, added, traced);
  if ('reason' in measured) return reject(measured.reason);
  return recordCandidate(s, c, key, added, child, fragments, traced, measured);
}

/** A memoized measurement competes again in this search; its engine is rebuilt
 * from the validated geometry, so later simulation stays metered. */
function reuseMeasurement(s: IntervalSearch, c: ArcMotionControl, saved: any) {
  const work = s.ctx.work;
  work.memoHits++;
  if (saved.reason) {
    if (saved.near) rememberNear(s, saved.near);
    work.memoRejectedHits++;
    s.failures[saved.reason] = (s.failures[saved.reason] ?? 0) + 1;
    return null;
  }
  work.viableCandidates++;
  s.candidates.push({...saved.candidate, c});
  // Never reuse saved wrappers: retainOnly may already have freed them.
  // Rebuild from validated geometry; subsequent simulations stay metered.
  // A measurement from an earlier search must compete in this search.
  const result = {...saved.result, c, child: s.ctx.lineage.add(s.engine, saved.result.lines)};
  if (!s.best || result.optimizationCost < s.best.optimizationCost) s.best = result;
  return result;
}

/** Support geometry for `c` on the interval's prefix engine: a connected arc,
 * explicit fragments, or (transfer layouts) a support plus a receiving curve
 * placed from the observed free flight. */
function buildGeometry(s: IntervalSearch, c: ArcMotionControl, fragments?: Fragments): {added: TrackLine[]; child: Engine} | Rejection {
  const {ctx, options, i, engine} = s;
  const {add, prefixes} = ctx.lineage;
  if (c.receiverFlight !== undefined && options.railLayout === 'transfer' && !fragments) {
    const main = motionArc(s.points, s.velocity, c, 1000 + i * 10000, false, options.channel, false, options.radius, undefined, {...options, guides: false});
    const supportEngine = add(engine, main), id = Math.max(...main.map(l => l.id)) + 1;
    const receiver = observedReceiver(supportEngine, main, s.frame, Math.min(s.horizon, ctx.duration), c, id, options, i === ctx.contacts.length - 1);
    if (!receiver) return {reason: 'receiver_no_window'};
    const added = [...main, ...receiver.guide], child = add(supportEngine, receiver.guide);
    const parent = prefixes.get(engine);
    if (parent) prefixes.set(child, {parent, lines: added});
    return {added, child};
  }
  const receivers = c.contactSide === -1 ? Object.values(s.trace) : s.points;
  const added = fragments?.lines ??
    motionArc(receivers, s.velocity, c, 1000 + i * 10000, false, options.channel, false, options.radius, undefined, options);
  return {added, child: add(engine, added)};
}

/** Replays the candidate to the interval horizon and checks the prefix, the
 * rider, the authored contact timing, the release and any requested
 * construction. Returns the measured trajectory or the rejection. */
function traceCandidate(s: IntervalSearch, c: ArcMotionControl, added: TrackLine[], child: Engine, fragments: Fragments | undefined,
  prefixReusable: boolean) {
  const {ctx, options, i, frame, horizon} = s;
  const {contacts, duration, frames} = ctx;
  if (JSON.stringify(getRiderMetered(child, frame - 1).ballisticState()) !== s.before) return {reason: 'prefix'} as Rejection;
  const state = getRiderMetered(child, horizon).ballisticState();
  if (!state.riderMounted || !state.sledIntact) return {reason: 'binding'} as Rejection;
  const raw = prefixReusable
    ? {duration: horizon, frames: [...s.prefixRaw.frames, ...extractRawTrajectoryWindow(child, frame, horizon).frames]}
    : extractRawTrajectory(child, horizon);
  const det = detect(raw);
  if (det.terminus.reason !== 'endOfSpec') return {reason: det.terminus.reason} as Rejection;
  if (!options.impactContract && i > 0 && !findAuthoredContactNearFrame(det, frame, 1, frame - contacts[i - 1].frame))
    return {reason: 'missed'} as Rejection;
  if (i === 0 && !raw.frames.slice(1, 4).some(f => f.sledContacts.length)) return {reason: 'startup'} as Rejection;
  if (!options.impactContract && det.events.some(e => e.type === 'landing' && !frames.some(f => Math.abs(e.frame - f) <= 1)))
    return {reason: 'offbeat'} as Rejection;
  if (i < contacts.length - 1 && s.releaseFrames > 0 && !raw.frames.slice(-s.releaseFrames).every(f => f.sledContacts.length === 0))
    return {reason: 'late_release'} as Rejection;
  const ruler = options.impactContract ? impactAccountFor(options.impactContract) : undefined;
  const observedImpacts = ruler ? ruler.observe(child, raw.frames.slice(frame), state) : undefined;
  const impactEvents = observedImpacts ? ruler!.continue(s.impactPrefix!, observedImpacts)
    .filter(e => e.onset >= frame - ruler!.matchFrames && e.onset <= Math.min(duration, horizon)) : undefined;
  const impactAccount = impactEvents ? ruler!.account(impactEvents, s.localImpactTargets) : undefined;
  const impactMatch = impactAccount?.matches.find(m => m.target === s.currentImpactTarget);
  if (options.impactContract && i > 0 && !impactMatch) return {reason: 'missed_impact'} as Rejection;
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
  return {state, raw, det, observedImpacts, impactEvents, impactAccount, impactMatch, request};
}

type Trace = Exclude<ReturnType<typeof traceCandidate>, Rejection>;

/** Weighted residuals and cost of a valid replay: authored span axes, the
 * impact at this contact (and, with the impact contract, its event account),
 * the corrected preceding span, motion quality, then the arrival priors that
 * only guide search. `localCost` excludes the arrival priors. */
function measureObjective(s: IntervalSearch, added: TrackLine[], traced: Trace) {
  const {ctx, options, i, frame, next, horizon, targets, impact, gap} = s;
  const {contacts, duration, gaps} = ctx;
  const {det, raw, state, impactEvents, impactAccount, impactMatch, observedImpacts, request} = traced;
  const achieved = measureGapAxes(det, {...s.outgoing, startFrame: i === 0 ? 0 : frame, endFrame: s.objectiveEnd}, added, s.objectiveEnd);
  const measuredObjective = objectiveAxes(det, {...s.outgoing, startFrame: i === 0 ? 0 : frame}, s.objectiveEnd);
  const residuals: number[] = ['air', 'speed', 'amplitude'].map(key => targets[key as keyof typeof targets] === undefined ? 0 :
    ((measuredObjective as any)[key] - (targets as any)[key]) * Math.sqrt(key === 'amplitude' ? (options.amplitudeWeight ?? 1) : 1));
  let cost = residuals.reduce((sum, x) => sum + x * x, 0);
  let actualImpact: number | undefined;
  if (impact !== undefined) {
    actualImpact = impactEvents && impactMatch ? impactEvents[impactMatch.event].strength : measureGapAxes(det, gaps[gap], added, frame).impact;
    if (actualImpact === undefined) return {reason: 'impact'} as Rejection;
    cost += (options.impactWeight ?? 2) * (actualImpact - impact) ** 2;
  }
  residuals.push(impact === undefined ? 0 : Math.sqrt(options.impactWeight ?? 2) * (actualImpact! - impact));
  if (impactEvents && impactAccount) {
    const extra = impactSearchResiduals(impactEvents, impactAccount, s.currentImpactTarget < 0 ? undefined : s.currentImpactTarget,
      frame - impactAccountFor(options.impactContract!).matchFrames, i < contacts.length - 1 ? next - impactAccountFor(options.impactContract!).matchFrames : duration + 1,
      options.impactSearch);
    extra.push(...engagementGainResiduals([...s.impactPrefix!.pending, ...observedImpacts!] as any, frame, Math.min(duration, horizon), options.impactSearch));
    residuals.push(...extra);
    cost += extra.reduce((sum, r) => sum + r * r, 0);
  }
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
  const localCost = cost, priorStart = residuals.length;
  const finalVelocity = raw.frames.at(-1)!.velocity;
  if (i < contacts.length - 1 && finalVelocity.x < 1) return {reason: 'unusable_arrival'} as Rejection;
  // Keep future catches physically accessible; this is an optimizer prior,
  // never a change to the scored result.
  cost += .01 * Math.max(0, -finalVelocity.x / Math.max(1, s.pace)) ** 2;
  cost = addArrivalPriors(s, finalVelocity, state, residuals, cost);
  return {achieved, actualImpact, residuals, cost, localCost, priorStart, motion, motionCost, finalVelocity};
}

/** Arrival speed and heading priors toward the next catch, and (in repair)
 * the distance to a reference arrival state. Appends residuals; returns the
 * cost with each term added in order. */
function addArrivalPriors(s: IntervalSearch, finalVelocity: {x: number; y: number}, state: any, residuals: number[], cost: number) {
  const {ctx, options, i, targets} = s;
  const {contacts, gaps, planned} = ctx;
  const nextImpact = i < contacts.length - 1 ? gaps[contacts[i + 1].gap].targets.impact ?? 0 : 0;
  // A strong next ask gets the same steep, kinetic arrival prior as a passive catch:
  // a whole-body hit needs speed into the surface, which a shallow arrival lacks.
  const steep = i < contacts.length - 1 && options.impactSearch?.steepArrivalFrom !== undefined && nextImpact >= options.impactSearch.steepArrivalFrom;
  if (i < contacts.length - 1 && (options.arrivalWeight ?? 0) > 0) {
    const nextSpeed = authoredSpeedToPx(planned[contacts[i + 1].gap + 1]?.targets.speed ?? targets.speed ?? .55);
    const passive = (options.passiveArrival && options.constructionRequests?.[i + 1]?.guidance === 'forbidden') || steep;
    // A passive catch redirects incoming speed into the next surface.
    // Prepare kinetic headroom for an unguided landing.
    // This is a proposal prior; actual native continuation decides merit.
    const impulse = impactToRawPx(nextImpact), arrivalSpeed = passive ? Math.hypot(nextSpeed, impulse) : nextSpeed;
    const desiredArrival = clamp(15 + deg(passive ? Math.atan2(impulse, nextSpeed) : impulse / nextSpeed), 20, 70);
    const weight = Math.sqrt(options.arrivalWeight ?? 0);
    const r1 = options.passiveArrival || steep ? weight * (deg(Math.atan2(finalVelocity.y, finalVelocity.x)) - desiredArrival) / 45 : 0;
    const r2 = weight * (Math.hypot(finalVelocity.x, finalVelocity.y) - arrivalSpeed) / 7.2;
    // A steep arrival must not come head-down or backward: the sled's nose-to-tail
    // axis past vertical, or pointing against the travel (uprightArrival).
    let r3 = 0;
    if (steep && options.impactSearch?.uprightArrival && state?.points) {
      const ax = state.points.NOSE.x - state.points.TAIL.x, ay = state.points.NOSE.y - state.points.TAIL.y, len = Math.hypot(ax, ay) || 1;
      const backward = Math.max(0, -(ax * finalVelocity.x + ay * finalVelocity.y) / (len * (Math.hypot(finalVelocity.x, finalVelocity.y) || 1)));
      const inverted = Math.max(0, -ax / len);   // past vertical: the nose points backward on screen
      r3 = weight * options.impactSearch.uprightArrival * (backward + inverted);
    }
    residuals.push(r1, r2, ...(options.impactSearch?.uprightArrival ? [r3] : []));
    cost += r1 * r1 + r2 * r2 + r3 * r3;
  }
  if (i < contacts.length - 1 && (options.headingWeight ?? 0) > 0 && !steep) {
    const angle = deg(Math.atan2(finalVelocity.y, finalVelocity.x));
    const r = Math.sqrt(options.headingWeight!) * Math.max(0, Math.abs(angle - 15) - 30) / 30;
    residuals.push(r);
    cost += r * r;
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
  return cost;
}

/** Turns a valid measurement into a candidate: arrival description, the
 * terminal loss of a final support, the learned future value, and the memo
 * entry. Updates `s.best`. */
function recordCandidate(s: IntervalSearch, c: ArcMotionControl, key: string, added: TrackLine[], child: Engine,
  fragments: Fragments | undefined, traced: Trace, measured: Exclude<ReturnType<typeof measureObjective>, Rejection>) {
  const {ctx, options, i, frame, horizon} = s;
  const {contacts, duration, gaps, impactTargets} = ctx;
  const {state, raw, det, observedImpacts} = traced;
  const {achieved, actualImpact, residuals, cost, localCost, priorStart, motion, motionCost, finalVelocity} = measured;
  const tail = state.points.TAIL, nose = state.points.NOSE, dx = nose.x - tail.x, dy = nose.y - tail.y;
  const angularRate = (dx * (nose.vy - tail.vy) - dy * (nose.vx - tail.vx)) / Math.max(1, dx * dx + dy * dy);
  const terminalImpacts = options.impactContract && i === contacts.length - 1
    ? impactAccountFor(options.impactContract).evaluate([...s.prefixImpactFrames!, ...observedImpacts!], impactTargets, duration, true) : undefined;
  const terminalLoss = i === contacts.length - 1
    ? arcDetectedTrajectoryObjective(det, gaps, options.amplitudeWeight, terminalImpacts).loss + motionCost / contacts.length : undefined;
  const release = raw.frames.slice().reverse().find(f => f.sledContacts.length)?.frame;
  const finalState = state.points;
  const heading = deg(Math.atan2(finalVelocity.y, finalVelocity.x)), endSpeed = Math.hypot(finalVelocity.x, finalVelocity.y);
  const pose = deg(Math.atan2(finalState.NOSE.y - finalState.TAIL.y, finalState.NOSE.x - finalState.TAIL.x));
  ctx.work.viableCandidates++;
  const valueFeatures = options.futureValueModel
    ? ctx.futureValueFeatures(arcArrivalFeatures(state, heading, endSpeed, pose, angularRate, horizon - (release ?? frame)), i) : undefined;
  const predictedFuture = options.futureValueModel ? arcFutureValue(valueFeatures!, options.futureValueModel) : undefined;
  const guided = arcValueGuidance(cost, localCost, residuals, priorStart, predictedFuture,
    i < contacts.length - 1 ? options.valueGuidanceWeight ?? 0 : 0);
  const result = {child, lines: added, c, cost, localCost, residuals: guided.residuals, optimizationCost: guided.cost,
    achieved, actualImpact, terminalLoss, release, railGuides: fragments?.guideIds, motion, motionCost,
    localResiduals: residuals.slice(0, priorStart), arrivalResiduals: residuals.slice(priorStart)};
  const {child: _child, ...measurement} = result;
  s.candidates.push({lines: added, c, cost, localCost, measurement,
    searchCost: cost, residuals, heading, endSpeed, pose, valueFeatures, predictedFuture, terminalLoss,
    meta: {achieved, impact: actualImpact, release: result.release, lines: added.length, railGuides: fragments?.guideIds, motion, motionCost}});
  // Interrupted evaluations never reach this cache insertion.
  const {child: _saved, ...saved} = result;
  s.memo.set(key, {result: saved, candidate: {...s.candidates.at(-1)}});
  if (!s.best || guided.cost < s.best.optimizationCost) s.best = result;
  return result;
}
