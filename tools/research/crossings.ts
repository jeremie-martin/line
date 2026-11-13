/** Lines the rider passes through (report only): per ride, the frames where a rider point's motion from its previous
 * position cuts a line it is not colliding with in that frame or the next, counted as episodes (consecutive frames of one
 * line), those 3 px or more past the line, and those of a section's straight lead-in (its first line). A line met from its non-colliding side is drawn through the rider.
 *   node tools/research/crossings.ts NAME=ARM_DIR [NAME2=ARM_DIR2 ...] [--match=REGEX] */
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {observe} from '../measure/observe.ts';

function crossings(armDir: string, ride: string) {
  const cell = JSON.parse(readFileSync(join(armDir, 'cells', `${ride}.json`), 'utf8'));
  const track = JSON.parse(gunzipSync(readFileSync(join(armDir, 'cells', `${ride}.track.json.gz`))).toString());
  const obs = observe(track, cell.case.targets.at(-1).frame + 40, cell.case.targets);
  const gallery = JSON.parse(gunzipSync(readFileSync(join(armDir, 'cells', `${ride}.gallery.json.gz`))).toString());
  const guides = new Set<number>(Object.values(gallery.production?.railGuides ?? {}).flat() as number[]);
  const fragments = new Set<number>(gallery.production?.fragmentSections ?? []);
  const role = (id: number) => fragments.has(Math.floor((id - 1000) / 10000)) ? 'fragment' : guides.has(id) ? 'guide' : 'main';
  const roles: Record<string, number> = {};
  const cells = new Map<string, any[]>(), key = (x: number, y: number) => `${Math.floor(x / 32)},${Math.floor(y / 32)}`;
  for (const l of track.lines) for (let gx = Math.floor(Math.min(l.x1, l.x2) / 32); gx <= Math.floor(Math.max(l.x1, l.x2) / 32); gx++)
    for (let gy = Math.floor(Math.min(l.y1, l.y2) / 32); gy <= Math.floor(Math.max(l.y1, l.y2) / 32); gy++) {
      const k = `${gx},${gy}`; if (!cells.has(k)) cells.set(k, []); cells.get(k)!.push(l);
    }
  const cross = (ax: number, ay: number, bx: number, by: number, l: any) => {
    const d = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
    const d1 = d(l.x1, l.y1, l.x2, l.y2, ax, ay), d2 = d(l.x1, l.y1, l.x2, l.y2, bx, by), d3 = d(ax, ay, bx, by, l.x1, l.y1), d4 = d(ax, ay, bx, by, l.x2, l.y2);
    return d1 * d2 < 0 && d3 * d4 < 0 ? Math.abs(d2) / Math.hypot(l.x2 - l.x1, l.y2 - l.y1) : 0;
  };
  let episodes = 0, deep = 0, leadIns = 0, last = new Map<number, number>();
  for (let f = 1; f < obs.frames.length; f++) {
    const touching = new Set([...obs.frames[f].collisions, ...(obs.frames[f + 1]?.collisions ?? [])].map(([id]: number[]) => id));
    for (const [p, [x, y, px, py]] of obs.frames[f].points.entries()) {
      const seen = new Set<any>();
      for (const k of new Set([key(x, y), key(px, py)])) for (const l of cells.get(k) ?? []) {
        if (seen.has(l) || touching.has(l.id) || touching.has(l.id - 1) || touching.has(l.id + 1)) continue; seen.add(l);
        const depth = cross(px, py, x, y, l); if (!depth) continue;
        if ((last.get(l.id) ?? -9) < f - 1) { episodes++; if (depth >= 3) deep++; if ((l.id - 1000) % 10000 === 0) leadIns++;
          const r = `${role(l.id)} by ${p < 4 ? 'sled' : 'body'}`; roles[r] = (roles[r] ?? 0) + 1; }
        last.set(l.id, f);
      }
    }
  }
  return {episodes, deep, leadIns, roles};
}

const arms = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=') && !a.startsWith('--')).map(a => a.split('=', 2)));
const match = new RegExp(process.argv.find(a => a.startsWith('--match='))?.slice(8) ?? '~101$');
const rides = Object.values(arms).map(d => new Set(readdirSync(join(d as string, 'cells')).filter(f => f.endsWith('.track.json.gz')).map(f => f.slice(0, -14)).filter(r => match.test(r))))
  .reduce((a, b) => new Set([...a].filter(x => b.has(x))));
for (const [name, dir] of Object.entries(arms)) {
  const rs = [...rides].map(r => crossings(dir as string, r));
  const m = (k: 'episodes' | 'deep' | 'leadIns') => (rs.reduce((s, r) => s + r[k], 0) / rs.length).toFixed(1);
  console.log(`${name.padEnd(12)} ${rs.length} rides: lines crossed per ride ${m('episodes')}, 3 px or more ${m('deep')}, lead-ins (each section's first line) ${m('leadIns')}`);
  const all: Record<string, number> = {}; for (const r of rs) for (const [k, v] of Object.entries(r.roles)) all[k] = (all[k] ?? 0) + v / rs.length;
  console.log('  ' + Object.entries(all).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', '));
}
