/** Lines the whole rider goes through (REWORK.md, November 14). A Line Rider line collides from one side only and is
 * drawn solid, so a rider passing through a line it never touches is seen riding through geometry. After a ride is
 * built, the pieces of such a line that the rider crosses, and never touches, are removed: what the rider meets is
 * unchanged, so the ride is too (the caller replays it to make sure).
 *
 * The whole rider goes through a line when (a) the sled's centre crosses it, a frame where nothing of that line's gap
 * holds the rider and the piece is not touched within 3 frames, or (b) 6 of the rider's 10 points cross one line (a
 * gap's main line, rail or fragments) within 4 frames, without touching it then (a main line touched then is the one
 * being ridden). For each such case the pieces of that line the rider's points cross within 4 frames are removed when
 * never touched in the ride, with the untouched stretch between each and the nearer end of its run: a line ends
 * earlier, and is never broken (a piece whose stretches to both ends are touched stays; each gap's main line and rail
 * remain one connected curve, as the rail grouping requires). Measured on the foundation's V8 rides (tools/research/
 * going_through_cleanup.ts): replays identical, cases 1.6 → 0.3 per ride, 3.5 pieces removed per ride. */
import type {TrackLine} from '../types.ts';

type Point = {x: number; y: number};
const CELL = 32;
const gapOf = (id: number) => Math.floor((id - 1000) / 10000);

/** Where the motion a→b cuts line l, or false. */
function cuts(a: Point, b: Point, l: TrackLine) {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
  const sa = dx * (a.y - l.y1) - dy * (a.x - l.x1), sb = dx * (b.y - l.y1) - dy * (b.x - l.x1);
  if (!(sa * sb < 0)) return false;
  const ex = b.x - a.x, ey = b.y - a.y, sc = ey * (l.x1 - a.x) - ex * (l.y1 - a.y), sd = ey * (l.x2 - a.x) - ex * (l.y2 - a.y);
  return sc * sd < 0;
}

/** The ids of pieces to remove. `points[f]` are the rider's 10 points at frame f (observe.ts order: the sled's four
 * first), `contacts[f]` the line ids touched at f, `role` a piece's line: main, rail or fragment. */
export function goneThrough(lines: readonly TrackLine[], points: ReadonlyArray<ReadonlyArray<Point>>,
  contacts: ReadonlyArray<ReadonlyArray<number>>, role: (l: TrackLine) => string): Set<number> {
  const touched = new Set<number>(), touchedAt = new Map<number, number[]>(), chainOf = (l: TrackLine) => `${gapOf(l.id)}|${role(l)}`;
  contacts.forEach((ids, f) => {for (const id of ids) {touched.add(id); const at = touchedAt.get(id); if (at) at.push(f); else touchedAt.set(id, [f]);}});
  const gapTouched = new Map<number, number[]>();
  for (const [id, fs] of touchedAt) {const g = gapOf(id), at = gapTouched.get(g); if (at) at.push(...fs); else gapTouched.set(g, [...fs]);}
  const near = (fs: number[] | undefined, f: number, k: number) => !!fs && fs.some(x => Math.abs(x - f) <= k);
  const grid = new Map<string, TrackLine[]>(), key = (x: number, y: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  for (const l of lines) for (let gx = Math.floor(Math.min(l.x1, l.x2) / CELL); gx <= Math.floor(Math.max(l.x1, l.x2) / CELL); gx++)
    for (let gy = Math.floor(Math.min(l.y1, l.y2) / CELL); gy <= Math.floor(Math.max(l.y1, l.y2) / CELL); gy++) {
      const k = `${gx},${gy}`, list = grid.get(k); if (list) list.push(l); else grid.set(k, [l]);
    }
  const nearby = (a: Point, b: Point) => {
    const out = new Set<TrackLine>();
    for (const k of new Set([key(a.x, a.y), key(b.x, b.y)])) for (const l of grid.get(k) ?? []) out.add(l);
    return out;
  };
  // every crossing of a piece the point does not touch that frame or the next
  const crossings: Array<{f: number; p: number; l: TrackLine}> = [];
  for (let f = 1; f < points.length; f++) {
    const now = new Set([...(contacts[f] ?? []), ...(contacts[f + 1] ?? [])]);
    points[f].forEach((b, p) => {
      const a = points[f - 1][p];
      for (const l of nearby(a, b)) if (!now.has(l.id) && cuts(a, b, l)) crossings.push({f, p, l});
    });
  }
  const cases: Array<{f: number; chain: string}> = [];
  // (a) the sled's centre
  const centre = (ps: ReadonlyArray<Point>) => ({x: (ps[0].x + ps[1].x + ps[2].x + ps[3].x) / 4, y: (ps[0].y + ps[1].y + ps[2].y + ps[3].y) / 4});
  const lastAt = new Map<string, number>();
  for (let f = 1; f < points.length; f++) {
    const a = centre(points[f - 1]), b = centre(points[f]);
    for (const l of nearby(a, b)) {
      if (!cuts(a, b, l)) continue;
      const chain = chainOf(l);
      if (role(l) === 'main' && near(gapTouched.get(gapOf(l.id)), f, 1)) continue;   // its own support, being ridden
      if (near(touchedAt.get(l.id), f, 3)) continue;
      if ((lastAt.get(chain) ?? -9) >= f - 2) {lastAt.set(chain, f); continue;}
      lastAt.set(chain, f); cases.push({f, chain});
    }
  }
  // (b) most of the rider's points through one line
  const byChain = new Map<string, Array<{f: number; p: number}>>();
  for (const c of crossings) {const k = chainOf(c.l), list = byChain.get(k); if (list) list.push({f: c.f, p: c.p}); else byChain.set(k, [{f: c.f, p: c.p}]);}
  for (const [chain, xs] of byChain) {
    xs.sort((a, b) => a.f - b.f);
    for (let i = 0; i < xs.length;) {
      let j = i; while (j + 1 < xs.length && xs[j + 1].f - xs[i].f <= 4) j++;
      const pts = new Set(xs.slice(i, j + 1).map(x => x.p)), f = xs[i].f, gap = Number(chain.split('|')[0]);
      if (pts.size >= 6 && !(chain.endsWith('|main') && near(gapTouched.get(gap), f, 4))) cases.push({f, chain});
      i = j + 1;
    }
  }
  if (!cases.length) return new Set();
  // the pieces crossed in each case, with the untouched stretch to the nearer end of their run
  const k2 = (x: number, y: number) => `${x.toFixed(6)},${y.toFixed(6)}`, byStart = new Map<string, TrackLine>(), byEnd = new Map<string, TrackLine>();
  for (const l of lines) {byStart.set(`${chainOf(l)}|${k2(l.x1, l.y1)}`, l); byEnd.set(`${chainOf(l)}|${k2(l.x2, l.y2)}`, l);}
  const walk = (l: TrackLine, next: (x: TrackLine) => TrackLine | undefined) => {
    const out = [l];
    for (let x = next(l); x; x = next(x)) {if (touched.has(x.id)) return null; out.push(x);}
    return out;
  };
  const drop = new Set<number>();
  for (const c of cases) for (const x of crossings) {
    if (Math.abs(x.f - c.f) > 4 || chainOf(x.l) !== c.chain || touched.has(x.l.id)) continue;
    const back = walk(x.l, z => byEnd.get(`${chainOf(z)}|${k2(z.x1, z.y1)}`)), ahead = walk(x.l, z => byStart.get(`${chainOf(z)}|${k2(z.x2, z.y2)}`));
    // a line is shortened from its nearer end, never broken: a gap's main line and rail each stay one connected curve
    const side = [back, ahead].filter((s): s is TrackLine[] => !!s).sort((a, b) => a.length - b.length)[0];
    if (side) for (const z of side) drop.add(z.id);
  }
  return drop;
}
