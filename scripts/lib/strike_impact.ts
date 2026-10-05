/** line.strike.v1 / v2 / v3 — the impact account: what the eye reads as a hit on the beat.
 * v2 differs from v1 only in strength (below). v3 is v2 plus one identity rule:
 * opposite pushes are separate impacts (below).
 *
 * Everything derives from one physical signal: the rider's 10-point centre of mass
 * (equal point masses), whose velocity is exactly ballistic whenever nothing
 * touches the rider. Per native frame f:
 *   J[f]    = |V[f] − V[f−1] − g|          contact acceleration (0 in free flight)
 *   bend[f] = ½(|V[f−1]|+|V[f]|)·|∠(V[f−1],V[f])|   redirection (contacted frames)
 *
 * Events
 *  - Engagement: a maximal run of frames with any rider point in contact. A
 *    contact-free frame always separates engagements; each start is an event
 *    (a touchdown, however gentle — quiet beats are matched by gentle touchdowns).
 *  - Strike renewal: inside an engagement a new event starts at a peak of the
 *    3-frame smoothed J of at least `floor`, at least `spacing` frames (100 ms)
 *    after the previous peak, whose preceding valley is at most `valley` × that
 *    NEW peak. A strike after a weak touch is never hidden; the solver's
 *    frame-to-frame contact chatter is fused, as the eye fuses it.
 *  - Opposite pushes (v3): inside an engagement a new event also starts at a frame
 *    whose contact push (the travel part of the impulse, at least `floor`) points
 *    more than acos(−`reversalCos`) away from the push at the current event's
 *    reference frame (also at least `floor`): its start, until a higher smoothed
 *    maximum moves the reference to that peak. a floor hit followed by an upper-rail hit is
 *    two impacts, as the eye sees it, however close together. A corner (about
 *    90°) does not split.
 *  - Steering: contact that never forms such a peak is not an event and costs
 *    nothing in this account (unwanted speed gain is accounted separately).
 * Timing: the half-rise frame, where J first reaches half of the event's peak —
 *   when the hit visibly begins. The peak frame is recorded too.
 * Strength, v1: Σ bend over the event's own frames (at most `window`, never past the
 *   next event), scaled so `veryStrong` = 1 (7.55: the established felt ruler; the
 *   centre-of-mass kernel reads within 1.5% of the earlier body-mean kernel).
 * Strength, v2: how much contact changes the rider's whole-body motion, its travel
 *   and its spin. Per frame the contact impulse is (V[f] − V[f−1] − g,
 *   ΔL / (N·R)): L is the angular momentum Σ r × v about the centre of mass, R the
 *   radius of gyration, so spin is in the same px/frame units. Both parts are 0 in
 *   free flight (L up to the solver's sequential-correction residual, median
 *   0.003 px/frame). Strength is the largest |impulse summed over
 *   `strengthWindow` frames| from the onset over the event's own frames (at most
 *   `window`), ÷ `veryStrong`. A head-on stop counts as fully as a turn, a smooth
 *   bend counts little in any 50 ms, and a spin reversal counts. Chosen on the
 *   owner's blind pair judgments: 46/63 against v1's 31/63 (docs/research/
 *   strike-definition-20261004.md).
 * Account: monotone one-to-one matching of events to authored beats within
 *   `matchFrames`, maximizing fulfilled beats, then minimizing strength error²
 *   + timing error² + Σ unmatched strength² + missing beats (shared with v1).
 *
 * Geometry names, line roles and rider posture are deliberately absent. */
import {accountContactImpacts, type ContactImpactEvent, type ImpactTarget} from './contact_impact.ts';

export type StrikeContract = Readonly<{id: string; gravity: number; floor: number; valley: number; spacing: number;
  halfRise: number; window: number; veryStrong: number; strength: 'redirection' | 'motion'; strengthWindow: number;
  split: 'none' | 'reversal'; reversalCos: number}>;
export const STRIKE_CONTRACT: StrikeContract = Object.freeze({
  id: 'line.strike.v1', gravity: 0.175, floor: 0.8, valley: 0.5, spacing: 4, halfRise: 0.5, window: 6, veryStrong: 7.55,
  strength: 'redirection', strengthWindow: 0, split: 'none', reversalCos: 0,
});
export const STRIKE_V2_CONTRACT: StrikeContract = Object.freeze({...STRIKE_CONTRACT, id: 'line.strike.v2', strength: 'motion', strengthWindow: 2});
export const STRIKE_V3_CONTRACT: StrikeContract = Object.freeze({...STRIKE_V2_CONTRACT, id: 'line.strike.v3', split: 'reversal', reversalCos: -.5});
export type StrikeFrame = {frame: number; contact: boolean; J: number; bend: number;
  /** v2 only: the whole-body contact impulse (travel x, travel y, spin) in px/frame. */
  impulse?: readonly [number, number, number];
  /** Speed change not explained by gravity, the gravity-only change, and the speed before the solve
   * (same meaning as the contact-impact frames, so the speed-gain account is shared). */
  solverGain: number; gravityGain: number; speedBefore: number};
export type StrikeEvent = ContactImpactEvent & {kind: 'touchdown' | 'strike'; peakJ: number};
type Vec = {x: number; y: number};
type PointState = {x: number; y: number; prevX: number; prevY: number};

/** Centre-of-mass velocity of a rider state (all ten points, equal mass). */
export function centreVelocity(state: {points: Record<string, PointState>}): Vec {
  let x = 0, y = 0, n = 0;
  for (const p of Object.values(state.points)) {x += p.x - p.prevX; y += p.y - p.prevY; n++;}
  if (n !== 10) throw new Error('strike observation expects the ten rider points');
  return {x: x / n, y: y / n};
}
/** Centre-of-mass velocity, angular momentum about the centre (Σ r × v, unit
 * masses) and radius of gyration of a rider state. */
export function bodyMotion(state: {points: Record<string, PointState>}) {
  const points = Object.values(state.points);
  if (points.length !== 10) throw new Error('strike observation expects the ten rider points');
  let cx = 0, cy = 0, vx = 0, vy = 0;
  for (const p of points) {cx += p.x; cy += p.y; vx += p.x - p.prevX; vy += p.y - p.prevY;}
  cx /= 10; cy /= 10; vx /= 10; vy /= 10;
  let L = 0, R2 = 0;
  for (const p of points) {
    const rx = p.x - cx, ry = p.y - cy;
    L += rx * (p.y - p.prevY - vy) - ry * (p.x - p.prevX - vx); R2 += rx * rx + ry * ry;
  }
  return {v: {x: vx, y: vy}, L, R: Math.sqrt(R2 / 10)};
}
function redirection(a: Vec, b: Vec) {
  const sa = Math.hypot(a.x, a.y), sb = Math.hypot(b.x, b.y);
  if (sa < 1e-10 || sb < 1e-10) return 0;
  return .5 * (sa + sb) * Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y));
}
/** `velocities[k]` is the centre velocity at frame `first + k − 1`: one frame before
 * the observed range, so the first frame's change is known. */
export function observeStrikes(first: number, velocities: readonly Vec[], contactAt: (frame: number) => boolean, c: StrikeContract = STRIKE_CONTRACT): StrikeFrame[] {
  const out: StrikeFrame[] = [];
  for (let k = 1; k < velocities.length; k++) {
    const a = velocities[k - 1], b = velocities[k], frame = first + k - 1;
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) throw new Error('nonfinite strike observation');
    const free = Math.hypot(a.x, a.y + c.gravity), before = Math.hypot(a.x, a.y);
    out.push({frame, contact: contactAt(frame), J: Math.hypot(b.x - a.x, b.y - a.y - c.gravity), bend: redirection(a, b),
      solverGain: Math.hypot(b.x, b.y) - free, gravityGain: free - before, speedBefore: before});
  }
  return out;
}

/** v2 observation: `motions[k]` (from bodyMotion) is the state at frame `first + k − 1`. */
export function observeMotion(first: number, motions: ReadonlyArray<ReturnType<typeof bodyMotion>>, contactAt: (frame: number) => boolean,
  c: StrikeContract = STRIKE_V2_CONTRACT): StrikeFrame[] {
  return observeStrikes(first, motions.map(m => m.v), contactAt, c).map((f, k) => {
    const a = motions[k], b = motions[k + 1];
    return {...f, impulse: [b.v.x - a.v.x, b.v.y - a.v.y - c.gravity, (b.L - a.L) / (10 * (a.R + b.R) / 2)] as const};
  });
}

export function detectStrikes(frames: readonly StrikeFrame[], c: StrikeContract = STRIKE_CONTRACT): StrikeEvent[] {
  for (const [i, f] of frames.entries()) if (i && f.frame !== frames[i - 1].frame + 1) throw new Error('strike frames must be contiguous');
  const events: StrikeEvent[] = [];
  for (let first = 0; first < frames.length;) {
    if (!frames[first].contact) {first++; continue;}
    let last = first;
    while (last + 1 < frames.length && frames[last + 1].contact) last++;
    const S = (i: number) => .25 * frames[Math.max(first, i - 1)].J + .5 * frames[i].J + .25 * frames[Math.min(last, i + 1)].J;
    const starts: Array<{at: number; kind: 'touchdown' | 'strike'}> = [{at: first, kind: 'touchdown'}];
    // Walk the local maxima of the smoothed force in order. A maximum either renews
    // (a new strike) or, if it is higher than the current strike's peak, moves it.
    let peak = first;
    const push = (i: number) => {
      const p = frames[i].impulse;
      if (!p) throw new Error('opposite-push separation needs whole-body impulses (observeMotion)');
      return p;
    };
    for (let i = first + 1; i <= last; i++) {
      if (c.split === 'reversal') {
        const a = push(peak), b = push(i), na = Math.hypot(a[0], a[1]), nb = Math.hypot(b[0], b[1]);
        if (na >= c.floor && nb >= c.floor && (a[0] * b[0] + a[1] * b[1]) / (na * nb) < c.reversalCos) {
          starts.push({at: i, kind: 'strike'}); peak = i; continue;
        }
      }
      const value = S(i);
      if (!(value >= S(i - 1) && (i === last || value > S(i + 1)))) continue;
      let trough = peak;
      for (let k = peak + 1; k < i; k++) if (S(k) < S(trough)) trough = k;
      if (value >= c.floor && i - peak >= c.spacing && trough > peak && S(trough) <= c.valley * value) {
        let start = i;
        while (start > trough + 1 && S(start - 1) > S(trough)) start--;
        starts.push({at: start, kind: 'strike'}); peak = i;
      } else if (value > S(peak)) peak = i;
    }
    for (const [k, s] of starts.entries()) {
      const stop = Math.min(k + 1 < starts.length ? starts[k + 1].at - 1 : last, s.at + c.window - 1);
      let top = s.at, raw = 0;
      for (let i = s.at; i <= stop; i++) {raw += frames[i].bend; if (frames[i].J > frames[top].J) top = i;}
      let half = s.at;
      while (half < top && frames[half].J < c.halfRise * frames[top].J) half++;
      if (c.strength === 'motion') raw = motionChange(frames, half, stop, c.strengthWindow);
      events.push({kind: s.kind, contactStart: frames[s.at].frame, onset: frames[half].frame, end: frames[stop].frame,
        peakFrame: frames[top].frame, peakJ: frames[top].J, responsePeak: frames[top].J, raw, strength: Math.min(1, raw / c.veryStrong),
        complete: stop - s.at + 1 === c.window || stop < last || last + 1 < frames.length});
    }
    first = last + 1;
  }
  return events;
}

/** Largest |impulse summed over `span` consecutive frames| within [from, to]; a
 * shorter event is its own window. */
function motionChange(frames: readonly StrikeFrame[], from: number, to: number, span: number) {
  const w = Math.min(span, to - from + 1);
  let best = 0;
  for (let a = from; a + w - 1 <= to; a++) {
    let x = 0, y = 0, z = 0;
    for (let i = a; i < a + w; i++) {
      const p = frames[i].impulse;
      if (!p) throw new Error('motion strength needs whole-body impulses (observeMotion)');
      x += p[0]; y += p[1]; z += p[2];
    }
    best = Math.max(best, Math.hypot(x, y, z));
  }
  return best;
}

export type StrikePrefix = {through: number; events: StrikeEvent[]; pending: StrikeFrame[]};
/** Cache only completed engagements; the open one is re-detected when the
 * continuation arrives, so incremental search and a cold replay agree. */
export function strikePrefix(frames: readonly StrikeFrame[], c: StrikeContract = STRIKE_CONTRACT): StrikePrefix {
  let boundary = frames.length;
  while (boundary > 0 && frames[boundary - 1].contact) boundary--;
  return {through: frames.at(-1)?.frame ?? -1, events: detectStrikes(frames.slice(0, boundary), c), pending: frames.slice(boundary)};
}
export function continueStrikes(prefix: StrikePrefix, frames: readonly StrikeFrame[], c: StrikeContract = STRIKE_CONTRACT) {
  if (frames.length && frames[0].frame !== prefix.through + 1) throw new Error('strike continuation must follow its cached prefix');
  return [...prefix.events, ...detectStrikes([...prefix.pending, ...frames], c)];
}

export function accountStrikes(events: readonly StrikeEvent[], targets: readonly ImpactTarget[], c: StrikeContract = STRIKE_CONTRACT) {
  return {...accountContactImpacts(events, targets), contract: c.id};
}

/** Complete evaluation of a ride: events up to the authored end, the account, and
 * validity (survived, every beat matched, every matched event fully observed). */
export function evaluateStrikes(frames: readonly StrikeFrame[], targets: readonly ImpactTarget[], duration: number, survived: boolean,
  c: StrikeContract = STRIKE_CONTRACT) {
  const events = detectStrikes(frames, c).filter(e => e.onset <= duration), account = accountStrikes(events, targets, c);
  return {contract: c.id, events, targets, account,
    valid: survived && account.complete && account.matches.every(m => events[m.event].complete)};
}
