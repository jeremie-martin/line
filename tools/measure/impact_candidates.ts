/** Research candidates for impact strength, beside line.strike.v1 (`strike`)
 * and the rigid-motion-change candidate (tools/measure/motion_change.ts). The
 * product account is line.strike.v3; nothing here is an objective. Rationale,
 * failure modes and evidence: docs/research/impact-candidates-20261004.md.
 *
 * Signals (10-point centre of mass, equal masses, exactly ballistic in flight):
 *   V[f]      centre-of-mass velocity; imp[f] = V[f] − V[f−1] − g, the contact impulse
 *   v_p[f]    velocity of rider point p
 *   n(ℓ)      unit normal INTO line ℓ (the engine's collision normal: a point moving
 *             along +n through ℓ is pushed back along −n)
 *   ΔL[f]     change of angular momentum about the centre of mass, ÷ (N·R) → px/frame
 *
 * Candidates, per strike event (identity from scripts/lib/strike_impact.ts), ÷ 7.55
 * like the strike account:
 *   c_arrive       how fast the rider drove into a surface, as far as the surface
 *                  stopped it. For each contact frame f in the event and line ℓ touched
 *                  at f, with points P:
 *                    n = normal of the most aligned line touched at f−1 if within
 *                        ARRIVAL.deg (same surface: a curve, or the body coming down
 *                        where the sled already is), else n(ℓ) (fresh: a touchdown, a
 *                        corner, the rail on the other side);
 *                    a = max_{p∈P} (v_p[f−1] + g)·n          arrival speed
 *                    b = fresh ? 0 : max(0, −imp[f−1]·n)      push already acting
 *                    s = Σ_{k=f..f+stopFrames−1, unbroken contact} max(0, −imp[k]·n − b)
 *                    value = max(0, min(a, s)).
 *                  Event value: the strongest arrival in [contactStart, end].
 *   c_arrive_spin  hypot(c_arrive, largest 2-frame |ΔL|/(N·R) in the event / 7.55).
 *   c_loss         ground-frame energy: √(2·max(0, Σ_event ½(|V[f−1]+g|² − |V[f]|²))),
 *                  the centre-of-mass speed whose kinetic energy contact destroyed.
 *                  Kept as a measured negative result (friction braking at speed reads
 *                  as a slam; contact that speeds the rider up reads zero).
 * Diagnostics: arriveAt (frame of the strongest arrival); arrivals (distinct impacts:
 * the strongest arrival plus fresh arrivals ≥ 0.1 facing the other way or 2+ frames
 * later — floor then rail = 2); arrive2 (the second); crisp (the strongest arrival's
 * stop ÷ the event's total contact impulse); spin; rotBefore / rotAfter (signed L/(N·R)
 * the frame before contact and at the event's end: a sign change is a reversal); mcOwn (motion_change's kernel clipped to the event's own frames).
 *
 *   node --import tsx tools/measure/impact_candidates.ts [--sets=july,current,strike] [--out=FILE.jsonl]
 *   node --import tsx tools/measure/impact_candidates.ts --probes      (hand-built tracks) */
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {OUT, sources, observe} from './observe.ts';
import {strikeFrames, detectStrikes} from './strike.ts';
import {motionChanges} from './motion_change.ts';

const G = 0.175, SCALE = 7.55, N = 10, DISTINCT = 0.1;
/** Surface continuity (a smaller turn between frames is the same surface) and the frames
 * over which an arrival's stop is counted; the CLI reports sensitivity to both. */
export const ARRIVAL = {deg: 20, stopFrames: 3};
type V2 = {x: number; y: number};
const dot = (a: V2, b: V2) => a.x * b.x + a.y * b.y;

/** Whole-body series; index f holds the state at f, or the change from f−1 to f. */
export function bodySeries(o: any) {
  const V: V2[] = [], L: number[] = [], R: number[] = [];
  for (const fr of o.frames) {
    let cx = 0, cy = 0, vx = 0, vy = 0;
    for (const [x, y, px, py] of fr.points) {cx += x; cy += y; vx += x - px; vy += y - py;}
    cx /= N; cy /= N; vx /= N; vy /= N;
    let l = 0, r2 = 0;
    for (const [x, y, px, py] of fr.points) {const rx = x - cx, ry = y - cy; l += rx * (y - py - vy) - ry * (x - px - vx); r2 += rx * rx + ry * ry;}
    V.push({x: vx, y: vy}); L.push(l); R.push(Math.sqrt(r2 / N));
  }
  const imp: V2[] = [{x: 0, y: 0}], spin = [0], loss = [0];
  for (let f = 1; f < V.length; f++) {
    const free = {x: V[f - 1].x, y: V[f - 1].y + G};
    imp.push({x: V[f].x - free.x, y: V[f].y - free.y});
    spin.push((L[f] - L[f - 1]) / (N * (R[f] + R[f - 1]) / 2));
    loss.push(.5 * (dot(free, free) - dot(V[f], V[f])));
  }
  // rot: signed spin as the speed of rotation at the radius of gyration, L / (N·R), px/frame.
  return {V, imp, spin, loss, rot: L.map((l, f) => l / (N * R[f]))};
}

/** Unit normal into every line, as the engine collides (scripts/lib/native_motion/src/line.rs). */
export function lineNormals(track: any): Map<number, V2> {
  const m = new Map<number, V2>();
  for (const l of track.lines) {
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy) || 1, s = l.flipped ? -1 : 1;
    m.set(l.id, {x: -dy / len * s, y: dx / len * s});
  }
  return m;
}

export type Arrival = {frame: number; n: V2; approach: number; stopped: number; value: number; fresh: boolean};
/** Every surface arrival of a ride, one per contact frame and touched line. */
export function arrivals(o: any, normals: Map<number, V2>, body = bodySeries(o), opts = ARRIVAL): Arrival[] {
  const same = Math.cos(opts.deg * Math.PI / 180), out: Arrival[] = [];
  const touched = (f: number) => {
    const m = new Map<number, number[]>();
    for (const [id, p] of o.frames[f].collisions) {const ps = m.get(id) ?? []; if (!ps.includes(p)) ps.push(p); m.set(id, ps);}
    return m;
  };
  let before = new Map<number, number[]>();
  for (let f = 1; f < o.frames.length; f++) {
    const now = touched(f), prev = [...before.keys()].map(id => normals.get(id)!);
    for (const [id, points] of now) {
      const nl = normals.get(id)!;
      let n = nl, best = same, fresh = true;
      for (const p of prev) if (dot(p, nl) >= best) {best = dot(p, nl); n = p; fresh = false;}
      // Arrival speed: the fastest touching point's free-flight velocity into the surface.
      let approach = -Infinity;
      for (const p of points) {const [x, y, px, py] = o.frames[f - 1].points[p]; approach = Math.max(approach, (x - px) * n.x + (y - py + G) * n.y);}
      // Stopped: the centre of mass's normal impulse over the next stopFrames frames of
      // unbroken contact, in excess of the push this surface already gave the frame before
      // (a force that only continues — a bend, resting — is not an arrival).
      const base = fresh ? 0 : Math.max(0, -dot(body.imp[f - 1], n));
      let stopped = 0;
      for (let k = f; k < Math.min(o.frames.length, f + opts.stopFrames) && o.frames[k].collisions.length; k++) stopped += Math.max(0, -dot(body.imp[k], n) - base);
      out.push({frame: f, n, approach, stopped, value: Math.max(0, Math.min(approach, stopped)), fresh});
    }
    before = now;
  }
  return out;
}

export type Candidates = {mcOwn: number; onset: number; contactStart: number; end: number; kind: string; strike: number;
  c_arrive: number; c_arrive_spin: number; c_loss: number; arriveAt: number; arrivals: number; arrive2: number; crisp: number; spin: number; rotBefore: number; rotAfter: number};
export function impactCandidates(o: any, normals: Map<number, V2>, opts = ARRIVAL): Candidates[] {
  const body = bodySeries(o), all = arrivals(o, normals, body, opts), events = detectStrikes(strikeFrames(o));
  return events.map((e: any) => {
    const from = e.contactStart, to = e.end;
    const mine = all.filter(a => a.frame >= from && a.frame <= to).sort((p, q) => q.value - p.value);
    // Distinct impacts: the strongest arrival, plus every arrival onto a surface the rider
    // was not touching the frame before (fresh) that is at least DISTINCT, faces another
    // way than those already counted or comes 2+ frames after them.
    const top = mine[0], distinct: Arrival[] = top && top.value >= DISTINCT * SCALE ? [top] : [];
    for (const a of mine) if (a.fresh && a.value >= DISTINCT * SCALE && distinct.every(d => dot(d.n, a.n) < 0 || Math.abs(d.frame - a.frame) >= 2)) distinct.push(a);
    let net = 0, spin = 0, total = 0;
    for (let f = from; f <= to; f++) {net += body.loss[f]; total += Math.hypot(body.imp[f].x, body.imp[f].y);}
    for (let f = from; f <= to; f++) spin = Math.max(spin, Math.abs(body.spin[f] + (f < to ? body.spin[f + 1] : 0)));
    // motion_change's kernel (largest 2-frame |imp, ΔL/(N·R)|), clipped to the event's own frames.
    let mcOwn = 0;
    for (let f = Math.max(1, e.onset); f <= Math.min(to, e.onset + 5); f++) {
      const g = f + 1 <= Math.min(to, e.onset + 5) ? f + 1 : f, both = g !== f ? 1 : 0;   // a 1-frame event is its own window
      mcOwn = Math.max(mcOwn, Math.hypot(body.imp[f].x + both * body.imp[g].x, body.imp[f].y + both * body.imp[g].y, body.spin[f] + both * body.spin[g]));
    }
    const c_arrive = (top?.value ?? 0) / SCALE;
    return {mcOwn: mcOwn / SCALE, onset: e.onset, contactStart: from, end: to, kind: e.kind, strike: e.strength,
      c_arrive, c_arrive_spin: Math.hypot(c_arrive, spin / SCALE), c_loss: Math.sqrt(2 * Math.max(0, net)) / SCALE,
      arriveAt: top?.frame ?? from, arrivals: distinct.length, arrive2: (distinct[1]?.value ?? 0) / SCALE,
      crisp: total > 1e-9 && top ? Math.min(1, top.stopped / total) : 1, spin: spin / SCALE,
      rotBefore: body.rot[Math.max(0, from - 1)] / SCALE, rotAfter: body.rot[to] / SCALE};
  });
}

// ---------------------------------------------------------------- statistics
const rank = (x: number[]) => {const s = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), out = new Array(x.length);
  for (let a = 0; a < s.length;) {let b = a; while (b + 1 < s.length && s[b + 1][0] === s[a][0]) b++; for (let k = a; k <= b; k++) out[s[k][1]] = (a + b) / 2; a = b + 1;} return out;};
const pearson = (x: number[], y: number[]) => {const mx = x.reduce((a, b) => a + b) / x.length, my = y.reduce((a, b) => a + b) / y.length; let n = 0, a = 0, b = 0;
  for (let i = 0; i < x.length; i++) {n += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2;} return n / Math.sqrt(a * b);};
export const spearman = (x: number[], y: number[]) => pearson(rank(x), rank(y));
const quantile = (xs: number[], p: number) => {const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN;};

// ---------------------------------------------------------------- synthetic probes
const line = (id: number, x1: number, y1: number, x2: number, y2: number) => ({id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false});
/** Polyline arc about (cx, cy) from angle a0 to a1 (radians, screen axes, y down). */
const arc = (id0: number, cx: number, cy: number, r: number, a0: number, a1: number, steps: number) =>
  Array.from({length: steps}, (_, k) => {const p = a0 + (a1 - a0) * k / steps, q = a0 + (a1 - a0) * (k + 1) / steps;
    return line(id0 + k, cx + r * Math.cos(p), cy + r * Math.sin(p), cx + r * Math.cos(q), cy + r * Math.sin(q));});
/** Every kernel over an explicit frame window, so contact that the strike account calls
 * steering (no event) is still measured: strike kernel = largest 6-frame Σ bend,
 * motion_change kernel = largest 2-frame |imp, ΔL/(N·R)|, loss = largest 6-frame. */
function windowValues(o: any, normals: Map<number, V2>, from: number, to: number) {
  const body = bodySeries(o), sf = strikeFrames(o), arr = arrivals(o, normals, body).filter(a => a.frame >= from && a.frame <= to);
  let bend = 0, mc = 0, loss = 0;
  for (let f = from; f <= to; f++) {
    let b6 = 0, l6 = 0; for (let k = f; k < Math.min(f + 6, to + 1); k++) {b6 += sf[k].bend; l6 += body.loss[k];}
    bend = Math.max(bend, b6); loss = Math.max(loss, l6);
    if (f < to) mc = Math.max(mc, Math.hypot(body.imp[f].x + body.imp[f + 1].x, body.imp[f].y + body.imp[f + 1].y, body.spin[f] + body.spin[f + 1]));
  }
  const arrive = Math.max(0, ...arr.map(a => a.value));
  return {strike: Math.min(1, bend / SCALE), mc: mc / SCALE, c_arrive: arrive / SCALE, c_loss: Math.sqrt(2 * Math.max(0, loss)) / SCALE};
}
/** Hand-built rides whose answer the owner's description fixes in advance. Each probe is
 * measured over the frames of its feature (first frame of contact with the feature's
 * lines, through 12 frames). */
export function probes() {
  const rows: any[] = [];
  const ride = (name: string, vx: number, vy: number, lines: any[], feature: number[], expect: string) => {
    const track = {startPosition: {x: 0, y: 0}, riders: [{startPosition: {x: 0, y: 0}, startVelocity: {x: vx, y: vy}}], lines};
    const o: any = observe(track, 160, []), normals = lineNormals(track);
    const first = o.frames.findIndex((fr: any) => fr.collisions.some((c: number[]) => feature.includes(c[0])));
    if (first < 1) {rows.push({name, expect, missed: true}); return;}
    const w = windowValues(o, normals, first, Math.min(o.frames.length - 1, first + 12));
    rows.push({name, expect, frame: first, observed: o.frames.length - 1 - first, speed: Math.hypot(o.frames[first - 1].v[0], o.frames[first - 1].v[1]), ...w});
  };
  // Free flight: the per-frame signals all vanish.
  {
    const o: any = observe({startPosition: {x: 0, y: 0}, riders: [{startPosition: {x: 0, y: 0}, startVelocity: {x: 6, y: -3}}], lines: [line(1, 0, 5000, 10, 5000)]}, 60, []), b = bodySeries(o);
    rows.push({name: 'free flight (60 frames)', expect: 'all 0', frame: 0, observed: o.frames.length, speed: 0, strike: 0, mc: Math.max(...b.imp.map(v => Math.hypot(v.x, v.y))) / SCALE, c_arrive: 0, c_loss: Math.max(...b.loss.map(Math.abs)) / SCALE});
  }
  // Flat floor from rising drop heights: all rise with the speed into the floor.
  for (const h of [20, 60, 140, 300]) ride(`flat drop h${h}, vx 4`, 4, 0, [line(1, -100, h, 4000, h)], [1], 'rises with h');
  // Same drop, faster along the floor: the speed INTO the floor is unchanged.
  for (const vx of [2, 8, 12]) ride(`flat drop h60, vx ${vx}`, vx, 0, [line(1, -100, 60, 4000, 60)], [1], 'owner: faster = harder?');
  // Head-on: slide along a floor into a vertical wall (drawn upward: its normal faces the rider).
  for (const v of [4, 8]) ride(`head-on wall, v ${v}`, v, 0, [line(1, -100, 5.5, 4000, 5.5), line(2, 200, 5, 200, -300)], [2], 'very big, grows with v');
  for (const v of [4, 8]) ride(`60° ramp, v ${v}`, v, 0, [line(1, -100, 5.5, 200, 5.5), line(2, 200, 5.5, 400, 5.5 - 200 * Math.tan(Math.PI / 3))], [2], 'big (mostly a stop)');
  // Tangential bends at v 8: floor flowing into a concave quarter circle (5° segments).
  for (const r of [150, 60]) ride(`tangential bend r${r}, v 8`, 8, 0, [line(1, -100, 5.5, 150, 5.5), ...arc(10, 150, 5.5 - r, r, Math.PI / 2, 0, 18)], Array.from({length: 18}, (_, k) => 10 + k), 'low (smooth bend)');
  // Corner: floor kinks up by 30° at speed.
  ride('30° corner, v 8', 8, 0, [line(1, -100, 5.5, 150, 5.5), line(2, 150, 5.5, 450, 5.5 - 300 * Math.tan(Math.PI / 6))], [2], 'medium (sudden turn)');
  // Upper hit: thrown up into a ceiling drawn right to left (normal up).
  for (const vy of [-5, -8]) ride(`ceiling hit, vy ${vy}`, 3, vy, [line(1, 400, -40, -100, -40)], [1], 'rises with vy');
  // Tangential landing: moving parallel to a slope 1.5 px above it.
  ride('tangential landing, v 8', 8, 8 * Math.tan(.3), [line(1, -50, 6.5 - 50 * Math.tan(.3), 2000, 6.5 + 2000 * Math.tan(.3))], [1], 'about 0');
  return rows;
}

if (import.meta.filename === process.argv[1]) {
  const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  if (process.argv.includes('--probes')) {
    console.log('probe                        speed  observed  strike-kernel  mc-kernel  c_arrive  c_loss   expected');
    for (const r of probes()) console.log(r.missed ? `${r.name.padEnd(28)} feature never touched` :
      `${r.name.padEnd(28)} ${r.speed.toFixed(1).padStart(5)}  ${String(r.observed).padStart(8)}  ${r.strike.toFixed(2).padStart(13)}  ${r.mc.toFixed(2).padStart(9)}  ${r.c_arrive.toFixed(2).padStart(8)}  ${r.c_loss.toFixed(2).padStart(6)}   ${r.expect}`);
    process.exit(0);
  }
  const sets = arg('sets', 'july,current,strike').split(','), outPath = arg('out', '');
  const tracks = new Map(sources(sets).map(s => [`${s.set}~${s.song}~${s.seed}`, s.track]));
  const index = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')).filter((r: any) => sets.includes(r.set));
  const variants = {deg10: {deg: 10, stopFrames: 3}, deg30: {deg: 30, stopFrames: 3}, stop2: {deg: 20, stopFrames: 2}, stop4: {deg: 20, stopFrames: 4}};
  const rows: any[] = [];
  let outside = 0, outsideStrong = 0, overlap = 0;
  for (const r of index) {
    const o = JSON.parse(gunzipSync(readFileSync(join(OUT, r.id + '.json.gz'))).toString()), normals = lineNormals(tracks.get(r.id));
    const mc = motionChanges(o), cs = impactCandidates(o, normals);
    const alt = Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, impactCandidates(o, normals, v)]));
    cs.forEach((c, i) => {
      rows.push({id: r.id, set: r.set, song: r.song, seed: r.seed, ...c, mc: mc[i].strength, mcTravel: mc[i].travel,
        ...Object.fromEntries(Object.keys(variants).map(k => [`arrive_${k}`, alt[k][i].c_arrive]))});
      // motion_change reads onset..onset+5, which can run into the next event's frames.
      if (i + 1 < cs.length && c.onset + 5 >= cs[i + 1].contactStart) overlap++;
    });
    // Own segmentation: fresh-surface arrivals that no strike event's frames contain.
    const spans = cs.map(c => [c.contactStart, c.end]);
    for (const a of arrivals(o, normals)) if (a.fresh && a.value >= DISTINCT * SCALE && !spans.some(([p, q]) => a.frame >= p && a.frame <= q)) {
      outside++; if (a.value >= .3 * SCALE) outsideStrong++;
    }
  }
  const strong = rows.filter(r => r.strike >= .1), cols = ['c_arrive', 'c_arrive_spin', 'c_loss'];
  const sp = (k: string, j: string, xs = strong) => spearman(xs.map(r => r[k]), xs.map(r => r[j])).toFixed(3);
  console.log(`events ${rows.length}, with strike >= 0.1: ${strong.length}`);
  console.log('Spearman (tie-averaged ranks), strike >= 0.1:');
  for (const k of cols) console.log(`  ${k.padEnd(14)} vs strike ${sp(k, 'strike')}   vs motion_change ${sp(k, 'mc')}   vs c_arrive ${sp(k, 'c_arrive')}`);
  console.log(`  motion_change  vs strike ${sp('mc', 'strike')}`);
  console.log(`  motion_change clipped to the event's frames (mcOwn): vs motion_change ${sp('mcOwn', 'mc')}  vs strike ${sp('mcOwn', 'strike')}  vs c_arrive ${sp('mcOwn', 'c_arrive')}  vs c_arrive_spin ${sp('mcOwn', 'c_arrive_spin')}`);
  console.log(`  c_arrive sensitivity (vs default 20°, 3 frames): ` + Object.keys(variants).map(k => `${k} ${sp(`arrive_${k}`, 'c_arrive')}`).join('  '));
  for (const set of sets) {
    const s = strong.filter(r => r.set === set);
    console.log(`${set.padEnd(8)} n ${String(s.length).padStart(4)}  median strike ${quantile(s.map(r => r.strike), .5).toFixed(2)}  mc ${quantile(s.map(r => r.mc), .5).toFixed(2)}  ` +
      cols.map(k => `${k} ${quantile(s.map(r => r[k]), .5).toFixed(2)}`).join('  ') + `  crisp ${quantile(s.map(r => r.crisp), .5).toFixed(2)}   rho(arrive, strike) ${sp('c_arrive', 'strike', s)}`);
  }
  const split = strong.filter(r => r.arrivals >= 2), renew = strong.filter(r => r.kind === 'strike'), quiet = renew.filter(r => r.strike >= .3 && r.c_arrive < .05);
  console.log(`segmentation: ${split.length} strike events hold >= 2 distinct arrivals >= ${DISTINCT} (median second ${quantile(split.map(r => r.arrive2), .5).toFixed(2)}),` +
    ` ${split.filter(r => r.arrive2 >= .3).length} with the second >= 0.3;`);
  console.log(`  ${quiet.length} of ${renew.filter(r => r.strike >= .3).length} strike renewals >= 0.3 have no arrival >= 0.05 (pressing, not arriving);`);
  console.log(`  ${outside} fresh arrivals >= ${DISTINCT} (${outsideStrong} >= 0.3) fall outside every strike event's frames.`);
  console.log(`motion_change window runs into the next event for ${overlap} of ${rows.length} events.`);
  // Spinning grazes, chosen without any candidate: spinning fast before contact (top decile of
  // spin speed at the radius of gyration) and touching for at most 2 frames.
  const spinCut = quantile(strong.map(r => Math.abs(r.rotBefore)), .9), graze = strong.filter(r => Math.abs(r.rotBefore) >= spinCut && r.end - r.contactStart <= 1);
  const pct = (k: string) => (graze.map(r => strong.filter(q => q[k] <= r[k]).length / strong.length)
    .sort((a, b) => a - b)[graze.length >> 1] ?? NaN).toFixed(2);
  console.log(`spinning short touches (spin before >= ${spinCut.toFixed(2)}, <= 2 frames): n ${graze.length}; median percentile among events >= 0.1: ` +
    ['strike', 'mc', ...cols].map(k => `${k} ${pct(k)}`).join('  '));
  // Reversal: the spin changes sign and is at least 0.04 (0.3 px/frame at the radius of gyration, the median) on both sides.
  const reversals = strong.filter(r => r.rotBefore * r.rotAfter < 0 && Math.min(Math.abs(r.rotBefore), Math.abs(r.rotAfter)) >= .04);
  console.log(`spin: c_arrive_spin exceeds c_arrive by > 0.1 on ${strong.filter(r => r.c_arrive_spin - r.c_arrive > .1).length} events; spin reversals (sign change, >= 0.04 both sides): ${reversals.length}` +
    ` (median c_arrive ${quantile(reversals.map(r => r.c_arrive), .5).toFixed(2)}, c_arrive_spin ${quantile(reversals.map(r => r.c_arrive_spin), .5).toFixed(2)}, mcOwn ${quantile(reversals.map(r => r.mcOwn), .5).toFixed(2)})`);
  if (outPath) writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  process.exit(0);
}
