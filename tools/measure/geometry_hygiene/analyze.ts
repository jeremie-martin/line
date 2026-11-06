/** Geometry hygiene study (2026-10-31, report only): pass-throughs and
 * untouched geometry in compiled production rides. Research only; nothing
 * here feeds the compiler, the evaluation or any ruler, and nothing under
 * tools/eval imports it.
 *
 *   node tools/measure/geometry_hygiene/analyze.ts OUT.json RIDE.json [RIDE.json ...]
 *        [--removal=N]   also replay N crossed-and-never-touched lines removed one at a time
 *
 * RIDE.json is a production result (`*-production.json` from npm run produce).
 *
 * Replay. The saved track is replayed on the compiler's native engine
 * (scripts/lib/native_motion), frame by frame, and every rider point position
 * is checked against the result's saved trace (`maxTraceError`).
 *
 * Collision rule (scripts/lib/native_motion/src/line.rs, lr-core): a line's
 * normal n points from its free side into its solid side. A point collides
 * when it moves along +n and ends 0 < perp < 10 px past the line, within the
 * line's (extended) span; it is put back on the line.
 *
 * Pass-through (point crossing). Between the end of frame f-1 and the end of
 * frame f, a rider point goes from one side of a solid line's drawn segment to
 * the other: both ends at least 0.5 px from the line, the crossing inside the
 * drawn segment, and this point did not collide with this line in frame f.
 * - `back`: it crossed from the solid side to the free side (moving along -n).
 *   The engine never collides such a point.
 * - `front`: it crossed from the free side into the solid side and was not put
 *   back. Sub-reason: `deep` (ended ≥ 10 px past), `span` (outside the
 *   line's collision span at the end of the frame), `other`.
 * - A point that did collide with the line in frame f but still ends past it
 *   is counted separately (`collidedButThrough`).
 *
 * Line inside the rider (bone overlap). At the end of frame f, a line's drawn
 * segment properly crosses one of the rider's drawn bones (sled: PEG-TAIL,
 * TAIL-NOSE, NOSE-STRING; body: BUTT-SHOULDER, SHOULDER-hands, BUTT-feet),
 * with both bone ends at least 0.5 px from the line. This is what a viewer
 * sees as "the line goes through the rider".
 *
 * Episode. Per section chain (section + role), the frames with a point
 * crossing or a bone overlap, merged when separated by at most 2 frames.
 *
 * Roles. Section = floor((id - 1000) / 10000). Guide ids are the result's
 * railGuides (the second connected chain of a connected section, or the
 * fragments' own record for scattered sections). A guide in a transfer
 * section is the `receiver`; other guides are `guide`; scattered sections'
 * lines are `scattered`; everything else is `main` (its first-or-last long
 * segment, the approach, is `approach`).
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {LineRiderEngine as Engine} from '../../../scripts/lib/native_motion/engine.ts';
import {inspectRepertoireLayout} from '../../../scripts/v0/optimizer/repertoire_layout.ts';
import {arcRailGroups} from '../../../scripts/v0/optimizer/arc_rail_groups.ts';
import {extractRawTrajectory} from '../../../scripts/lib/detector.ts';

export const POINTS = ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
const SLED = new Set([0, 1, 2, 3]);
const BONES: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [5, 7], [4, 8], [4, 9]];
const MARGIN = .5, FORCE = 10, CELL = 32;

type Line = {id: number; type: number; x1: number; y1: number; x2: number; y2: number; flipped?: boolean;
  leftExtended?: boolean; rightExtended?: boolean};
type Geo = Line & {vx: number; vy: number; len: number; nx: number; ny: number; lo: number; hi: number};
type P = {x: number; y: number};

export function geometry(l: Line): Geo {
  const vx = l.x2 - l.x1, vy = l.y2 - l.y1, len = Math.hypot(vx, vy), s = l.flipped ? -1 : 1;
  const ext = Math.min(FORCE / len, .25);
  return {...l, vx, vy, len, nx: -vy / len * s, ny: vx / len * s, lo: l.leftExtended ? -ext : 0, hi: l.rightExtended ? 1 + ext : 1};
}
const perp = (g: Geo, p: P) => g.nx * (p.x - g.x1) + g.ny * (p.y - g.y1);
const along = (g: Geo, p: P) => ((p.x - g.x1) * g.vx + (p.y - g.y1) * g.vy) / (g.len * g.len);
/** Euclidean distance from p to the drawn segment. */
const segDist = (g: Geo, p: P) => {const t = Math.max(0, Math.min(1, along(g, p))); return Math.hypot(p.x - g.x1 - t * g.vx, p.y - g.y1 - t * g.vy);};

function grid(lines: Geo[]) {
  const m = new Map<string, Geo[]>();
  for (const l of lines) {
    if (l.type === 2) continue;
    for (let i = Math.floor(Math.min(l.x1, l.x2) / CELL); i <= Math.floor(Math.max(l.x1, l.x2) / CELL); i++)
      for (let j = Math.floor(Math.min(l.y1, l.y2) / CELL); j <= Math.floor(Math.max(l.y1, l.y2) / CELL); j++) {
        const k = `${i},${j}`; let b = m.get(k); if (!b) m.set(k, b = []); b.push(l);
      }
  }
  return (a: P, b: P) => {
    const out = new Set<Geo>();
    for (let i = Math.floor(Math.min(a.x, b.x) / CELL); i <= Math.floor(Math.max(a.x, b.x) / CELL); i++)
      for (let j = Math.floor(Math.min(a.y, b.y) / CELL); j <= Math.floor(Math.max(a.y, b.y) / CELL); j++)
        for (const l of m.get(`${i},${j}`) ?? []) out.add(l);
    return out;
  };
}

/** Replay a track: per frame, the 10 point positions and the (line, point, iteration) collisions. */
export function replay(track: any, last: number) {
  const engine = new Engine().setStart(track.startPosition ?? track.riders[0].startPosition, track.riders[0].startVelocity).addLine(track.lines);
  const frames: Array<{p: P[]; c: Array<[number, number, number]>; mounted: boolean; position?: P}> = [];
  for (let f = 0; f <= last; f++) {
    const st = engine.getRider(f).ballisticState();
    const c: Array<[number, number, number]> = [];
    let constraints = 0;
    for (const u of engine.getUpdatesAtFrame(f)) {
      if (u.type === 'ConstraintUpdate') constraints++;
      if (u.type === 'CollisionUpdate') c.push([u.id, POINTS.indexOf(u.updated[0].id), Math.min(5, Math.floor(constraints / 22))]);
    }
    frames.push({p: POINTS.map(id => ({x: st.points[id].x, y: st.points[id].y})), c, mounted: st.riderMounted});
  }
  // The detector's rider position, as the production realization check reads it.
  extractRawTrajectory(engine, last).frames.forEach((r: any, f: number) => {if (frames[f]) frames[f].position = r.position;});
  return frames;
}

/** Proper segment intersection of a line with a bone, both bone ends ≥ MARGIN from the line. */
function boneCrosses(g: Geo, a: P, b: P) {
  const da = perp(g, a), db = perp(g, b);
  if (da * db >= 0 || Math.abs(da) < MARGIN || Math.abs(db) < MARGIN) return 0;
  const s = da / (da - db), x = a.x + s * (b.x - a.x), y = a.y + s * (b.y - a.y);
  const t = along(g, {x, y});
  // Depth: how far the line sits inside the bone (the nearer bone end's distance).
  return t > 0 && t < 1 ? Math.min(Math.abs(da), Math.abs(db)) : 0;
}

export type Role = 'main' | 'approach' | 'guide' | 'receiver' | 'scattered';

export function roles(result: any) {
  const lines: Line[] = result.track.lines, plan = result.production.plan, railGuides = result.production.railGuides ?? result.railGuides;
  const guide = new Set<number>(Object.values(railGuides ?? {}).flat() as number[]);
  const bySection = new Map<number, Line[]>();
  for (const l of lines) {const s = Math.floor((l.id - 1000) / 10000); let b = bySection.get(s); if (!b) bySection.set(s, b = []); b.push(l);}
  const role = new Map<number, Role>();
  for (const [s, ls] of bySection) {
    const r = plan.requests[s];
    if (r?.construction === 'scattered') {for (const l of ls) role.set(l.id, 'scattered'); continue;}
    const main = ls.filter(l => !guide.has(l.id)).sort((a, b) => a.id - b.id);
    for (const l of ls) role.set(l.id, guide.has(l.id) ? (r?.railLayout === 'transfer' ? 'receiver' : 'guide') : 'main');
    // The approach: the long straight lead-in at the start of the main chain
    // (or its end, when the chain was reversed for an opposing contact side).
    if (main.length >= 2) {
      const lens = main.map(l => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
      const first = lens[0], lastLen = lens.at(-1)!;
      const inner = lens.slice(1, -1).sort((a, b) => a - b)[Math.floor((lens.length - 2) / 2)] ?? 0;
      if (first >= 15 && first >= lastLen) role.set(main[0].id, 'approach');
      else if (lastLen >= 15 && inner < lastLen) role.set(main.at(-1)!.id, 'approach');
    }
  }
  return role;
}

export function analyze(result: any) {
  const lines: Geo[] = result.track.lines.map(geometry);
  const byId = new Map(lines.map(l => [l.id, l]));
  const role = roles(result);
  const plan = result.production.plan;
  const duration: number = result.case.durationFrames;
  const trace: number[][] = result.trace.frames;
  const last = trace.length - 1;
  const frames = replay(result.track, last);
  let maxTraceError = 0;
  for (let f = 0; f <= last; f++) for (let p = 0; p < 10; p++)
    maxTraceError = Math.max(maxTraceError, Math.abs(frames[f].p[p].x - trace[f][2 * p]), Math.abs(frames[f].p[p].y - trace[f][2 * p + 1]));
  const near = grid(lines);
  const sectionAt = (f: number) => plan.requests.findIndex((r: any) => f >= r.frame && f < r.next);
  const sectionOf = (id: number) => Math.floor((id - 1000) / 10000);

  // Touch record per line (any point, any frame up to the end of the replay).
  const touch = new Map<number, {frames: number[]; sled: number; body: number}>();
  frames.forEach((fr, f) => {
    for (const [id, p] of fr.c) {
      let t = touch.get(id); if (!t) touch.set(id, t = {frames: [], sled: 0, body: 0});
      if (t.frames.at(-1) !== f) t.frames.push(f);
      if (SLED.has(p)) t.sled++; else t.body++;
    }
  });

  // Connected chains of each section (id order, shared endpoints), as arcRailGroups reads them.
  const chains: Geo[][] = [];
  const chainOf = new Map<number, number>();
  {
    const bySection = new Map<number, Geo[]>();
    for (const l of lines) {const s = sectionOf(l.id); let b = bySection.get(s); if (!b) bySection.set(s, b = []); b.push(l);}
    for (const ls of bySection.values()) {
      let cur: Geo[] = [];
      for (const l of [...ls].sort((x, y) => x.id - y.id)) {
        const prev = cur.at(-1);
        if (prev && (prev.x2 !== l.x1 || prev.y2 !== l.y1)) {chains.push(cur); cur = [];}
        cur.push(l);
      }
      if (cur.length) chains.push(cur);
    }
    chains.forEach((ch, i) => {for (const l of ch) chainOf.set(l.id, i);});
  }
  const chainEnds = new Set<number>(chains.flatMap(ch => [ch[0].id, ch.at(-1)!.id]));
  /** Side of a point relative to the drawn chain: +1 on the solid side (behind),
   * -1 on the free side, 0 beyond a free end of the chain. Nearest segment; at a
   * shared vertex the side follows the sum of both segments' normals. */
  const side = (ci: number, q: P) => {
    const ch = chains[ci];
    let best = Infinity, k = -1, tk = 0;
    for (let i = 0; i < ch.length; i++) {
      const g = ch[i], t = along(g, q), tc = Math.max(0, Math.min(1, t));
      const d = Math.hypot(q.x - g.x1 - tc * g.vx, q.y - g.y1 - tc * g.vy);
      if (d < best) {best = d; k = i; tk = t;}
    }
    const g = ch[k];
    if (tk > 0 && tk < 1) return {s: Math.sign(perp(g, q)), d: best, line: g.id};
    const j = tk <= 0 ? k - 1 : k + 1;
    if (j < 0 || j >= ch.length) return {s: 0, d: best, line: g.id};
    const h = ch[j], vx = tk <= 0 ? g.x1 : g.x2, vy = tk <= 0 ? g.y1 : g.y2;
    return {s: Math.sign((q.x - vx) * (g.nx + h.nx) + (q.y - vy) * (g.ny + h.ny)), d: best, line: g.id};
  };
  /** Proper crossing of segment a-b with a drawn segment g (both ends at least MARGIN off its line). */
  const cuts = (g: Geo, a: P, b: P) => {
    const da = perp(g, a), db = perp(g, b);
    if (da * db >= 0 || Math.abs(da) < MARGIN || Math.abs(db) < MARGIN) return false;
    const s = da / (da - db), t = along(g, {x: a.x + s * (b.x - a.x), y: a.y + s * (b.y - a.y)});
    return t >= 0 && t <= 1;
  };
  // Per point and chain within REACH: the side of the chain at each frame end.
  const REACH = 20;
  const state = new Map<string, Map<number, {s: number; d: number}>>();   // `${p}:${ci}` -> frame -> side
  const lastF = Math.min(last, duration);
  for (let f = 0; f <= lastF; f++) {
    if (!frames[f].mounted) continue;
    for (let p = 0; p < 10; p++) {
      const q = frames[f].p[p];
      const cs = new Set<number>();
      for (const g of near({x: q.x - REACH, y: q.y - REACH}, {x: q.x + REACH, y: q.y + REACH})) cs.add(chainOf.get(g.id)!);
      // A fast point can end farther than REACH past a chain it cut this frame.
      if (f > 0) for (const g of near(frames[f - 1].p[p], q)) if (cuts(g, frames[f - 1].p[p], q)) cs.add(chainOf.get(g.id)!);
      for (const ci of cs) {
        const sd = side(ci, q);
        if (sd.d > REACH && sd.s <= 0) continue;
        const key = `${p}:${ci}`; let m = state.get(key); if (!m) state.set(key, m = new Map()); m.set(f, {s: sd.s, d: sd.d});
      }
    }
  }
  const cutsChain = (ci: number, a: P, b: P) => chains[ci].some(g => cuts(g, a, b));
  const hitAt = (f: number, p: number, ci: number) => frames[f]?.c.some(([id, q]) => q === p && chainOf.get(id) === ci) ?? false;
  /** Runs of frames on a chain's solid side (≥ MARGIN deep, within REACH), with how each run began and ended. */
  const runs: any[] = [];
  for (const [key, m] of state) {
    const [p, ci] = key.split(':').map(Number);
    const inside = (f: number) => {const x = m.get(f); return !!x && x.s > 0 && x.d >= MARGIN;};
    const fs = [...m.keys()].filter(inside).sort((a, b) => a - b);
    let i = 0;
    while (i < fs.length) {
      let j = i; while (j + 1 < fs.length && fs[j + 1] === fs[j] + 1) j++;
      const a = fs[i], b = fs[j];
      const classify = (f: number, edge: number) => {   // f: the frame just outside the run; edge: the run's own end frame
        const x = m.get(f);
        if (f < 0 || f > lastF || !frames[f].mounted) return 'none';
        if (!x) return 'far';
        if (x.d < MARGIN) return 'contact';
        if (x.s > 0) return 'far';                      // cannot happen for a neighbour of a run; kept for safety
        if (x.s === 0) return 'around-end';
        const [u, v] = f < edge ? [frames[f].p[p], frames[edge].p[p]] : [frames[edge].p[p], frames[f].p[p]];
        return cutsChain(ci, u, v) ? 'crossed' : 'around';
      };
      const entry = classify(a - 1, a), exit = classify(b + 1, b);
      let maxD = 0; for (let f = a; f <= b; f++) maxD = Math.max(maxD, m.get(f)!.d);
      const kind = entry === 'crossed' ? 'through-front'
        : exit === 'crossed' ? (entry === 'contact' ? 'sink-pop' : 'through-back')
        : entry === 'contact' ? 'sink' : 'behind';
      runs.push({point: POINTS[p], p, chain: ci, start: a, end: b, frames: b - a + 1, maxDepth: maxD, entry, exit, kind,
        collidedAtEntry: entry === 'crossed' ? hitAt(a, p, ci) : null});
      i = j + 1;
    }
  }
  // A pass-through is a run that begins or ends by crossing the drawn chain.
  const crossings: any[] = [], collidedThrough: any[] = [];
  for (const r of runs) {
    if (r.kind !== 'through-front' && r.kind !== 'through-back' && r.kind !== 'sink-pop') continue;
    const f = r.kind === 'through-front' ? r.start : r.end + 1;    // the crossing frame
    const a = frames[f - 1].p[r.p], b = frames[f].p[r.p];
    const g = chains[r.chain].find(l => cuts(l, a, b)) ?? chains[r.chain][0];
    const db = perp(g, b), tb = along(g, b);
    const reason = r.kind !== 'through-front' ? null : db >= FORCE ? 'deep' : tb < g.lo || tb > g.hi ? 'span' : 'other';
    const ev = {frame: f, point: r.point, line: g.id, chain: r.chain, section: sectionOf(g.id), role: role.get(g.id),
      direction: r.kind === 'through-front' ? 'front' : 'back', kind: r.kind, reason, runStart: r.start, runEnd: r.end,
      stay: r.frames, depth: r.maxDepth, entry: r.entry, exit: r.exit, chainEnd: chainEnds.has(g.id),
      speed: Math.hypot(b.x - a.x, b.y - a.y), activeSection: sectionAt(f)};
    if (hitAt(f, r.p, r.chain)) collidedThrough.push(ev); else crossings.push(ev);
  }
  const sinks = runs.filter(r => r.kind === 'sink');
  const inside = new Map<number, Map<number, {depth: number; bones: string[]}>>();   // chain -> frame -> bone overlap
  for (let f = 1; f <= lastF; f++) {
    if (!frames[f].mounted) continue;
    for (const [i, j] of BONES) {
      const a = frames[f].p[i], b = frames[f].p[j];
      const cand = new Set<number>();
      for (const g of near(a, b)) if (cuts(g, a, b)) cand.add(chainOf.get(g.id)!);
      for (const ci of cand) {
        const sa = side(ci, a), sb = side(ci, b);
        if (!sa.s || !sb.s || sa.s === sb.s) continue;
        const depth = Math.min(sa.d, sb.d);
        if (depth < MARGIN) continue;
        let m = inside.get(ci); if (!m) inside.set(ci, m = new Map());
        const cur = m.get(f) ?? {depth: 0, bones: []};
        cur.depth = Math.max(cur.depth, depth); cur.bones.push(`${POINTS[i]}-${POINTS[j]}`); m.set(f, cur);
      }
    }
  }

  // Episodes per chain: frames with a crossing or a bone overlap, merged across gaps of at most 3 frames.
  const episodes: any[] = [];
  const chainFrames = new Map<number, Set<number>>();
  const add = (ci: number, f: number) => {let s = chainFrames.get(ci); if (!s) chainFrames.set(ci, s = new Set()); s.add(f);};
  for (const c of crossings) add(c.chain, c.frame);
  for (const [ci, m] of inside) for (const f of m.keys()) add(ci, f);
  for (const [ci, set] of chainFrames) {
    const fs = [...set].sort((a, b) => a - b);
    const ch = chains[ci], section = sectionOf(ch[0].id), r = role.get(ch.find(l => role.get(l.id) !== 'approach')?.id ?? ch[0].id);
    const req = plan.requests[section];
    const flush = (a: number, b: number) => {
      const cs = crossings.filter(c => c.chain === ci && c.frame >= a && c.frame <= b);
      const ov = [...(inside.get(ci) ?? new Map<number, {depth: number; bones: string[]}>()).entries()].filter(([f]) => f >= a && f <= b);
      const chTouched = ch.filter(l => touch.has(l.id));
      const firstTouch = Math.min(...chTouched.map(l => touch.get(l.id)!.frames[0])), lastTouch = Math.max(...chTouched.map(l => touch.get(l.id)!.frames.at(-1)!));
      const ids = new Set<number>(cs.map(c => c.line));
      const overlapDepth = Math.max(0, ...ov.map(([, v]) => v.depth));
      episodes.push({section, chain: ci, role: r, construction: req?.construction, guidance: req?.guidance, layout: req?.railLayout ?? null,
        start: a, end: b, frames: b - a + 1, insideFrames: ov.length, crossings: cs.length,
        back: cs.filter(c => c.direction === 'back').length, front: cs.filter(c => c.direction === 'front').length,
        frontReasons: [...new Set(cs.filter(c => c.reason).map(c => c.reason))],
        points: [...new Set(cs.map(c => c.point))], bones: [...new Set(ov.flatMap(([, v]) => v.bones))],
        kinds: Object.fromEntries(['through-front', 'through-back', 'sink-pop'].map(k => [k, cs.filter(c => c.kind === k).length])),
        runDepth: Math.max(0, ...cs.filter(c => c.kind !== 'through-back').map(c => c.depth)), stay: Math.max(0, ...cs.map(c => c.stay)),
        overlapDepth, maxDepth: Math.max(overlapDepth, ...cs.filter(c => c.kind !== 'through-back').map(c => c.depth)),
        tipOnly: cs.length > 0 && cs.every(c => c.chainEnd),
        activeSection: sectionAt(a), relation: section === sectionAt(a) ? 'own' : section < sectionAt(a) ? 'earlier' : 'later',
        lines: [...ids], chainTouched: chTouched.length > 0, chainSegments: ch.length, chainTouchedSegments: chTouched.length,
        linesEverTouched: [...ids].filter(id => touch.has(id)).length,
        touchedBefore: chTouched.length > 0 && firstTouch < a, touchedAfter: chTouched.length > 0 && lastTouch > b,
        sledOnly: cs.length > 0 && cs.every(c => SLED.has(POINTS.indexOf(c.point))), bodyOnly: cs.length > 0 && cs.every(c => !SLED.has(POINTS.indexOf(c.point)))});
    };
    let start = fs[0], prev = fs[0];
    for (const f of fs.slice(1)) {if (f - prev > 3) {flush(start, prev); start = f;} prev = f;}
    flush(start, prev);
  }
  episodes.sort((a, b) => a.start - b.start);

  // Untouched geometry, by role and family.
  const lineRows = lines.map(l => {
    const s = sectionOf(l.id), r = plan.requests[s], t = touch.get(l.id);
    return {id: l.id, section: s, role: role.get(l.id)!, construction: r?.construction, guidance: r?.guidance, layout: r?.railLayout ?? null,
      // facing: 'roof' when the side that stops the rider faces down (normal into the solid side points up).
      facing: l.ny < 0 ? 'roof' : 'floor',
      len: l.len, touched: !!t, touchFrames: t?.frames.length ?? 0, sledTouches: t?.sled ?? 0, bodyTouches: t?.body ?? 0,
      crossed: crossings.some(c => c.line === l.id), chainCrossed: crossings.some(c => c.chain === chainOf.get(l.id)) || inside.has(chainOf.get(l.id)!)};
  });
  return {maxTraceError, last, duration, frames, lines: lineRows, crossings, collidedThrough, sinks, episodes, touch, byId, role, chainEnds, chains};
}

/** Replay without `remove` and compare every point at every frame. */
export function removalTest(result: any, remove: Set<number>, last: number, base: Array<{p: P[]}>) {
  const track = {...result.track, lines: result.track.lines.filter((l: Line) => !remove.has(l.id))};
  const frames = replay(track, last);
  let first = -1, maxDiff = 0;
  for (let f = 0; f <= last; f++) for (let p = 0; p < 10; p++) {
    const d = Math.max(Math.abs(frames[f].p[p].x - base[f].p[p].x), Math.abs(frames[f].p[p].y - base[f].p[p].y));
    if (d > 0 && first < 0) first = f;
    maxDiff = Math.max(maxDiff, d);
  }
  return {first, maxDiff, frames};
}

/** The layout (fulfilment) check on a track, with roles inferred from endpoint geometry as the judge does. */
export function fulfilment(result: any, lines: Line[], frames: Array<{p: P[]; c: Array<[number, number, number]>; position?: P}>) {
  const plan = result.production.plan;
  const fragments = new Set<number>(plan.requests.filter((r: any) => r.construction === 'scattered').map((r: any) => r.section));
  const rolesInferred: Record<number, number[]> = {...(result.production.railGuides ?? {})};
  for (const s of Object.keys(rolesInferred)) if (!fragments.has(Number(s))) delete rolesInferred[Number(s)];
  let geometryError: string | null = null;
  try {
    for (const [i, chains] of arcRailGroups(lines.filter(l => !fragments.has(Math.floor((l.id - 1000) / 10000))) as any))
      rolesInferred[i] = (chains[1] ?? []).map(l => l.id);
  } catch (e) {geometryError = String(e);}
  const end = result.case.durationFrames + 20;
  const collisions = frames.slice(0, end + 1).map(fr => fr.c.map(c => c[0]));
  const positions = frames.slice(0, end + 1).map(fr => fr.position!);
  const r = inspectRepertoireLayout(plan, lines as any, rolesInferred, collisions, positions);
  return {geometryError, fulfilled: r.fulfilled, fulfilledSections: r.fulfilledSections, requested: r.requested,
    sections: r.sections.map((s: any) => ({section: s.section, fulfilled: s.fulfilled, reasons: s.reasons}))};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [out, ...paths] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const removalN = Number(process.argv.find(a => a.startsWith('--removal='))?.slice(10) ?? 0);
  const rides: any[] = [];
  for (const path of paths) {
    const result = JSON.parse(readFileSync(path, 'utf8'));
    const a = analyze(result);
    const ride: any = {path, song: result.case.song, variant: result.case.variant ?? null, seed: result.seed, valid: result.valid,
      fulfilled: result.production.realization.fulfilledSections, requested: result.production.realization.requested,
      maxTraceError: a.maxTraceError, durationFrames: a.duration, lastFrame: a.last,
      contactSummary: result.contactSummary, lines: a.lines, crossings: a.crossings, collidedThrough: a.collidedThrough, episodes: a.episodes,
      sinks: a.sinks.map(r => ({...r, section: Math.floor((a.chains[r.chain][0].id - 1000) / 10000), role: a.role.get(a.chains[r.chain].find(l => a.role.get(l.id) !== 'approach')?.id ?? a.chains[r.chain][0].id)})),
      sections: result.production.plan.requests.map((r: any) => ({section: r.section, frame: r.frame, next: r.next, construction: r.construction,
        guidance: r.guidance, layout: r.railLayout ?? null}))};
    // Fulfilment of the saved track as replayed here (must equal the saved realization).
    const lines: Line[] = result.track.lines;
    const baseF = fulfilment(result, lines, a.frames);
    ride.fulfilmentCheck = {fulfilledSections: baseF.fulfilledSections, geometryError: baseF.geometryError,
      matchesSaved: baseF.fulfilledSections === result.production.realization.fulfilledSections};
    // Remove every untouched line at once.
    const untouched = new Set<number>(a.lines.filter(l => !l.touched).map(l => l.id));
    const rem = removalTest(result, untouched, a.last, a.frames);
    const prunedLines = lines.filter(l => !untouched.has(l.id));
    const prunedF = fulfilment(result, prunedLines, rem.frames);
    ride.pruneAll = {removed: untouched.size, firstDivergence: rem.first, maxDiff: rem.maxDiff, geometryError: prunedF.geometryError,
      fulfilledSections: prunedF.fulfilledSections,
      newlyUnfulfilled: prunedF.sections.filter((s, i) => !s.fulfilled && baseF.sections[i].fulfilled).map(s => ({section: s.section, reasons: s.reasons}))};
    // Remove only the untouched lines that keep every chain connected: a chain's
    // untouched leading and trailing runs (so arcRailGroups still sees ≤ 2 chains).
    const ends = new Set<number>();
    const bySection = new Map<number, Line[]>();
    for (const l of lines) {const s = Math.floor((l.id - 1000) / 10000); let b = bySection.get(s); if (!b) bySection.set(s, b = []); b.push(l);}
    const fragments = new Set<number>(result.production.plan.requests.filter((r: any) => r.construction === 'scattered').map((r: any) => r.section));
    for (const [s, ls] of bySection) {
      if (fragments.has(s)) {for (const l of ls) if (untouched.has(l.id)) ends.add(l.id); continue;}
      const chains: Line[][] = [[]];
      for (const l of [...ls].sort((x, y) => x.id - y.id)) {
        const prev = chains.at(-1)!.at(-1);
        if (prev && (prev.x2 !== l.x1 || prev.y2 !== l.y1)) chains.push([]);
        chains.at(-1)!.push(l);
      }
      for (const ch of chains) {
        let i = 0; while (i < ch.length && untouched.has(ch[i].id)) i++;
        let j = ch.length - 1; while (j >= i && untouched.has(ch[j].id)) j--;
        // Keep at least one line of a fully untouched chain so the chain (and its role) still exists.
        if (i > j) {for (const l of ch.slice(1)) ends.add(l.id); continue;}
        for (const l of ch.slice(0, i)) ends.add(l.id);
        for (const l of ch.slice(j + 1)) ends.add(l.id);
      }
    }
    const remEnds = removalTest(result, ends, a.last, a.frames);
    const endF = fulfilment(result, lines.filter(l => !ends.has(l.id)), remEnds.frames);
    ride.pruneEnds = {removed: ends.size, removedLength: lines.filter(l => ends.has(l.id)).reduce((s, l) => s + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0),
      firstDivergence: remEnds.first, maxDiff: remEnds.maxDiff, geometryError: endF.geometryError, fulfilledSections: endF.fulfilledSections,
      newlyUnfulfilled: endF.sections.filter((s, i) => !s.fulfilled && baseF.sections[i].fulfilled).map(s => ({section: s.section, reasons: s.reasons}))};
    // Narrow prunes, one mechanism each: replay identity and the layout check.
    const prune = (ids: Set<number>) => {
      const rr = removalTest(result, ids, a.last, a.frames), ff = fulfilment(result, lines.filter(l => !ids.has(l.id)), rr.frames);
      return {removed: ids.size, removedLength: lines.filter(l => ids.has(l.id)).reduce((s, l) => s + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0),
        firstDivergence: rr.first, geometryError: ff.geometryError, fulfilledSections: ff.fulfilledSections,
        newlyUnfulfilled: ff.sections.filter((s, i) => !s.fulfilled && baseF.sections[i].fulfilled).map(s => ({section: s.section, reasons: s.reasons}))};
    };
    const crossedUntouched = new Set<number>(a.crossings.filter(c => !a.touch.has(c.line)).map(c => c.line));
    const leadIn = new Set<number>(a.lines.filter(l => l.role === 'approach' && !l.touched).map(l => l.id));
    const guideLeading = new Set<number>();
    for (const ch of a.chains) {
      const r0 = a.role.get(ch[0].id);
      if (r0 !== 'guide' && r0 !== 'receiver') continue;
      for (const l of ch) {if (a.touch.has(l.id)) break; guideLeading.add(l.id);}
      if (guideLeading.has(ch.at(-1)!.id)) guideLeading.delete(ch.at(-1)!.id);   // keep a fully untouched chain's last line
    }
    ride.pruneCrossed = prune(crossedUntouched);
    ride.pruneLeadIn = prune(leadIn);
    ride.pruneGuideLeading = prune(guideLeading);
    // Necessity, for an evenly spaced sample of episodes with a point crossing:
    // (1) remove only the crossed lines; (2) remove the whole crossed chain.
    const crossed = a.episodes.filter(e => e.crossings > 0);
    const step = Math.max(1, Math.ceil(crossed.length / Math.max(1, removalN)));
    ride.crossedRemovals = crossed.filter((_, i) => i % step === 0).slice(0, removalN).map(e => {
      const ids = new Set<number>(e.lines), chain = new Set<number>(a.chains[e.chain].map(l => l.id));
      const r1 = removalTest(result, ids, a.last, a.frames), r2 = removalTest(result, chain, a.last, a.frames);
      const touched = [...ids].filter(id => a.touch.has(id));
      return {section: e.section, role: e.role, start: e.start, lines: [...ids], linesTouched: touched.length,
        linesFirstTouch: touched.length ? Math.min(...touched.map(id => a.touch.get(id)!.frames[0])) : null,
        lineRemoval: {firstDivergence: r1.first, maxDiff: r1.maxDiff},
        chainTouched: e.chainTouched, chainRemoval: {firstDivergence: r2.first, maxDiff: r2.maxDiff}};
    });
    rides.push(ride);
    console.error(`${ride.song} ${ride.seed}: traceErr ${a.maxTraceError} episodes ${a.episodes.length} crossings ${a.crossings.length} untouched ${untouched.size}/${lines.length} pruneAll div ${rem.first} ends div ${remEnds.first}`);
  }
  writeFileSync(out, JSON.stringify(rides));
}
