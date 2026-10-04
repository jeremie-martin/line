/** Diagnosis of strong-requested beats in an eval run: for each beat with a
 * requested impact ≥ --min, the matched v3 impact's strength and the physics of
 * its arrival (speed, incidence against the first line touched, speed into the
 * surface, sled pitch against the surface).
 *
 *   node --import tsx tools/measure/strong_beats.ts --run=generated/eval/<name> [--min=0.6] [--max=1] */
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from './observe.ts';
import {strikeMotionFrames, detectStrikes, accountStrikes, STRIKE_V3_CONTRACT} from './strike.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const run = arg('run', ''), min = Number(arg('min', '0.6')), max = Number(arg('max', '1'));
const deg = (r: number) => r * 180 / Math.PI;
const rows: any[] = [];
for (const f of readdirSync(join(run, 'cells')).filter(f => f.endsWith('.json'))) {
  const cell = JSON.parse(readFileSync(join(run, 'cells', f), 'utf8'));
  const track = JSON.parse(gunzipSync(readFileSync(join(run, 'cells', f.replace(/\.json$/, '.track.json.gz')))).toString());
  const targets = cell.beats.map((b: any) => ({frame: b.frame ?? Math.round(b.t * 40), impact: b.requested}));
  const duration = Math.max(...targets.map((t: any) => t.frame)) + 1;
  const o: any = observe(track, duration, targets), lines = new Map(track.lines.map((l: any) => [l.id, l]));
  const events = detectStrikes(strikeMotionFrames(o), STRIKE_V3_CONTRACT).filter(e => e.onset <= duration), account = accountStrikes(events, targets, STRIKE_V3_CONTRACT);
  for (const m of account.matches) {
    const t = targets[m.target]; if ((t.impact ?? 0) < min || (t.impact ?? 0) > max) continue;
    const e = events[m.event], f0 = e.contactStart, hit = o.frames[f0].collisions[0];
    if (!hit || f0 < 1) continue;
    const l: any = lines.get(hit[0]), P = o.frames[f0 - 1].points;
    let vx = 0, vy = 0; for (const [x, y, px, py] of P) {vx += x - px; vy += y - py;} vx /= 10; vy /= 10;
    const lx = l.x2 - l.x1, ly = l.y2 - l.y1, len = Math.hypot(lx, ly), speed = Math.hypot(vx, vy);
    const normal = Math.abs((vx * ly - vy * lx) / len), incidence = deg(Math.asin(Math.min(1, normal / Math.max(1e-9, speed))));
    const [tx, ty] = P[1], [nx, ny] = P[2], a = Math.abs(Math.atan2((nx - tx) * ly - (ny - ty) * lx, (nx - tx) * lx + (ny - ty) * ly));
    rows.push({cell: cell.case.id, frame: t.frame, requested: t.impact, strength: e.strength, speed, normal, incidence, pitch: deg(Math.min(a, Math.PI - a))});
  }
}
const q = (xs: number[], p: number) => {const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))];};
const show = (label: string, r: any[]) => r.length && console.log(`${label.padEnd(26)} n ${String(r.length).padStart(4)}  strength p50 ${q(r.map(x => x.strength), .5).toFixed(2)}  ` +
  `requested p50 ${q(r.map(x => x.requested), .5).toFixed(2)}  speed ${q(r.map(x => x.speed), .5).toFixed(1)}  into surface ${q(r.map(x => x.normal), .5).toFixed(2)}  ` +
  `incidence ${q(r.map(x => x.incidence), .5).toFixed(0)}°  sled-surface ${q(r.map(x => x.pitch), .5).toFixed(0)}°`);
show(`all (requested ${min}–${max})`, rows);
const air = rows.filter(r => r.normal < 1.5);
show('into surface < 1.5', air);
for (const [a, b] of [[0, 3], [3, 4.5], [4.5, 6], [6, 99]]) show(`into surface ${a}–${b}`, rows.filter(r => r.normal >= a && r.normal < b));
for (const [a, b] of [[0, 10], [10, 25], [25, 90]]) show(`sled-surface ${a}–${b}°`, rows.filter(r => r.pitch >= a && r.pitch < b));
