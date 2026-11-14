// Wider: a line (one gap's main line, rail or fragments) that most of the rider's points (6 of 10) cross without touching
// it, within 4 frames; compared with the narrow sled-centre definition (through2.ts).
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';
import {cut} from './pass_through.ts';
import {study} from './going_through.ts';
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString()), gapOf = (id: number) => Math.floor((id - 1000) / 10000);
export function wide(dir: string, id: string) {
  const cell = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), track = gz(join(dir, `${id}.track.json.gz`));
  const production = gz(join(dir, `${id}.gallery.json.gz`)).production ?? {};
  const guides = new Set<number>(Object.values(production.railGuides ?? {}).flat() as number[]), fragments = new Set<number>(production.fragmentSections ?? []);
  const role = (lid: number) => guides.has(lid) ? 'rail' : fragments.has(gapOf(lid)) ? 'fragment' : 'main';
  const frames = observe(track, cell.terminus.frame, cell.case.targets).frames;
  const touchedChain = new Map<string, number[]>();
  frames.forEach((fr: any, f: number) => {for (const [lid] of fr.collisions) {const c = `${gapOf(lid)}|${role(lid)}`; if (!touchedChain.has(c)) touchedChain.set(c, []); touchedChain.get(c)!.push(f);}});
  const crossings = new Map<string, Array<{f: number; p: number}>>();
  for (let f = 1; f < frames.length; f++) frames[f].points.forEach(([x, y, px, py]: number[], p: number) => {
    for (const l of track.lines) {
      if (Math.max(l.x1, l.x2) < Math.min(x, px) - 1 || Math.min(l.x1, l.x2) > Math.max(x, px) + 1 || Math.max(l.y1, l.y2) < Math.min(y, py) - 1 || Math.min(l.y1, l.y2) > Math.max(y, py) + 1) continue;
      if (frames[f].collisions.some(([lid]: number[]) => lid === l.id) || frames[f + 1]?.collisions.some(([lid]: number[]) => lid === l.id)) continue;
      if (!cut(px, py, x, y, l)) continue;
      const c = `${gapOf(l.id)}|${role(l.id)}`; if (!crossings.has(c)) crossings.set(c, []); crossings.get(c)!.push({f, p});
    }
  });
  const events: any[] = [];
  for (const [c, xs] of crossings) {
    xs.sort((a, b) => a.f - b.f);
    for (let i = 0; i < xs.length;) {
      let j = i; while (j + 1 < xs.length && xs[j + 1].f - xs[i].f <= 4) j++;
      const pts = new Set(xs.slice(i, j + 1).map(x => x.p)), f = xs[i].f;
      const touchedThen = (touchedChain.get(c) ?? []).some(t => Math.abs(t - f) <= 4);
      if (pts.size >= 6 && !(c.endsWith('main') && touchedThen)) events.push({t: +(f / 40).toFixed(2), f, line: c, role: c.split('|')[1], points: pts.size});
      i = j + 1;
    }
  }
  return events;
}
if (import.meta.filename === process.argv[1]) {
  const dir = process.argv[2], seeds = (process.argv[3] ?? '101').split(',');
  const rides = readdirSync(dir).filter(f => /\.json$/.test(f) && !f.includes('gallery') && (dir.includes('armlike') || f.includes('~v8-')) && seeds.some(s => f.endsWith(`~${s}.json`))).map(f => f.slice(0, -5));
  let w = 0, narrow = 0, onlyWide = 0; const roles: Record<string, number> = {};
  for (const id of rides) {
    const ev = wide(dir, id), nr = study(dir, id).through;
    w += ev.length; narrow += nr.length;
    for (const e of ev) {roles[e.role] = (roles[e.role] ?? 0) + 1; if (!nr.some((x: any) => Math.abs(x.f - e.f) <= 6 && x.line === e.line)) onlyWide++;}
  }
  console.log(`${rides.length} rides: wide ${(w / rides.length).toFixed(2)} per ride ${JSON.stringify(roles)}; narrow ${(narrow / rides.length).toFixed(2)}; found only by the wide one ${(onlyWide / rides.length).toFixed(2)} per ride`);
}
