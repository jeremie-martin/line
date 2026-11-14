/** Where the rider passes through drawn geometry (report only). A Line Rider line collides from one side only, while
 * every line is drawn solid: a rider point crossing a drawn line it does not collide with is seen riding through it.
 * For rides `npm run compare` saved, replayed once, this records every such crossing: a frame where a rider point's
 * motion from its previous position cuts a line, with that line not in the point's collisions that frame or the next
 * (the solver's own touch-and-push is a collision, not a pass-through). Crossings of one line within 2 frames of each
 * other form one episode. Each episode is described by:
 *   depth      the deepest any point ended past the line, px;
 *   frames     how long it lasts;
 *   role       the line's: main (support, receiver), rail (a guide), fragment (scattered), and lead-in (a gap's first line);
 *   gap        the crossed line's gap against the gap being ridden: same, previous, next or far;
 *   who        sled (its four points) or body (the six others), or both;
 *   touched    whether any rider point ever collides with that line piece in the ride: never; near (within 3 frames of
 *              the episode); or elsewhere (only at other times);
 *   apart      for a touched piece, the distance along it between the crossing and the nearest touch, px (a piece
 *              could only be split to keep the touch and drop the crossing when these are apart);
 *   length     the piece's length, px.
 * And what is seen: frames in which a drawn line cuts through the rider's figure (the sled's frame, the torso from seat
 * to shoulder, the arms and the legs, between their joints), a line touching the rider then or a frame either side
 * excepted. Frames in a row in which one drawn line (a gap's main line, its rail or its fragments, whichever short
 * pieces of it) cuts the figure make one sighting; its length in frames is how long the rider is seen riding through it.
 *   node tools/research/pass_through.ts [--arm=2fee4728896e469a] [--seeds=101,202,303,404] [--out=FILE.jsonl] */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());
const SLED = 4, CELL = 32;
/** The rider's figure as bones between its points (observe.ts POINTS: PEG TAIL NOSE STRING BUTT SHOULDER RHAND LHAND LFOOT RFOOT). */
const BONES: Array<[number, number, string]> = [[0, 1, 'sled'], [1, 3, 'sled'], [3, 2, 'sled'], [2, 0, 'sled'], [4, 5, 'torso'],
  [5, 6, 'arm'], [5, 7, 'arm'], [4, 8, 'leg'], [4, 9, 'leg']];
/** Whether segments a–b and line l cross strictly inside both (a joint resting on a line is not a cut). */
function through(ax: number, ay: number, bx: number, by: number, l: any) {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1, ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-12) return false;
  const u = ((ax - l.x1) * ey - (ay - l.y1) * ex) / den, v = ((ax - l.x1) * dy - (ay - l.y1) * dx) / den;
  return u > 0 && u < 1 && v > .05 && v < .95;
}

/** Where the point's motion a→b cuts line l: the parameter along l (0..1) and how far b ends past it, or null. */
export function cut(ax: number, ay: number, bx: number, by: number, l: any) {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy) || 1;
  const side = (px: number, py: number) => dx * (py - l.y1) - dy * (px - l.x1);
  const sa = side(ax, ay), sb = side(bx, by);
  if (!(sa * sb < 0)) return null;
  const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-12) return null;
  const u = ((ax - l.x1) * ey - (ay - l.y1) * ex) / den, v = ((ax - l.x1) * dy - (ay - l.y1) * dx) / den;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return {u, depth: Math.abs(sb) / len};
}

/** Every pass-through episode of one saved ride (or of `override`, another track for the same ride), with the pieces
 * involved that the rider never touches (`removable`: removing them cannot change what the rider meets). */
export function passThroughs(dir: string, id: string, override?: any) {
  const cell = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), track = override ?? gz(join(dir, `${id}.track.json.gz`));
  const gallery = gz(join(dir, `${id}.gallery.json.gz`)), production = gallery.production ?? {};
  const guides = new Set<number>(Object.values(production.railGuides ?? {}).flat() as number[]);
  const fragments = new Set<number>(production.fragmentSections ?? []);
  const requests: any[] = production.plan?.requests ?? [];
  const sectionAt = (f: number) => requests.find(r => r.frame <= f && f < r.next)?.section ?? (requests.length ? requests.length - 1 : 0);
  const gapOf = (lid: number) => Math.floor((lid - 1000) / 10000);
  const obs = observe(track, cell.terminus.frame, cell.case.targets), frames = obs.frames;
  const grid = new Map<string, any[]>(), key = (x: number, y: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  for (const l of track.lines) for (let gx = Math.floor(Math.min(l.x1, l.x2) / CELL); gx <= Math.floor(Math.max(l.x1, l.x2) / CELL); gx++)
    for (let gy = Math.floor(Math.min(l.y1, l.y2) / CELL); gy <= Math.floor(Math.max(l.y1, l.y2) / CELL); gy++) {
      const k = `${gx},${gy}`; if (!grid.has(k)) grid.set(k, []); grid.get(k)!.push(l);
    }
  // where along each piece the rider touches it, and when
  const touches = new Map<number, Array<{f: number; u: number}>>();
  const lines = new Map<number, any>(track.lines.map((l: any) => [l.id, l]));
  frames.forEach((fr: any, f: number) => {
    for (const [lid, p] of fr.collisions) {
      const l = lines.get(lid); if (!l) continue;
      const [x, y] = fr.points[p], dx = l.x2 - l.x1, dy = l.y2 - l.y1, len2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((x - l.x1) * dx + (y - l.y1) * dy) / len2));
      if (!touches.has(lid)) touches.set(lid, []); touches.get(lid)!.push({f, u});
    }
  });
  const open = new Map<number, any>(), episodes: any[] = [], involved = new Set<number>(), figure = new Set<number>(), bodyCut = new Set<number>();
  for (let f = 1; f < frames.length; f++) {
    const near = new Set([...frames[f].collisions, ...(frames[f + 1]?.collisions ?? [])].map(([lid]: number[]) => lid));
    frames[f].points.forEach(([x, y, px, py]: number[], p: number) => {
      const seen = new Set<any>();
      for (const k of new Set([key(x, y), key(px, py)])) for (const l of grid.get(k) ?? []) {
        if (seen.has(l) || near.has(l.id)) continue;
        seen.add(l);
        const c = cut(px, py, x, y, l);
        if (!c) continue;
        involved.add(l.id);
        let e = open.get(l.id);
        if (!e || e.last < f - 2) {
          e = {line: l.id, from: f, last: f, depth: 0, sled: false, body: false, u: c.u, rideGap: sectionAt(f)};
          open.set(l.id, e); episodes.push(e);
        }
        e.last = f; e.depth = Math.max(e.depth, c.depth);
        if (p < SLED) e.sled = true; else e.body = true;
        if (c.depth >= e.depth) e.u = c.u;
      }
    });
  }
  // sightings: a drawn line through the rider's figure, frame by frame
  const sighted = new Map<string, any>(), sightings: any[] = [];
  for (let f = 1; f < frames.length; f++) {
    const near = new Set([...(frames[f - 1]?.collisions ?? []), ...frames[f].collisions, ...(frames[f + 1]?.collisions ?? [])].map(([lid]: number[]) => lid));
    const pts = frames[f].points, hit = new Map<number, Set<string>>();
    for (const [a, b, part] of BONES) {
      const [ax, ay] = pts[a], [bx, by] = pts[b], seen = new Set<any>();
      for (let gx = Math.floor(Math.min(ax, bx) / CELL); gx <= Math.floor(Math.max(ax, bx) / CELL); gx++)
        for (let gy = Math.floor(Math.min(ay, by) / CELL); gy <= Math.floor(Math.max(ay, by) / CELL); gy++)
          for (const l of grid.get(`${gx},${gy}`) ?? []) {
            if (seen.has(l) || near.has(l.id)) continue;
            seen.add(l);
            if (through(ax, ay, bx, by, l)) {if (!hit.has(l.id)) hit.set(l.id, new Set()); hit.get(l.id)!.add(part);}
          }
    }
    for (const [lid, parts] of hit) {involved.add(lid); figure.add(lid); if ([...parts].some(q => q !== 'sled')) bodyCut.add(lid);}
    for (const [lid, parts] of hit) {
      const chain = `${gapOf(lid)}|${fragments.has(gapOf(lid)) ? 'fragment' : guides.has(lid) ? 'rail' : 'main'}`;
      let e = sighted.get(chain);
      if (!e || e.last < f - 1) {e = {line: lid, from: f, last: f, parts: new Set<string>(), touched: false}; sighted.set(chain, e); sightings.push(e);}
      if (e.last < f) e.frames = (e.frames ?? 1) + 1;
      e.last = f; for (const q of parts) e.parts.add(q);
      if (touches.get(lid)?.length) e.touched = true;
    }
  }
  const seenRows = sightings.map(e => ({ride: id, t: +(e.from / 40).toFixed(2), frames: e.last - e.from + 1,
    role: fragments.has(gapOf(e.line)) ? 'fragment' : guides.has(e.line) ? 'rail' : 'main', leadIn: (e.line - 1000) % 10000 === 0,
    parts: [...e.parts].sort().join('+'), body: [...e.parts].some(q => q !== 'sled'), touched: e.touched ? 'touched' : 'never'}));
  const crossed = episodes.map(e => {
    const l = lines.get(e.line), length = Math.hypot(l.x2 - l.x1, l.y2 - l.y1), t = touches.get(e.line) ?? [];
    const gap = gapOf(e.line), rel = gap === e.rideGap ? 'same' : gap === e.rideGap - 1 ? 'previous' : gap === e.rideGap + 1 ? 'next' : 'far';
    const touched = !t.length ? 'never' : t.some(x => x.f >= e.from - 3 && x.f <= e.last + 3) ? 'near' : 'elsewhere';
    return {ride: id, t: +(e.from / 40).toFixed(2), frames: e.last - e.from + 1, depth: +e.depth.toFixed(2),
      role: fragments.has(gap) ? 'fragment' : guides.has(e.line) ? 'rail' : 'main', leadIn: (e.line - 1000) % 10000 === 0,
      gap: rel, who: e.sled && e.body ? 'both' : e.sled ? 'sled' : 'body', touched,
      apart: t.length ? +(Math.min(...t.map(x => Math.abs(x.u - e.u))) * length).toFixed(2) : null, length: +length.toFixed(2)};
  });
  const untouched = (xs: Set<number>) => [...xs].filter(lid => !touches.has(lid));
  // removable: never touched and passed through (any point) or cutting the figure; figure: cutting the figure; body: cutting the body
  return {crossed, sightings: seenRows, removable: untouched(involved), removableFigure: untouched(figure), removableBody: untouched(bodyCut), track,
    touched: new Set(touches.keys())};
}

if (import.meta.filename === process.argv[1]) {
  const dir = join('generated/eval/arms', arg('arm', '2fee4728896e469a'), 'cells'), seeds = arg('seeds', '101,202,303,404').split(',');
  const rides = readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).map(f => f.slice(0, -5)).sort();
  const rows: any[] = [], perRide: any[] = [], seen: any[] = [];
  for (const id of rides) {
    const cell = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), {crossed: eps, sightings} = passThroughs(dir, id);
    rows.push(...eps); seen.push(...sightings);
    perRide.push({id, stratum: cell.case.bench.stratum, minutes: cell.terminus.frame / 40 / 60, all: eps.length, visible: eps.filter(e => e.depth >= 3).length,
      seenFrames: sightings.reduce((a, x) => a + x.frames, 0), seenLong: sightings.filter(x => x.frames >= 3).length});
  }
  if (arg('out', '')) writeFileSync(arg('out', ''), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  if (arg('seen', '')) writeFileSync(arg('seen', ''), seen.map(r => JSON.stringify(r)).join('\n') + '\n');
  {
    const n = rides.length, q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
    console.log(`SEEN: a line through the rider's figure: ${(seen.length / n).toFixed(1)} sightings per ride, ${(perRide.reduce((a, r) => a + r.seenFrames, 0) / n / 40).toFixed(2)} s per ride` +
      ` (${(100 * perRide.reduce((a, r) => a + r.seenFrames, 0) / perRide.reduce((a, r) => a + r.minutes * 2400, 0)).toFixed(1)}% of ride time); lasting median ${q(seen.map(x => x.frames), .5)} frames, p90 ${q(seen.map(x => x.frames), .9)}, max ${q(seen.map(x => x.frames), 1)}`);
    for (const [label, f] of [['3+ frames', (x: any) => x.frames >= 3], ['6+ frames', (x: any) => x.frames >= 6], ['12+ frames', (x: any) => x.frames >= 12]] as const)
      console.log(`  lasting ${label}: ${(seen.filter(f).length / n).toFixed(1)} per ride`);
    const by = (k: (x: any) => string, g: (x: any) => boolean = () => true) => {const m = new Map<string, number>(); for (const x of seen.filter(g)) m.set(k(x), (m.get(k(x)) ?? 0) + x.frames);
      const tot = [...m.values()].reduce((a, b) => a + b, 0); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key, v]) => `${key} ${(100 * v / tot).toFixed(0)}%`).join(' · ');};
    console.log(`  share of seen frames by line: ${by(x => x.role + (x.leadIn ? ' lead-in' : ''))}`);
    console.log(`  by part of the rider: ${by(x => x.parts)}`);
    console.log(`  by touched: ${by(x => x.touched)}; for sightings of 3+ frames: ${by(x => x.touched, x => x.frames >= 3)}`);
    const body = seen.filter(x => x.body);
    console.log(`  through the BODY (torso, arms, legs): ${(body.length / n).toFixed(1)} per ride, ${(body.reduce((a, x) => a + x.frames, 0) / n / 40).toFixed(2)} s per ride; lasting 3+ frames ${(body.filter(x => x.frames >= 3).length / n).toFixed(1)}, 6+ ${(body.filter(x => x.frames >= 6).length / n).toFixed(1)}, 12+ ${(body.filter(x => x.frames >= 12).length / n).toFixed(1)}; by line ${by(x => x.role + (x.leadIn ? ' lead-in' : ''), x => x.body)}; touched ${by(x => x.touched, x => x.body)}`);
    const sled = seen.filter(x => !x.body);
    console.log(`  through the SLED only: ${(sled.length / n).toFixed(1)} per ride, ${(sled.reduce((a, x) => a + x.frames, 0) / n / 40).toFixed(2)} s; lasting 3+ frames ${(sled.filter(x => x.frames >= 3).length / n).toFixed(1)}; by line ${by(x => x.role, x => !x.body)}`);
  }
  const vis = rows.filter(r => r.depth >= 3), share = (xs: any[], p: (r: any) => boolean) => `${(100 * xs.filter(p).length / Math.max(1, xs.length)).toFixed(0)}%`;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  console.log(`${rides.length} rides: ${rows.length} episodes (${(rows.length / rides.length).toFixed(0)} per ride), ${vis.length} visible (3 px or deeper: ${(vis.length / rides.length).toFixed(1)} per ride, ${(mean(perRide.map(r => r.visible / r.minutes))).toFixed(1)} per minute)`);
  const dist = (label: string, f: (r: any) => string) => {
    const m = new Map<string, number>(); for (const r of vis) m.set(f(r), (m.get(f(r)) ?? 0) + 1);
    console.log(`  ${label}: ${[...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(100 * n / vis.length).toFixed(0)}%`).join(' · ')}`);
  };
  console.log('visible episodes, by:');
  dist('line', r => r.role + (r.leadIn ? ' lead-in' : ''));
  dist('who', r => r.who);
  dist('gap', r => r.gap);
  dist('touched', r => r.touched);
  dist('kind', r => `${r.role === 'rail' && r.who !== 'sled' ? 'rail through the body' : r.touched === 'never' ? 'never touched' : r.touched === 'near' ? 'touched around then' : 'touched at other times'}`);
  const touched = vis.filter(r => r.touched !== 'never');
  console.log(`  touched pieces: crossing and nearest touch apart along the piece: median ${[...touched.map(r => r.apart)].sort((a, b) => a - b)[Math.floor(touched.length / 2)]?.toFixed(1)} px; pieces' median length ${[...vis.map(r => r.length)].sort((a, b) => a - b)[Math.floor(vis.length / 2)]?.toFixed(1)} px; apart by 2 px or more ${share(touched, r => r.apart >= 2)}`);
  console.log(`  depth median ${[...vis.map(r => r.depth)].sort((a, b) => a - b)[Math.floor(vis.length / 2)].toFixed(1)} px, lasting median ${[...vis.map(r => r.frames)].sort((a, b) => a - b)[Math.floor(vis.length / 2)]} frames; rides with none visible ${share(perRide, r => r.visible === 0)}`);
  for (const s of [...new Set(perRide.map(r => r.stratum))].sort()) {
    const g = perRide.filter(r => r.stratum === s);
    console.log(`  ${s}: ${(mean(g.map(r => r.visible))).toFixed(1)} visible per ride (${mean(g.map(r => r.visible / r.minutes)).toFixed(1)} per minute)`);
  }
  process.exit(0);
}
