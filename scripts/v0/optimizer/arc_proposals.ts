/** Proposal sources for an interval search: the parametric centre, learned
 * policy proposals, remembered controls and responses, low-discrepancy
 * generic samples, and construction-specific families (opposing entries,
 * compact folds, observed receivers). Every proposal is measured by the
 * ordinary evaluator; none is accepted on its own authority. */
import { getPhysicsFrameCount } from '../../lib/detector.ts';
import type { ArcMotionControl } from './arc_geometry.ts';
import { arcControlProposals } from './arc_control_policy.ts';
import { allocateArcProposalSlots } from './arc_memory.ts';
import { arcControlValue, arcControlStep, arcResponseKeys } from './arc_motion_control.ts';
import { evaluate } from './arc_evaluate.ts';
import { retainSearch, type IntervalSearch } from './arc_interval_state.ts';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Guide permission, not an inactive clearance setting, determines which
 * initialization is physically appropriate for an unguided support. */
const guidedInitialization = (s: IntervalSearch) => s.options.guides !== false && !!s.options.channel;

/** The parametric starting curve: enter along the incoming direction and
 * turn by the angle the requested impact implies. */
export function centerControl(s: IntervalSearch): ArcMotionControl {
  const {incoming, turn, support} = s;
  const guided = guidedInitialization(s);
  const center = guided
    ? {entry: incoming - .5, turn: -turn, exit: clamp(incoming - turn, -70, 70), support, bias: 0, offset: .1}
    : {entry: incoming - Math.min(12, turn * .3), turn: -Math.min(35, turn * .7), exit: clamp(incoming - 25, -40, 45), support, bias: 0, offset: .1};
  if (guided && incoming < 15) {
    center.turn = Math.abs(center.turn);
    center.exit = clamp(incoming + turn, -70, 70);
  }
  return center;
}

/** The k-th low-discrepancy sample of the control space (golden-ratio and
 * other irrational strides), widened for independent guides, folds and
 * observed receivers when those constructions are requested. */
export function genericControl(s: IntervalSearch, k: number): ArcMotionControl {
  const {incoming, turn, support, constructionSpan, options} = s;
  const frac = (n: number) => ((k + 1) * n) % 1;
  const control: ArcMotionControl = {
    entry: incoming - (guidedInitialization(s) && k % 2 === 0 ? (-1 + frac(.61803398875) * 6) : (2 + frac(.61803398875) * Math.min(32, turn + 10))),
    turn: (k % 4 < 2 ? 1 : -1) * frac(.41421356237) * Math.min(60, turn + 25),
    exit: -45 + frac(.73205080757) * 110,
    support: support * (.45 + frac(.2360679775) * 1.2),
    bias: -1.5 + 3 * frac(.6457513111),
    offset: -.25 + frac(.3166247903) * 1.5,
    ...(options.railLayout === 'transfer' ? {mainEnd: .3 + .65 * frac(.6931471806)} : {})};
  if (options.guides !== false && options.independentGuide && k % 4 !== 0) {
    // Contact geometry is needed to FIND feasible constructions, not only
    // to refine an already valid one. Keep every fourth inherited sample.
    control.clearance = 8 + 14 * frac(.7548776662);
    control.guideTilt = -18 + 36 * frac(.5698402910);
    control.turnFraction = .15 + .65 * frac(.2718281828);
    if (options.railLayout === 'transfer' && k % 3 === 1)
      control.support = 2 * Math.pow(Math.max(1, (constructionSpan - 4) / 2), frac(.4384471872));
    if (options.profile === 'fold') {
      control.foldBend = (k % 2 ? 1 : -1) * (20 + 35 * frac(.3247179572));
      if (options.railLayout === 'transfer') control.foldTiming = k % 2 ? 1 : frac(.6931471806);
      // The first folded face is entry+turn; target that face's approach
      // directly rather than inheriting a smooth arc's five-frame turn.
      control.entry = incoming - control.turn - (1 + frac(.61803398875) * Math.min(25, turn + 5));
    }
  }
  if (options.railLayout === 'transfer' && k % 2 === 1) {
    control.receiverFlight = 1 + Math.floor(5 * frac(.2718281828));
    control.receiverEntry = -5 + 30 * frac(.7548776662);
    control.receiverTurn = -40 + 80 * frac(.5698402910);
    control.receiverExit = -60 + 130 * frac(.3247179572);
    control.receiverDuration = .25 + .7 * frac(.4384471872);
  }
  return control;
}

/** The warm start, then `initial` proposals: the centre, learned, remembered
 * and response proposals in their allocated slots, then generic samples. */
export function proposeInitialControls(s: IntervalSearch) {
  const {options, i, incoming, span, targets, impact, initial, controlMemory} = s;
  s.center = centerControl(s);
  const remembered = controlMemory.proposeControls(s.inputFeatures, incoming, span, options.memorySamples ?? 0,
    options.railLayout === 'transfer' ? 'both' : 'relative');
  const responses = controlMemory.proposeResponses(s.inputFeatures, incoming, span,
    [targets.air, targets.speed, targets.amplitude, impact], options.memoryResponseSamples ?? 0,
    {amplitude: options.amplitudeWeight ?? 1, impact: options.impactWeight ?? 2, damping: .0002, axisWeights: s.responseAxisWeights});
  // Startup has a different physical-state distribution from a later catch.
  // Its optional learned proposals still pass the ordinary interval search.
  const proposalModel = i === 0 ? options.controlPolicy?.startupModel : options.controlPolicy;
  const requested = [proposalModel ? options.policySamples ?? 8 : 0, remembered.length, responses.length];
  // The inherited model already covers ordinary arcs. Reserve new geometry
  // proposals where its training constructor differs from this request.
  const novelConstructor = !!options.profile || options.railLayout === 'transfer';
  const reservedGeneric = Math.ceil(initial * (novelConstructor ? .25 : 0));
  const counts = allocateArcProposalSlots(requested, Math.max(0, initial - 1 - reservedGeneric));
  const policy = counts[0] ? arcControlProposals(s.policyInputFeatures, incoming, span, proposalModel, counts[0]) : [];
  const learnedEnd = policy.length, memoryEnd = learnedEnd + Math.min(remembered.length, counts[1]);
  policy.push(...remembered.slice(0, counts[1]), ...responses.slice(0, counts[2]));
  if (options.warmStart) {
    evaluate(s, options.warmStart);
    if (options.warmIncoming !== undefined && options.warmIncoming !== incoming)
      evaluate(s, {...options.warmStart, entry: options.warmStart.entry + incoming - options.warmIncoming,
        exit: options.warmStart.exit + incoming - options.warmIncoming});
  }
  for (let k = 0; k < initial; k++) {
    const stream = k === 0 ? 'center' : k <= learnedEnd ? 'learned' : k <= memoryEnd ? 'memory' : k <= policy.length ? 'response' : 'generic';
    const accounting = s.ctx.work.initialProposalWork[stream], began = getPhysicsFrameCount();
    accounting.attempts++;
    try {
      if (evaluate(s, k > 0 && k <= policy.length ? policy[k - 1] : k === 0 ? s.center : genericControl(s, k))) accounting.viable++;
    } finally {
      accounting.physicsFrames += getPhysicsFrameCount() - began;
    }
    if (k % 10 === 9) retainSearch(s);
  }
}

/** Offer the same curve constructor from the opposite contact side. Both sides
 * compete under the same musical and physical checks; there is no scheduled
 * upper-hit request or different strength definition. */
export function proposeOpposingEntries(s: IntervalSearch) {
  const {options, i, initial, incoming} = s;
  if (!(i > 0 && initial > 0 && options.railLayout !== 'transfer' && (options.opposingEntryProposals ?? 0) > 0)) return;
  const work = s.ctx.work.opposingEntryWork;
  const began = getPhysicsFrameCount(), beforeFailures = {...s.failures};
  try {
    for (let k = 0; k < options.opposingEntryProposals!; k++) {
      const c = k === 0 ? s.center! : genericControl(s, k);
      work.attempts++;
      if (evaluate(s, {...c, contactSide: -1, entry: 2 * incoming - c.entry, turn: -c.turn, exit: 2 * incoming - c.exit,
        ...(c.foldBend === undefined ? {} : {foldBend: -c.foldBend}),
        ...(c.guideTilt === undefined ? {} : {guideTilt: -c.guideTilt})})) work.viable++;
      if (k % 8 === 7) retainSearch(s);
    }
    // Flush catches from above: a line along an upper edge of the rider's
    // outline meets both of its points at once (a sled point and the back,
    // say), so the push builds in one frame instead of spreading.
    const edges = upperOutlineEntries(Object.values(s.trace), incoming);
    for (let k = 0; edges.length && k < FLUSH_PROPOSALS; k++) {
      const c = genericControl(s, k), frac = (n: number) => ((k + 1) * n) % 1;
      work.attempts++;
      if (evaluate(s, {...c, contactSide: -1, entry: edges[k % edges.length] + (frac(.5772156649) - .5) * 4, turn: -c.turn, exit: 2 * incoming - c.exit,
        ...(c.foldBend === undefined ? {} : {foldBend: -c.foldBend}),
        ...(c.guideTilt === undefined ? {} : {guideTilt: -c.guideTilt})})) work.viable++;
    }
    retainSearch(s);
  } finally {
    work.physicsFrames += getPhysicsFrameCount() - began;
    for (const [key, count] of Object.entries(s.failures))
      work.failures[key] = (work.failures[key] ?? 0) + count - (beforeFailures[key] ?? 0);
  }
}

const FLUSH_PROPOSALS = 8;
/** Headings (degrees, along the travel) of the edges of the rider's convex
 * outline that face a surface above the travel direction `incoming`. */
export function upperOutlineEntries(points: Array<{x: number; y: number}>, incoming: number): number[] {
  const a = incoming * Math.PI / 180, up = {x: Math.sin(a), y: -Math.cos(a)}, along = {x: Math.cos(a), y: Math.sin(a)};
  // Monotone-chain hull, counter-clockwise in screen coordinates (y down).
  const ps = points.slice().sort((u, v) => u.x - v.x || u.y - v.y), cross = (o: any, p: any, q: any) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const half = (list: typeof ps) => {const h: typeof ps = []; for (const p of list) {while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p);} h.pop(); return h;};
  const hull = [...half(ps), ...half(ps.slice().reverse())], entries: number[] = [];
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i], q = hull[(i + 1) % hull.length], dx = q.x - p.x, dy = q.y - p.y, length = Math.hypot(dx, dy);
    if (length < 2) continue;
    // Outward normal of a counter-clockwise edge in y-down coordinates.
    const nx = dy / length, ny = -dx / length;
    if (nx * up.x + ny * up.y < .3) continue;
    const forward = dx * along.x + dy * along.y >= 0;
    entries.push(Math.atan2(forward ? dy : -dy, forward ? dx : -dx) * 180 / Math.PI);
  }
  return entries;
}

/** Short folded entries before a long runout, for folded transfer layouts. */
export function proposeCompactFolds(s: IntervalSearch) {
  const {options, support} = s;
  if (!(options.profile === 'fold' && options.railLayout === 'transfer' && s.initial > 0)) return;
  const anchor = s.best?.c ?? s.near[0]?.c ?? s.center;
  if (anchor) for (let k = 0; k < 16; k++) {
    const frac = (n: number) => ((k + 1) * n) % 1, duration = Math.max(2, support * (.65 + .7 * frac(.4384471872)));
    const control = {...anchor, support: duration, foldTiming: 1, turnFraction: Math.min(5, duration * .2) / duration,
      foldBias: -2 - 4 * frac(.6931471806), foldBend: -20 - 35 * frac(.3247179572), exit: -20 + 40 * frac(.7548776662),
      mainEnd: .4 + .55 * frac(.5698402910)};
    const accounting = s.ctx.work.initialProposalWork.compactFold, began = getPhysicsFrameCount();
    accounting.attempts++;
    try {
      if (evaluate(s, control)) accounting.viable++;
    } finally {
      accounting.physicsFrames += getPhysicsFrameCount() - began;
    }
  }
  retainSearch(s);
}

/** Receiving-curve variations around the best (or nearest) transfer support. */
export function proposeObservedReceivers(s: IntervalSearch) {
  const {options} = s;
  if (!(options.railLayout === 'transfer' && s.initial > 0)) return;
  const anchor = s.best?.c ?? s.near[0]?.c ?? s.center;
  if (anchor) for (let k = 0; k < 12; k++) {
    const frac = (n: number) => ((k + 1) * n) % 1;
    evaluate(s, {...anchor, receiverFlight: 1 + Math.floor(5 * frac(.2718281828)), receiverEntry: -5 + 30 * frac(.7548776662),
      receiverTurn: -40 + 80 * frac(.5698402910), receiverExit: -60 + 130 * frac(.3247179572), receiverDuration: .25 + .7 * frac(.4384471872)});
  }
  retainSearch(s);
}

/** With no valid curve yet, keep sampling: generic proposals mixed with
 * coordinate steps around the constructions that came closest. */
export function recoverInitialization(s: IntervalSearch) {
  const {options, i, frame} = s;
  if (!(!s.best && s.initial > 0 && (options.initialRecoverySamples ?? 0) > 0)) return;
  const began = getPhysicsFrameCount();
  const record = {index: i, frame, proposals: 0, viable: 0, physicalFrames: 0, bestConstructionDeficit: null as number | null, failures: {}};
  s.ctx.work.initializationRecovery.push(record);
  try {
    for (let k = 1; k <= options.initialRecoverySamples!; k++) {
      let proposal = genericControl(s, k);
      if (s.near.length && k % 3 !== 0) {
        const keys = arcResponseKeys(options.guides, {...options, observedReceiver: true});
        const trial = Math.floor(k * 2 / 3), key = keys[Math.floor(trial / 2) % keys.length];
        const anchor = s.near[Math.floor(trial / (2 * keys.length)) % Math.min(4, s.near.length)].c;
        const step = arcControlStep(key, 'coordinate', anchor.support) * Math.pow(.65, Math.floor(trial / (6 * keys.length)));
        proposal = {...anchor, [key]: arcControlValue(anchor, key, options.channel) + (trial % 2 ? -1 : 1) * step};
      }
      record.proposals++;
      if (evaluate(s, proposal)) record.viable++;
      if (k % 10 === 0) retainSearch(s);
    }
  } finally {
    record.physicalFrames = getPhysicsFrameCount() - began;
    record.bestConstructionDeficit = s.near[0]?.deficit ?? null;
    record.failures = {...s.failures};
  }
}
