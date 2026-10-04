/** How strong-requested hits physically happen: which rider points touch, whether
 * the sled lands flat or on a tip, whether the rider sticks or rebounds, and how
 * much of the body's velocity change is into the line (a slam) rather than along
 * it (a glancing turn). Reads tools/measure/observe.ts output.
 *
 *   node --import tsx tools/measure/hit_anatomy.ts [--sets=july,current,strike] [--min=0.6] [--rows=FILE.jsonl] */
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {OUT, POINTS, sources} from './observe.ts';
import {strikeFrames, detectStrikes} from './strike.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const sets = arg('sets', 'july,current,strike').split(','), min = Number(arg('min', '0.6'));
const [PEG, TAIL, NOSE] = [0, 1, 2], SLED = [0, 1, 2, 3];
const median = (xs: number[]) => {const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN;};
const pct = (xs: boolean[]) => (100 * xs.filter(Boolean).length / Math.max(1, xs.length)).toFixed(0).padStart(4) + '%';

export type Hit = {set: string; song: string; seed: number; frame: number; requested: number; strength: number | null;
  touched: string[]; landing: 'flat' | 'nose' | 'tail' | 'body' | 'none'; rebound: boolean; guide: boolean; firstTouch: string[]; approach: number; surface: 'floor' | 'wall' | 'ceiling' | 'none'; upright: boolean | null; slam: number; normalIn: number; pitch: number; offset: number | null};

export function anatomy(o: any, track: any, minRequested: number): Hit[] {
  const lines = new Map<number, any>(track.lines.map((l: any) => [l.id, l]));
  // A compiled section with exactly two connected curves is a rail and its guide
  // (the second curve); fragments and single rails have no guide.
  const guides = new Set<number>(), chains = new Map<number, any[][]>();
  for (const l of track.lines) {
    const id = Math.floor((l.id - 1000) / 10000), c = chains.get(id) ?? [[]], last = c.at(-1)!.at(-1);
    if (last && (last.x2 !== l.x1 || last.y2 !== l.y1)) c.push([]);
    c.at(-1)!.push(l); chains.set(id, c);
  }
  for (const c of chains.values()) if (c.length === 2) for (const l of c[1]) guides.add(l.id);
  const events = detectStrikes(strikeFrames(o));
  const com = (f: number) => {
    let x = 0, y = 0; for (const [px, py, qx, qy] of o.frames[f].points) {x += px - qx; y += py - qy;} return {x: x / 10, y: y / 10};
  };
  const hits: Hit[] = [];
  for (const t of o.targets) {
    if ((t.impact ?? 0) < minRequested) continue;
    const e = events.filter((e: any) => Math.abs(e.onset - t.frame) <= 6).sort((a: any, b: any) => Math.abs(a.onset - t.frame) - Math.abs(b.onset - t.frame))[0];
    const base = {set: o.set, song: o.song, seed: o.seed, frame: t.frame, requested: t.impact};
    if (!e || e.onset + 8 >= o.frames.length || e.onset < 2) {
      hits.push({...base, strength: null, touched: [], landing: 'none', rebound: false, guide: false, firstTouch: [], approach: NaN, surface: 'none', upright: null, slam: NaN, normalIn: NaN, pitch: NaN, offset: null});
      continue;
    }
    const f0 = e.onset, window = Array.from({length: 6}, (_, k) => f0 + k);
    const touched = new Set<number>(), first: number[][] = [];
    for (const f of window) for (const [id, p] of o.frames[f].collisions) {touched.add(p); if (!first.length || first[0][2] === f) first.push([id, p, f]);}
    const guide = window.some(f => o.frames[f].collisions.some(([id]: number[]) => guides.has(id)));
    const sled = SLED.filter(p => touched.has(p)), body = [...touched].some(p => p >= 4);
    const landing = body ? 'body' : touched.has(TAIL) && (touched.has(NOSE) || touched.has(PEG)) ? 'flat' : touched.has(NOSE) ? 'nose' : sled.length ? 'tail' : 'none';
    // Rebound: the rider leaves every line within 8 frames of onset and stays off for 4.
    let rebound = false;
    for (let f = f0 + 1; f <= f0 + 8 && !rebound; f++)
      rebound = [0, 1, 2, 3].every(k => o.frames[f + k] && !o.frames[f + k].collisions.length);
    const line = first.length ? lines.get(first[0][0]) : undefined;
    const before = com(f0 - 1), after = com(Math.min(o.frames.length - 1, f0 + 6));
    let approach = NaN, slam = NaN, normalIn = NaN, pitch = NaN, surface: Hit['surface'] = 'none';
    if (line) {
      const dx = line.x2 - line.x1, dy = line.y2 - line.y1, len = Math.hypot(dx, dy) || 1;
      let n = {x: -dy / len, y: dx / len};
      if (before.x * n.x + before.y * n.y < 0) n = {x: -n.x, y: -n.y};   // orient into the line
      const dv = {x: after.x - before.x, y: after.y - before.y}, dvn = dv.x * n.x + dv.y * n.y;
      // Screen y points down: a line the rider moves down into is a floor.
      surface = n.y > .5 ? 'floor' : n.y < -.5 ? 'ceiling' : 'wall';
      slam = Math.abs(dvn) / (Math.hypot(dv.x, dv.y) || 1);
      normalIn = before.x * n.x + before.y * n.y;
      approach = Math.asin(Math.min(1, normalIn / (Math.hypot(before.x, before.y) || 1))) * 180 / Math.PI;
      const [tx, ty] = o.frames[f0].points[TAIL], [nx, ny] = o.frames[f0].points[NOSE];
      const a = Math.abs(Math.atan2((nx - tx) * dy - (ny - ty) * dx, (nx - tx) * dx + (ny - ty) * dy)) * 180 / Math.PI;
      pitch = Math.min(a, 180 - a);
    }
    // Upright: the shoulder is above the sled (screen y smaller) at onset.
    const upright = o.frames[f0].points[5][1] < (o.frames[f0].points[TAIL][1] + o.frames[f0].points[NOSE][1]) / 2;
    hits.push({...base, strength: e.strength, touched: [...touched].sort().map(p => POINTS[p]), landing, rebound, guide, firstTouch: [...new Set(first.map(x => POINTS[x[1]]))].sort(), approach, surface, upright, slam, normalIn, pitch, offset: f0 - t.frame});
  }
  return hits;
}

if (import.meta.filename === process.argv[1]) {
  const tracks = new Map(sources(sets).map(s => [`${s.set}~${s.song}~${s.seed}`, s.track]));
  const index = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')).filter((r: any) => sets.includes(r.set));
  const all: Hit[] = [];
  for (const r of index) {
    const o = JSON.parse(gunzipSync(readFileSync(join(OUT, r.id + '.json.gz'))).toString());
    all.push(...anatomy(o, tracks.get(r.id), min));
  }
  console.log(`strong-requested hits (requested >= ${min})`);
  console.log('set        hits  matched  strength  guide  flat   nose   tail   body  rebound  floor   wall  ceil  upright  normal-in  pitch°');
  for (const set of sets) {
    const h = all.filter(x => x.set === set), m = h.filter(x => x.strength !== null);
    console.log(`${set.padEnd(9)} ${String(h.length).padStart(5)} ${pct(h.map(x => x.strength !== null))}   ${median(m.map(x => x.strength!)).toFixed(2).padStart(6)}  ${pct(m.map(x => x.guide))}  ` +
      ['flat', 'nose', 'tail', 'body'].map(k => pct(m.map(x => x.landing === k))).join('  ') + `  ${pct(m.map(x => x.rebound))}    ` +
      ['floor', 'wall', 'ceiling'].map(k => pct(m.map(x => x.surface === k))).join(' ') + ` ${pct(m.map(x => !!x.upright))}    ` +
      `${median(m.map(x => x.normalIn)).toFixed(2).padStart(6)}   ${median(m.map(x => x.pitch)).toFixed(0).padStart(4)}`);
  }
  const rowsPath = process.argv.find(a => a.startsWith('--rows='))?.slice(7);
  if (rowsPath) writeFileSync(rowsPath, all.map(x => JSON.stringify(x)).join('\n') + '\n');
  process.exit(0);
}
