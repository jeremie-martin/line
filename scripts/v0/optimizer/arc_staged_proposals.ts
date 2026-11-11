/** Experimental conditional proposals. Partial replays only allocate search
 * effort: they never enter candidate memoization, ranking, or local search.
 * Each probe installs a COMPLETE provisional curve on the incoming prefix.
 * Changed controls restart there; no assumption of causal stage separation. */
import {boundThroughMetered, extractRawTrajectoryWindow, getBallisticStateMetered,
  getPhysicsFrameCount, matchesBallisticStateMetered} from '../../lib/detector.ts';
import {bodyMotion} from '../../lib/strike_impact.ts';
import {authoredSpeedToPx, impactToRawPx} from '../types.ts';
import {motionArcPaths, receiverPoints, type ArcMotionControl} from './arc_geometry.ts';
import {evaluate, steepArrival} from './arc_evaluate.ts';
import {impactRuler} from './impact_accounts.ts';
import {retainSearch, type IntervalSearch} from './arc_interval_state.ts';

const deg = (x: number) => x * 180 / Math.PI;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
type Probe = {c: ArcMotionControl; score: number; heading: number; vy: number; vx: number;
  uncertain: boolean; contact: boolean; released: boolean; contactFraction: number; pose: number};

/** Only ordinary smooth, unguided catches; startup and authored construction
 * families retain their existing sources, including scattered carriers. */
export function stagedProposalSlots(s: IntervalSearch, available: number) {
  const o = s.options, request = o.constructionRequests?.[s.i];
  if (s.i === 0 || o.profile || o.faces !== undefined || o.railLayout === 'transfer' ||
    !(o.guides === false || !o.channel) || (request && request.construction !== 'arcs')) return 0;
  const slots = Math.min(available, (o.policySamples ?? 0) + (o.memorySamples ?? 0));
  const h = s.horizon - s.frame + 1;
  // Leave tiny allocations on the inherited source: a useful beam needs
  // at least four entries, one redirect each, and one full trial each.
  return slots * h >= 4 * h + (24 * Math.min(h, 9) + 48 * Math.min(h, 20)) / 6 ? slots : 0;
}

/** All native advancement uses the evaluator's meter, including rollback to
 * frame-1. Raw/strike observations read only the already integrated window.
 * No retained engine or borrowed native array escapes this function. */
export function probeStagedControl(s: IntervalSearch, control: ArcMotionControl, cutoff: number): Probe | null {
  const c = s.normalizeControl(control), o = s.options;
  const paths = motionArcPaths(receiverPoints(s.trace, c.contactSide), s.velocity, c,
    1000 + s.i * 10000, o.channel, o.radius, undefined, o);
  const count = paths.reduce((n, p) => n + Math.max(0, p.points.length - 1), 0);
  if (!count || count >= 10000) return null;
  const child = s.engine.addSolidPaths(paths);
  try {
    if (!matchesBallisticStateMetered(child, s.frame - 1, s.beforeState) ||
      !boundThroughMetered(child, cutoff)) return null;
    const state = getBallisticStateMetered(child, cutoff), motion = bodyMotion(state);
    const raw = extractRawTrajectoryWindow(child, s.frame, cutoff).frames;
    const observed = impactRuler.observe(child, raw);
    const events = impactRuler.continue(s.impactPrefix, observed);
    const event = events.filter(e => e.contactStart >= s.frame - impactRuler.matchFrames)
      .sort((a, b) => Math.abs(a.peakFrame - s.frame) - Math.abs(b.peakFrame - s.frame))[0];
    const first = observed.find(f => f.contact), contact = !!first;
    const uncertain = !event || !event.complete;
    const speed = Math.hypot(motion.v.x, motion.v.y), heading = deg(Math.atan2(motion.v.y, motion.v.x));
    // Missing/unfinished V3 events are weak evidence, never hard rejections.
    // Timing, retained speed and rotation temper the provisional strength fit.
    const impactError = event && s.impact !== undefined ? Math.abs(event.strength - s.impact) : .25;
    const rotation = Math.abs(motion.L) / Math.max(1, 10 * motion.R * motion.R);
    const ax = state.points.NOSE.x - state.points.TAIL.x, ay = state.points.NOSE.y - state.points.TAIL.y;
    const pose = Math.max(0, -ax / Math.max(1, Math.hypot(ax, ay)));
    const contactFraction = observed.filter(f => f.contact).length / Math.max(1, observed.length);
    const released = contact && !observed.at(-1)?.contact;
    const score = (uncertain ? .5 : 1) * impactError + (first ? .02 * Math.abs(first.frame - s.frame) : .2) +
      .2 * Math.max(0, 1 - speed / Math.max(1, s.pace)) + .1 * rotation + .1 * pose;
    return {c, score, heading, vx: motion.v.x, vy: motion.v.y, uncertain, contact, released, contactFraction, pose};
  } finally {
    child.dispose();
  }
}

/** Round-robin among physical side/heading/contact bins, then fill by score.
 * Stable ordering breaks ties deterministically; this is proposal pruning only. */
function survivors(probes: Probe[]) {
  const ordered = probes.sort((a, b) => a.score - b.score), chosen: Probe[] = [], bins = new Set<string>();
  // Keep the best surviving representative of each physical contact side.
  for (const side of [1, -1]) {
    const p = ordered.find(p => (p.c.contactSide ?? 1) === side);
    if (p) {chosen.push(p); bins.add(`${side}:${Math.floor(p.heading / 30)}:${p.contact}`);}
  }
  for (const p of ordered) {
    const bin = `${p.c.contactSide ?? 1}:${Math.floor(p.heading / 30)}:${p.contact}`;
    if (!bins.has(bin)) {chosen.push(p); bins.add(bin);}
    if (chosen.length === 4) return chosen;
  }
  for (const p of ordered) if (!chosen.includes(p)) {
    chosen.push(p);
    if (chosen.length === 4) break;
  }
  return chosen;
}

/** Replace vacated archive slots, rather than adding to initialization.
 * Maxima are 24 entry, 12 redirect/parent, 8 runout/parent. Reserve four
 * runouts first; on short spans reduce the partial grids to fit. Then spend
 * the remaining full-trial equivalents on a balanced runout grid. Actual
 * work (including invalidated prefix frames) is reported by the normal meter.
 * The compiler's existing hard allowance remains authoritative. */
export function proposeStagedControls(s: IntervalSearch, slots: number) {
  if (slots < 4 || !s.center) return;
  const h = s.horizon - s.frame + 1, entryFrames = Math.min(h, 9), redirectFrames = Math.min(h, 20);
  const allowance = slots * h;
  const scale = Math.min(1, Math.max(0, allowance - 4 * h) / (24 * entryFrames + 48 * redirectFrames));
  const entryCount = 2 * Math.floor(12 * scale), redirectCount = Math.floor(12 * scale);
  if (entryCount < 4 || redirectCount < 1) return;
  const began = getPhysicsFrameCount(), work = s.ctx.work.initialProposalWork.staged;
  const entries: Probe[] = [], redirects: Probe[] = [];
  const probe = (c: ArcMotionControl, cutoff: number, into: Probe[]) => {
    work.attempts++;
    const stage = s.ctx.work.initialProposalWork[into === entries ? 'stagedEntry' : 'stagedRedirect'];
    const start = getPhysicsFrameCount();
    stage.attempts++;
    try {
      const p = probeStagedControl(s, c, cutoff);
      if (p) {into.push(p); stage.viable++;}
    } finally {stage.physicsFrames += getPhysicsFrameCount() - start;}
  };
  try {
    const angle = deg(Math.asin(Math.min(.95, impactToRawPx(s.impact ?? .1) / Math.max(1, s.pace))));
    const angles = [1, angle * .5, angle, angle + 5, angle + 12, Math.max(2, angle - 5)];
    for (let k = 0; k < entryCount; k++) {
      const side = k % 2 ? -1 : 1, bracket = Math.floor(Math.floor(k / 2) * 12 / (entryCount / 2));
      probe({...s.center, contactSide: side, entry: s.incoming - side * angles[Math.floor(bracket / 2)],
        offset: bracket % 2 ? .5 : .1}, Math.min(s.horizon, s.frame + 8), entries);
    }
    for (const p of survivors(entries)) for (let k = 0; k < redirectCount; k++) {
      const turns = [-Math.max(5, s.turn), 0, Math.max(5, s.turn)], cell = Math.floor(k * 12 / redirectCount);
      probe({...p.c, turn: turns[Math.floor(cell / 4)], turnFraction: (cell % 2 ? 5 : 2) / p.c.support,
        bias: Math.floor(cell / 2) % 2 ? .7 : -.7}, Math.min(s.horizon, s.frame + 19), redirects);
    }
    const kept = survivors(redirects);
    // Same desired-arrival angle as the existing kinetic arrival prior. This
    // only proposes an exit; the authoritative full objective is unchanged.
    const {contacts, gaps, planned} = s.ctx, next = contacts[s.i + 1];
    const nextImpact = next ? gaps[next.gap].targets.impact ?? 0 : 0;
    const nextSpeed = authoredSpeedToPx((next ? planned[next.gap + 1]?.targets.speed : undefined) ?? s.targets.speed ?? .55);
    const kinetic = s.options.passiveArrival && s.options.constructionRequests?.[s.i + 1]?.guidance === 'forbidden'
      ? 1 : steepArrival(nextImpact, s.options.impactSearch);
    const impulse = impactToRawPx(nextImpact);
    const desired = clamp(15 + deg((1 - kinetic) * impulse / nextSpeed + kinetic * Math.atan2(impulse, nextSpeed)), 20, 70);
    const trials = Math.min(8, Math.max(0, Math.floor((allowance - (getPhysicsFrameCount() - began)) / Math.max(1, kept.length * h))));
    // Spread reduced grids through the cube instead of keeping one face.
    const grid = [0, 7, 3, 4, 1, 6, 2, 5];
    for (let k = 0; k < trials; k++) for (const p of kept) {
      const bits = grid[k], support = s.support * (bits & 2 ? 1.2 : .8);
      const flight = Math.max(0, h - support);
      const ballistic = deg(Math.atan2(p.vy + .175 * flight, p.vx));
      const exit = clamp(p.heading + desired - ballistic + (bits & 1 ? 12 : -12), -70, 70);
      work.attempts++;
      const stage = s.ctx.work.initialProposalWork.stagedRunout, start = getPhysicsFrameCount();
      stage.attempts++;
      try {
        if (evaluate(s, {...p.c, exit, support, bend: bits & 4 ? 12 : -12,
          turnFraction: (p.c.turnFraction ?? Math.min(5, p.c.support / 2) / p.c.support) * p.c.support / support})) {
          work.viable++; stage.viable++;
        }
      } finally {stage.physicsFrames += getPhysicsFrameCount() - start;}
    }
  } finally {
    work.physicsFrames += getPhysicsFrameCount() - began;
    retainSearch(s);
  }
}
