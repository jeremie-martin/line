/** Experimental, shared impact measurement. Geometry/rail names and rider pose
 * classifications are deliberately absent. Frozen landing scoring is unchanged.
 * A contract revision changes identity, timing or strength and requires a fresh
 * baseline before compiler comparisons. */
import type {RawFrame, Vec2} from './detector.ts';

export const CONTACT_IMPACT_CONTRACT = Object.freeze({
  id: 'line.contact-impact.v1', status: 'experimental',
  responseFrames: 6, onsetFraction: .2, renewalValley: .4,
  veryStrong: 7.55, matchFrames: 4, quantizationFrames: .5,
} as const);
export type ContactImpactContract = {
  id: string; responseFrames: number; onsetFraction: number; renewalValley: number;
  veryStrong: number; matchFrames: number; quantizationFrames: number;
};
export type ContactImpactFrame = {
  frame: number; contact: boolean; bend: number; response: number;
  solverGain: number; gravityGain: number; speedBefore: number;
};
export type ContactImpactEvent = {
  contactStart: number; onset: number; end: number; peakFrame: number;
  raw: number; strength: number; responsePeak: number; complete: boolean;
};
export type ImpactTarget = {frame: number; impact?: number};
const norm = (v: Vec2) => Math.hypot(v.x, v.y);
export function velocityRedirection(a: Vec2, b: Vec2): number {
  const sa = norm(a), sb = norm(b);
  if (sa < 1e-10 || sb < 1e-10) return 0;
  return .5 * (sa + sb) * Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y));
}

/** The next pre-solve velocity minus gravity is this frame's effective velocity.
 * Consequently the path bend is measured on the physical collision frame, not
 * one frame later. Gravity is retained in the contacted path bend (a horizontal
 * support has zero bend), and separated only in the speed-gain diagnostic.
 * `contactAt` includes ALL actual collision points and must read cached physics.
 * The terminal effective state is already available to an interval search. */
export function observeContactImpacts(
  frames: readonly Pick<RawFrame, 'frame' | 'velocity'>[], contactAt: (frame: number) => boolean,
  terminalEffective?: Vec2, gravity: Vec2 = {x: 0, y: .175},
): ContactImpactFrame[] {
  return frames.map((row, i) => {
    if (!Number.isSafeInteger(row.frame) || row.frame < 0 || (i && row.frame !== frames[i - 1].frame + 1))
      throw new Error('impact observations require contiguous native frames');
    const incoming = row.velocity, next = frames[i + 1]?.velocity;
    if (!next && !terminalEffective) throw new Error('impact observations require a terminal effective state or a following velocity');
    const effective = next ? {x: next.x - gravity.x, y: next.y - gravity.y} : terminalEffective!;
    const previous = {x: incoming.x - gravity.x, y: incoming.y - gravity.y};
    if (![incoming.x, incoming.y, effective.x, effective.y, gravity.x, gravity.y].every(Number.isFinite))
      throw new Error('nonfinite impact observation');
    const contact = contactAt(row.frame);
    if (typeof contact !== 'boolean') throw new Error('impact contact observation must be boolean');
    return {frame: row.frame, contact, bend: row.frame ? velocityRedirection(previous, effective) : 0,
      response: row.frame ? velocityRedirection(incoming, effective) : 0,
      solverGain: norm(effective) - norm(incoming), gravityGain: norm(incoming) - norm(previous), speedBefore: norm(previous)};
  });
}
function validateContract(c: ContactImpactContract) {
  if (!Number.isSafeInteger(c.responseFrames) || c.responseFrames < 1 || !(c.onsetFraction > 0 && c.onsetFraction <= 1) ||
    !(c.renewalValley > 0 && c.renewalValley < 1) || !(c.veryStrong > 0) ||
    !(c.matchFrames > 0) || !(c.quantizationFrames >= 0 && c.quantizationFrames < c.matchFrames)) throw new Error('invalid impact contract');
}
/** Maximal physical contact engagements; a genuinely contact-free frame is a
 * boundary, even when the next receiver is only one frame away. Within ongoing
 * contact a renewed response after a substantial valley can be a second strike.
 * There is no global strength floor: tiny/quiet events have tiny/zero cost.
 * The bounded accumulation preserves multi-peak strikes and never borrows from
 * the next disconnected engagement. This is a working physical definition,
 * not a claim that magnitude alone establishes perceptual clarity. */
export function detectContactImpacts(frames: readonly ContactImpactFrame[], c: ContactImpactContract = CONTACT_IMPACT_CONTRACT): ContactImpactEvent[] {
  validateContract(c);
  for (const [i, f] of frames.entries()) if (!Number.isSafeInteger(f.frame) || (i && f.frame !== frames[i - 1].frame + 1) ||
    ![f.bend, f.response].every(x => Number.isFinite(x) && x >= 0) || typeof f.contact !== 'boolean') throw new Error('invalid impact frame');
  const events: ContactImpactEvent[] = [];
  for (let first = 0; first < frames.length;) {
    if (!frames[first].contact) {first++; continue;}
    let last = first;
    while (last + 1 < frames.length && frames[last + 1].contact) last++;
    const emit = (onset: number, contactStart: number) => {
      const end = Math.min(last, onset + c.responseFrames - 1);
      let raw = 0, peak = onset;
      for (let i = onset; i <= end; i++) {raw += frames[i].bend; if (frames[i].response > frames[peak].response) peak = i;}
      events.push({contactStart: frames[contactStart].frame, onset: frames[onset].frame, end: frames[end].frame,
        peakFrame: frames[peak].frame, raw, strength: Math.min(1, raw / c.veryStrong), responsePeak: frames[peak].response,
        complete: end - onset + 1 === c.responseFrames || last + 1 < frames.length});
      return {end, peak};
    };
    const leadingEnd = Math.min(last, first + c.responseFrames - 1);
    let peak = first;
    for (let i = first + 1; i <= leadingEnd; i++) if (frames[i].response > frames[peak].response) peak = i;
    let onset = first;
    while (onset < peak && frames[onset].response < c.onsetFraction * frames[peak].response) onset++;
    let prior = emit(onset, first), trough = prior.peak;
    for (let i = prior.peak + 1; i <= last; i++) {
      if (frames[i].response < frames[trough].response) trough = i;
      const value = frames[i].response;
      if (i <= prior.end || value <= 1e-9 || value < frames[i - 1].response || (i < last && value <= frames[i + 1].response)) continue;
      if (frames[trough].response > c.renewalValley * Math.min(frames[prior.peak].response, value)) continue;
      let start = i;
      while (start > Math.max(prior.end + 1, trough + 1) && frames[start - 1].response >= c.onsetFraction * value) start--;
      prior = emit(start, first); trough = prior.peak; i = prior.peak;
    }
    first = last + 1;
  }
  return events;
}

export type ContactImpactPrefix = {through: number; events: ContactImpactEvent[]; pending: ContactImpactFrame[]};
/** Cache only completed engagements. Re-evaluate the trailing open engagement
 * when continuation arrives, so incremental search and a cold full replay agree
 * even at a brief contact hole, a late peak or an interval boundary. */
export function contactImpactPrefix(frames: readonly ContactImpactFrame[], c: ContactImpactContract = CONTACT_IMPACT_CONTRACT): ContactImpactPrefix {
  let boundary = frames.length;
  while (boundary > 0 && frames[boundary - 1].contact) boundary--;
  return {through: frames.at(-1)?.frame ?? -1, events: detectContactImpacts(frames.slice(0, boundary), c), pending: frames.slice(boundary)};
}
export function continueContactImpacts(prefix: ContactImpactPrefix, frames: readonly ContactImpactFrame[], c: ContactImpactContract = CONTACT_IMPACT_CONTRACT) {
  if (frames.length && frames[0].frame !== prefix.through + 1) throw new Error('impact continuation must follow its cached prefix');
  return [...prefix.events, ...detectContactImpacts([...prefix.pending, ...frames], c)];
}

/** Monotone one-to-one matching. Maximize fulfilled requests within the declared
 * time window, then minimize strength/timing error plus unmatched response.
 * This prevents a tiny preliminary touch winning merely by being a little nearer.
 * The same accounting is used by local search and full-track judgment. */
export function accountContactImpacts(events: readonly ContactImpactEvent[], targets: readonly ImpactTarget[], c: ContactImpactContract = CONTACT_IMPACT_CONTRACT) {
  validateContract(c);
  if (events.some((e, i) => !Number.isFinite(e.onset) || !Number.isFinite(e.raw) || e.raw < 0 || (i && e.onset < events[i - 1].onset)) ||
    targets.some((t, i) => !Number.isFinite(t.frame) || (t.impact !== undefined && !(t.impact >= 0 && t.impact <= 1)) ||
      (i && t.frame <= targets[i - 1].frame))) throw new Error('invalid impact account');
  const n = events.length, m = targets.length, width = m + 1;
  const count = new Int32Array((n + 1) * width), cost = new Float64Array(count.length), choice = new Uint8Array(count.length);
  const eventCost = events.map(e => (e.raw / c.veryStrong) ** 2);
  const pair = (i: number, j: number) => {
    const e = events[i], t = targets[j], offset = e.onset - t.frame;
    const strengthError = t.impact === undefined ? 0 : e.strength - t.impact;
    const timingError = Math.max(0, Math.abs(offset) - c.quantizationFrames) / c.matchFrames;
    return {event: i, target: j, offset, strengthError, timingError, loss: strengthError ** 2 + timingError ** 2};
  };
  for (let i = 1; i <= n; i++) {cost[i * width] = cost[(i - 1) * width] + eventCost[i - 1]; choice[i * width] = 1;}
  for (let j = 1; j <= m; j++) {cost[j] = cost[j - 1] + 1; choice[j] = 2;}
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const k = i * width + j, up = k - width, left = k - 1, diagonal = up - 1;
    let matched = count[up], loss = cost[up] + eventCost[i - 1], how = 1;
    if (count[left] > matched || (count[left] === matched && cost[left] + 1 < loss)) {matched = count[left]; loss = cost[left] + 1; how = 2;}
    const p = pair(i - 1, j - 1);
    if (Math.abs(p.offset) <= c.matchFrames && (count[diagonal] + 1 > matched || (count[diagonal] + 1 === matched && cost[diagonal] + p.loss <= loss))) {
      matched = count[diagonal] + 1; loss = cost[diagonal] + p.loss; how = 3;
    }
    count[k] = matched; cost[k] = loss; choice[k] = how;
  }
  const matches: ReturnType<typeof pair>[] = [], unmatchedEvents: number[] = [], missingTargets: number[] = [];
  let i = n, j = m;
  while (i || j) {
    const how = choice[i * width + j];
    if (how === 3) {matches.push(pair(i - 1, j - 1)); i--; j--;}
    else if (how === 1) {unmatchedEvents.push(--i);} else {missingTargets.push(--j);}
  }
  matches.reverse(); unmatchedEvents.reverse(); missingTargets.reverse();
  const mass = Math.max(1, m), strengthMse = matches.reduce((s, p) => s + p.strengthError ** 2, 0) / mass;
  const timingMse = matches.reduce((s, p) => s + p.timingError ** 2, 0) / mass;
  const extraMse = unmatchedEvents.reduce((s, e) => s + eventCost[e], 0) / mass;
  return {contract: c.id, matches, unmatchedEvents, missingTargets, complete: missingTargets.length === 0,
    strengthMse, timingMse, extraMse, loss: strengthMse + timingMse + extraMse + missingTargets.length / mass};
}

/** Positive work over an entire engagement and its strongest contiguous part.
 * This complements the fixed short windows: a sequence of modest gains must not
 * vanish because each frame is small, nor because an earlier loss cancels it. */
export function contactSpeedGains(frames: readonly ContactImpactFrame[]) {
  const engagements: Array<{start: number; end: number; solverGain: number; gravityGain: number; speedBefore: number;
    strongest: {start: number; end: number; gain: number; speedBefore: number}}> = [];
  for (let first = 0; first < frames.length;) {
    if (!frames[first].contact) {first++; continue;}
    let last = first, solverGain = 0, gravityGain = 0, sum = 0, since = first;
    let strongest = {start: frames[first].frame, end: frames[first].frame, gain: 0, speedBefore: frames[first].speedBefore};
    while (last < frames.length && frames[last].contact) {
      const f = frames[last]; solverGain += f.solverGain; gravityGain += f.gravityGain;
      if (sum <= 0) {sum = 0; since = last;}
      sum += f.solverGain;
      if (sum > strongest.gain) strongest = {start: frames[since].frame, end: f.frame, gain: sum, speedBefore: frames[since].speedBefore};
      last++;
    }
    engagements.push({start: frames[first].frame, end: frames[last - 1].frame, solverGain, gravityGain, speedBefore: frames[first].speedBefore, strongest});
    first = last;
  }
  return engagements;
}
