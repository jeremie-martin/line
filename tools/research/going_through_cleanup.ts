// Remove, for each case of the rider going entirely through a line (narrow or wide), the untouched pieces of that line the
// rider's points crossed within the case, extended to the line's nearer end where that stretch is untouched; check the
// replay is identical; recount.
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';
import {cut} from './pass_through.ts';
import {study} from './going_through.ts';
import {wide} from './going_through_wide.ts';
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString()), gapOf = (id: number) => Math.floor((id - 1000) / 10000);
const dir = process.argv[2], seeds = (process.argv[3] ?? '101').split(',');
const rides = readdirSync(dir).filter(f => /~v8-.*\.json$/.test(f) && !f.includes('gallery') && seeds.some(s => f.endsWith(`~${s}.json`))).map(f => f.slice(0, -5));
let identical = 0, before = 0, after = 0, removed = 0, breaks = 0;
const k = (x: number, y: number) => `${x.toFixed(6)},${y.toFixed(6)}`;
for (const id of rides) {
  const cell = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), track = gz(join(dir, `${id}.track.json.gz`));
  const frames = observe(track, cell.terminus.frame, cell.case.targets).frames, touched = new Set<number>();
  for (const fr of frames) for (const [lid] of fr.collisions) touched.add(lid);
  const ev = [...study(dir, id).through.map((t: any) => ({f: t.f, line: t.line})), ...wide(dir, id).map((e: any) => ({f: e.f, line: e.line}))];
  before += ev.length;
  const drop = new Set<number>(), production = gz(join(dir, `${id}.gallery.json.gz`)).production ?? {};
  const guides = new Set<number>(Object.values(production.railGuides ?? {}).flat() as number[]);
  const chainOf = (l: any) => `${gapOf(l.id)}|${guides.has(l.id) ? 'rail' : (production.fragmentSections ?? []).includes(gapOf(l.id)) ? 'fragment' : 'main'}`;
  const byStart = new Map<string, any>(), byEnd = new Map<string, any>();
  for (const l of track.lines) {byStart.set(`${chainOf(l)}|${k(l.x1, l.y1)}`, l); byEnd.set(`${chainOf(l)}|${k(l.x2, l.y2)}`, l);}
  const walk = (l: any, next: (x: any) => any) => {const o = [l]; for (let x = next(l); x; x = next(x)) {if (touched.has(x.id)) return null; o.push(x);} return o;};
  for (const e of ev) {
    const pieces = track.lines.filter((l: any) => chainOf(l) === e.line);
    for (let f = Math.max(1, e.f - 4); f <= Math.min(frames.length - 1, e.f + 4); f++) for (const [x, y, px, py] of frames[f].points)
      for (const l of pieces) if (!touched.has(l.id) && cut(px, py, x, y, l)) {
        const side = [walk(l, z => byEnd.get(`${chainOf(z)}|${k(z.x1, z.y1)}`)), walk(l, z => byStart.get(`${chainOf(z)}|${k(z.x2, z.y2)}`))].filter(Boolean).sort((a, b) => a!.length - b!.length)[0];
        for (const z of side ?? [l]) drop.add(z.id);
      }
  }
  const cleaned = {...track, lines: track.lines.filter((l: any) => !drop.has(l.id))};
  const b = observe(cleaned, cell.terminus.frame, cell.case.targets).frames;
  if (b.length === frames.length && frames.every((fa: any, f: number) => JSON.stringify(fa.points) === JSON.stringify(b[f].points))) identical++;
  removed += drop.size;
  const runs = (ls: any[]) => {const ends = new Set(ls.map(l => `${chainOf(l)}|${k(l.x2, l.y2)}`)); return ls.filter(l => !ends.has(`${chainOf(l)}|${k(l.x1, l.y1)}`)).length;};
  breaks += runs(cleaned.lines) - runs(track.lines);
  // recount on the cleaned track: rewrite a temporary copy is costly; count crossings of the cases' lines instead
  for (const e of ev) {
    let still = false;
    const pieces = cleaned.lines.filter((l: any) => chainOf(l) === e.line);
    for (let f = Math.max(1, e.f - 4); f <= Math.min(b.length - 1, e.f + 4) && !still; f++) {
      const [cx, cy] = [0, 1, 2, 3].reduce((a, i) => [a[0] + b[f].points[i][0] / 4, a[1] + b[f].points[i][1] / 4], [0, 0]);
      const [qx, qy] = [0, 1, 2, 3].reduce((a, i) => [a[0] + b[f - 1].points[i][0] / 4, a[1] + b[f - 1].points[i][1] / 4], [0, 0]);
      still = pieces.some((l: any) => !touched.has(l.id) && cut(qx, qy, cx, cy, l));
    }
    if (still) after++;
  }
}
console.log(`${rides.length} rides: replay identical in ${identical}; cases (narrow + wide) ${(before / rides.length).toFixed(2)} per ride, still crossed by the sled's centre after cleaning ${(after / rides.length).toFixed(2)}; pieces removed ${(removed / rides.length).toFixed(1)} per ride; new breaks ${(breaks / rides.length).toFixed(2)} per ride`);
