/** How close each kept rail comes to its own support (report only, geometry alone): for every gap with a rail in rides
 * `npm run compare` saved, the rail's closest approach to the support it was laid beside (the gap's main line), and
 * whether any of it lies on the other side of that support. Bands: crossing (any part on the other side), under the
 * sled's height (about 6 px: not even the sled fits, the rider goes through), under the rider's height (6–10 px: the
 * sled fits, the body passes through the rail), above the rider. With --page=FILE, pictures of a random sample of each
 * band (the support, the rail, the rider's figure through the gap).
 * --at=rider measures instead where the rider is: at every frame the sled rides the gap's support, the rail's height above
 * that support at the sled's position (along the support piece's normal there; negative: the rail is on the other side),
 * and bands each rail by its lowest such height. A rail the rider never rides under is not banded.
 *   node tools/research/rail_audit.ts [--arm=2fee4728896e469a] [--seeds=101,202,303,404] [--page=FILE] [--sample=8] */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString()), gapOf = (id: number) => Math.floor((id - 1000) / 10000);
export const SLED_HEIGHT = 6, RIDER_HEIGHT = 10;

/** Signed distance of point p from the polyline: magnitude to the nearest piece, sign by that piece's left/right side. */
function signedDistance(p: {x: number; y: number}, pieces: any[]) {
  let best = Infinity, sign = 1;
  for (const l of pieces) {
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p.x - l.x1) * dx + (p.y - l.y1) * dy) / len2));
    const d = Math.hypot(p.x - l.x1 - u * dx, p.y - l.y1 - u * dy);
    if (d < best) {best = d; sign = dx * (p.y - l.y1) - dy * (p.x - l.x1) >= 0 ? 1 : -1;}
  }
  return sign * best;
}

/** The rail's height above the support piece l at the point (x, y) of l: where the normal through (x, y) meets the rail
 * (positive on the rider's side of the support, which for a floor is screen-up), or null when it misses the rail. */
function railHeightAt(l: any, x: number, y: number, rail: any[]) {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;   // left normal = up for a floor drawn left to right
  const up = (l.flipped ? -1 : 1);
  let best: number | null = null;
  for (const r of rail) {
    const ex = r.x2 - r.x1, ey = r.y2 - r.y1, den = nx * ey - ny * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((r.x1 - x) * ey - (r.y1 - y) * ex) / den, u = ((r.x1 - x) * ny - (r.y1 - y) * nx) / den;
    if (u < 0 || u > 1 || Math.abs(t) > 40) continue;
    if (best === null || Math.abs(t) < Math.abs(best)) best = t;
  }
  return best === null ? null : up * best;
}

export function railsOf(track: any, production: any) {
  const guides = new Set<number>(Object.values(production.railGuides ?? {}).flat() as number[]), fragments = new Set<number>(production.fragmentSections ?? []);
  const byGap = new Map<number, {main: any[]; rail: any[]}>();
  for (const l of track.lines) {const g = gapOf(l.id); if (fragments.has(g)) continue; if (!byGap.has(g)) byGap.set(g, {main: [], rail: []}); byGap.get(g)![guides.has(l.id) ? 'rail' : 'main'].push(l);}
  const out: any[] = [];
  for (const [gap, {main, rail}] of byGap) {
    if (!rail.length || !main.length) continue;
    const pts = rail.flatMap(l => [{x: l.x1, y: l.y1}, {x: l.x2, y: l.y2}]), d = pts.map(p => signedDistance(p, main));
    const side = Math.sign([...d].sort((a, b) => a - b)[Math.floor(d.length / 2)]) || 1;   // the rail's own side: its median point's
    const crossing = d.some(x => Math.sign(x) === -side && Math.abs(x) > .5), closest = Math.min(...d.map(Math.abs));
    out.push({gap, closest: +closest.toFixed(2), crossing, band: crossing ? 'crossing' : closest < SLED_HEIGHT ? 'under the sled' : closest < RIDER_HEIGHT ? 'under the rider' : 'above the rider', main, rail});
  }
  return out;
}

if (import.meta.filename === process.argv[1]) {
  const dir = join('generated/eval/arms', arg('arm', '2fee4728896e469a'), 'cells'), seeds = arg('seeds', '101,202,303,404').split(',');
  const rides = readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).map(f => f.slice(0, -5)).sort();
  const all: any[] = [];
  for (const id of rides) {
    const production = gz(join(dir, `${id}.gallery.json.gz`)).production ?? {}, track = gz(join(dir, `${id}.track.json.gz`));
    const rails = railsOf(track, production);
    if (arg('at', '') === 'rider') {
      const cell = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), frames = observe(track, cell.terminus.frame, cell.case.targets).frames;
      const lines = new Map<number, any>(track.lines.map((l: any) => [l.id, l])), byGap = new Map(rails.map(r => [r.gap, r]));
      const lowest = new Map<number, {h: number; f: number}>();
      frames.forEach((fr: any, f: number) => {
        const sup = fr.collisions.find(([lid, p]: number[]) => p < 4 && byGap.has(gapOf(lid)) && byGap.get(gapOf(lid))!.main.some((m: any) => m.id === lid));
        if (!sup) return;
        const l = lines.get(sup[0]), cx = [0, 1, 2, 3].reduce((a, i) => a + fr.points[i][0], 0) / 4, cy = [0, 1, 2, 3].reduce((a, i) => a + fr.points[i][1], 0) / 4;
        const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len2 = dx * dx + dy * dy || 1, u = ((cx - l.x1) * dx + (cy - l.y1) * dy) / len2;
        const h = railHeightAt(l, l.x1 + u * dx, l.y1 + u * dy, byGap.get(gapOf(sup[0]))!.rail);
        if (h === null) return;
        const g = gapOf(sup[0]), cur = lowest.get(g);
        if (!cur || h < cur.h) lowest.set(g, {h, f});
      });
      for (const r of rails) {
        const low = lowest.get(r.gap);
        if (!low) continue;
        r.closest = +low.h.toFixed(2); r.crossing = low.h < 0;
        r.band = low.h < 0 ? 'crossing' : low.h < SLED_HEIGHT ? 'under the sled' : low.h < RIDER_HEIGHT ? 'under the rider' : 'above the rider';
        all.push({ride: id, ...r, frame: Math.max(0, low.f - 20), next: low.f + 12});
      }
    } else for (const r of rails) all.push({ride: id, ...r, frame: production.plan?.requests?.[r.gap]?.frame, next: production.plan?.requests?.[r.gap]?.next});
  }
  const bands = ['crossing', 'under the sled', 'under the rider', 'above the rider'];
  console.log(`${rides.length} rides, ${all.length} rails kept (${(all.length / rides.length).toFixed(1)} per ride); closest approach to their own support:`);
  for (const b of bands) {const n = all.filter(r => r.band === b).length; console.log(`  ${b.padEnd(16)} ${n} (${(100 * n / all.length).toFixed(1)}%, ${(n / rides.length).toFixed(2)} per ride)`);}
  const page = arg('page', '');
  if (page) {
    let seed = 20261114; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const sample = Number(arg('sample', '8')), BONES = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 6], [5, 7], [4, 8], [4, 9]];
    const sections = bands.map(b => {
      const pool = all.filter(r => r.band === b).map(r => [rnd(), r] as const).sort((a, b) => a[0] - b[0]).slice(0, sample).map(x => x[1]);
      const figs = pool.map(r => {
        const cell = JSON.parse(readFileSync(join(dir, `${r.ride}.json`), 'utf8')), track = gz(join(dir, `${r.ride}.track.json.gz`));
        const frames = observe(track, cell.terminus.frame, cell.case.targets).frames.slice(Math.max(0, (r.frame ?? 0) - 4), (r.next ?? r.frame + 30) + 8);
        const ls = [...r.main, ...r.rail], xs = ls.flatMap((l: any) => [l.x1, l.x2]), ys = ls.flatMap((l: any) => [l.y1, l.y2]), m = 20;
        const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m, x1 = Math.max(...xs) + m, y1 = Math.max(...ys) + m, W = 330, sc = W / (x1 - x0), H = Math.min(260, (y1 - y0) * sc);
        const X = (x: number) => ((x - x0) * sc).toFixed(1), Y = (y: number) => ((y - y0) * sc).toFixed(1);
        let svg = '';
        for (const fr of frames) for (const [a, b] of BONES) svg += `<line x1="${X(fr.points[a][0])}" y1="${Y(fr.points[a][1])}" x2="${X(fr.points[b][0])}" y2="${Y(fr.points[b][1])}" stroke="#bbb" stroke-width=".6"/>`;
        for (const l of r.main) svg += `<line x1="${X(l.x1)}" y1="${Y(l.y1)}" x2="${X(l.x2)}" y2="${Y(l.y2)}" stroke="#111" stroke-width="1.8" stroke-linecap="round"/>`;
        for (const l of r.rail) svg += `<line x1="${X(l.x1)}" y1="${Y(l.y1)}" x2="${X(l.x2)}" y2="${Y(l.y2)}" stroke="#2a6fdb" stroke-width="1.8" stroke-linecap="round"/>`;
        return `<figure><svg data-x="" viewBox="0 0 ${W} ${((y1 - y0) * sc).toFixed(0)}" width="${W}" height="${H.toFixed(0)}" preserveAspectRatio="xMidYMid meet" style="background:#fff;border:1px solid #ddd">${svg}</svg><figcaption>${r.ride.replace(/~/g, ' · ')} · ${((r.frame ?? 0) / 40).toFixed(2)} s · closest ${r.closest} px</figcaption></figure>`;
      });
      const n = all.filter(r => r.band === b).length;
      return `<h2>${b}: ${n} rails (${(100 * n / all.length).toFixed(1)}%)</h2><div class="g">${figs.join('')}</div>`;
    });
    writeFileSync(page, `<!doctype html><meta charset=utf-8><title>Rails and their support</title><style>body{font:14px system-ui,sans-serif;margin:16px;background:#faf8f5}.g{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}figcaption{font-size:12px;color:#555;max-width:330px}h2{margin-top:28px}</style>
<h1>How close each rail comes to its own support</h1><p>Every rail kept in the foundation's V8 rides, by its closest approach to the line it was laid beside. Black: the support; blue: its rail; grey: the rider's figure through the gap. A random sample of ${sample} per band. Crossing: part of the rail lies on the other side of the support. Under the sled: closer than the sled is tall (about ${SLED_HEIGHT} px). Under the rider: the sled fits, the body would pass through the rail (${SLED_HEIGHT}–${RIDER_HEIGHT} px). Above the rider: ${RIDER_HEIGHT} px or more.</p>${sections.join('')}`);
    console.log(`pictures: ${page}`);
  }
  process.exit(0);
}
