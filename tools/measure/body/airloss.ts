// Where is air (and speed) lost? usage: node tools/measure/body/airloss.ts TAG_A TAG_B : per gap, the air and speed
// errors of the two tags by the gap's air target and by how long it is.
import fs from 'node:fs'; import path from 'node:path';
const specs = fs.readFileSync('generated/visible/picks.txt', 'utf8').trim().split('\n').map(l => l.split(' ').slice(0, 2));
const [A, B] = process.argv.slice(2); const cell: Record<string, {n: number; a: number; b: number; sa: number; sb: number; ba: number; bb: number}> = {};
const load = (tag: string, s: string, v: string, seed: number) => {const d = `generated/visible/${tag}/${s}/${v}/s${seed}`; return JSON.parse(fs.readFileSync(path.join(d, fs.readdirSync(d).find(f => f.endsWith('-production.json'))!), 'utf8'));};
for (const [s, v] of specs) for (const seed of [101, 202, 303]) {
  const a = load(A, s, v, seed), b = load(B, s, v, seed);
  const air = (p: any) => new Map(p.observations.filter((o: any) => o.axis === 'air' && !o.tail).map((o: any) => [o.gap, o]));
  const spd = (p: any) => new Map(p.observations.filter((o: any) => o.axis === 'speed' && !o.tail).map((o: any) => [o.gap, o]));
  const aa = air(a), ab = air(b), sa = spd(a), sb = spd(b);
  for (const [gap, o] of aa as Map<number, any>) {const q = ab.get(gap) as any; if (!q) continue; const len = (o.endFrame - o.startFrame) / 40;
    for (const k of ['air target ' + (o.target < .35 ? '<0.35' : o.target < .6 ? '0.35–0.6' : '≥0.6'), 'gap ' + (len < .35 ? '<0.35 s' : len < .7 ? '0.35–0.7 s' : '≥0.7 s')]) {
      const c = cell[k] ??= {n: 0, a: 0, b: 0, sa: 0, sb: 0, ba: 0, bb: 0}; c.n++; c.a += o.error ** 2; c.b += q.error ** 2; c.ba += o.achieved - o.target; c.bb += q.achieved - q.target;
      const x = sa.get(gap) as any, y = sb.get(gap) as any; if (x && y) {c.sa += x.error ** 2; c.sb += y.error ** 2;}}}
}
console.log(`${A} → ${B}`);
for (const [k, c] of Object.entries(cell).sort()) console.log(' ', k.padEnd(22), String(c.n).padStart(5), 'gaps  air rms', Math.sqrt(c.a / c.n).toFixed(3), '→', Math.sqrt(c.b / c.n).toFixed(3), ' air bias', (c.ba / c.n).toFixed(3), '→', (c.bb / c.n).toFixed(3), ' speed rms', Math.sqrt(c.sa / c.n).toFixed(3), '→', Math.sqrt(c.sb / c.n).toFixed(3));
