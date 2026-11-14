/** The rider going entirely through a line (report only), the case the owner means by riding through geometry. A: a rail touching or crossing its own gap's main line. B: the sled's centre passing through a drawn line it does not collide with. */
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';
import {cut} from './pass_through.ts';
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString()), gapOf = (id: number) => Math.floor((id - 1000) / 10000);
const segX = (a: any, b: any) => {   // do two pieces touch or cross (shared endpoints excepted)?
  const d = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = d(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1), d2 = d(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2), d3 = d(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1), d4 = d(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return d1 * d2 < 0 && d3 * d4 < 0;
};
export function study(dir: string, id: string) {
  const cell = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), track = gz(join(dir, `${id}.track.json.gz`));
  const production = gz(join(dir, `${id}.gallery.json.gz`)).production ?? {};
  const guides = new Set<number>(Object.values(production.railGuides ?? {}).flat() as number[]), fragments = new Set<number>(production.fragmentSections ?? []);
  const byGap = new Map<number, {main: any[]; rail: any[]}>();
  for (const l of track.lines) {const g = gapOf(l.id); if (fragments.has(g)) continue; if (!byGap.has(g)) byGap.set(g, {main: [], rail: []}); byGap.get(g)![guides.has(l.id) ? 'rail' : 'main'].push(l);}
  const railCross: any[] = [];
  for (const [g, {main, rail}] of byGap) {
    if (!rail.length) continue;
    const hits = rail.filter(r => main.some(m => segX(r, m)));
    // the rail's distance from its support at the rail's start: nearest main piece to the first rail point
    const first = rail.reduce((a, b) => (a.id < b.id ? a : b)), near = Math.min(...main.map(m => {
      const dx = m.x2 - m.x1, dy = m.y2 - m.y1, L = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((first.x1 - m.x1) * dx + (first.y1 - m.y1) * dy) / L));
      return Math.hypot(first.x1 - m.x1 - u * dx, first.y1 - m.y1 - u * dy);}));
    railCross.push({gap: g, crosses: hits.length > 0, startGap: +near.toFixed(1), x: first.x1, y: first.y1});
  }
  const frames = observe(track, cell.terminus.frame, cell.case.targets).frames, lines = track.lines;
  const centre = (fr: any) => [0, 1, 2, 3].reduce((a, i) => [a[0] + fr.points[i][0] / 4, a[1] + fr.points[i][1] / 4], [0, 0]);
  const through: any[] = [], last = new Map<string, number>();
  for (let f = 1; f < frames.length; f++) {
    const near = new Set([...(frames[f - 1]?.collisions ?? []), ...frames[f].collisions, ...(frames[f + 1]?.collisions ?? [])].map(([l]: number[]) => gapOf(l)));
    const [px, py] = centre(frames[f - 1]), [x, y] = centre(frames[f]);
    for (const l of lines) {
      if (Math.max(l.x1, l.x2) < Math.min(px, x) - 1 || Math.min(l.x1, l.x2) > Math.max(px, x) + 1) continue;
      const c = cut(px, py, x, y, l); if (!c) continue;
      const chain = `${gapOf(l.id)}|${guides.has(l.id) ? 'rail' : fragments.has(gapOf(l.id)) ? 'fragment' : 'main'}`;
      if (near.has(gapOf(l.id)) && !guides.has(l.id)) continue;   // its own support, being ridden
      if ((last.get(chain) ?? -9) >= f - 2) {last.set(chain, f); continue;}
      last.set(chain, f);
      through.push({t: +(f / 40).toFixed(2), f, line: chain, role: chain.split('|')[1], touched: frames.slice(Math.max(0, f - 3), f + 4).some((fr: any) => fr.collisions.some(([lid]: number[]) => lid === l.id))});
    }
  }
  return {railCross, through: through.filter(t => !t.touched), track, guides};
}
if (import.meta.filename === process.argv[1]) {
  const dir = process.argv[2], seeds = (process.argv[3] ?? '101').split(',');
  const rides = readdirSync(dir).filter(f => /\.json$/.test(f) && !f.includes('gallery') && (dir.includes('armlike') || f.includes('~v8-')) && seeds.some(s => f.endsWith(`~${s}.json`))).map(f => f.slice(0, -5));
  let rails = 0, crossing = 0, startClose = 0, thr = 0; const byRole: Record<string, number> = {};
  for (const id of rides) {const r = study(dir, id); rails += r.railCross.length; crossing += r.railCross.filter(x => x.crosses).length; startClose += r.railCross.filter(x => x.startGap < 4).length; thr += r.through.length; for (const t of r.through) byRole[t.role] = (byRole[t.role] ?? 0) + 1;}
  console.log(`${rides.length} rides: rails ${(rails / rides.length).toFixed(1)} per ride; A: rails crossing their own support ${(crossing / rides.length).toFixed(1)} per ride (${(100 * crossing / Math.max(1, rails)).toFixed(0)}%), rails starting within 4 px of it ${(startClose / rides.length).toFixed(1)} (${(100 * startClose / Math.max(1, rails)).toFixed(0)}%); B: the sled's centre through a line ${(thr / rides.length).toFixed(1)} per ride ${JSON.stringify(byRole)}`);
}
