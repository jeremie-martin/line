/** Which receivers from above survive (report only). Compiles V8 rides from a worktree whose compiler offers upper
 * receivers (`receiverAnchor` set) and records every such candidate the search measured: survived or why not, its
 * strike strength when it survived (from the interval's offered pool), and, from the rider's state at the catch, how
 * it met the line: incidence (entry − arrival heading), bend, support / span, the rider's tilt (body direction from the
 * sled against straight up), and how hard the push presses the sled into the body (the body's offset along the push,
 * px). The compile is the worktree's own; observers only read.
 *   node tools/research/upper_candidates.ts run ROOT OUT [--seed=101] [--jobs=N]
 *   node tools/research/upper_candidates.ts report OUT */
import {appendFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {v7Cases, resolveCase} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const [command, a1, a2] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SUITE = 'tools/eval/suites/v8.json', deg = (r: number) => r * 180 / Math.PI;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** The rider at the catch: tilt (0 upright, 180 upside down) and the body's offset along the push of a line entering at `entry`. */
function meeting(trace: any, entry: number) {
  const sled = ['PEG', 'TAIL', 'NOSE', 'STRING'].map(k => trace[k]);
  const sx = sled.reduce((a, q) => a + q.x, 0) / 4, sy = sled.reduce((a, q) => a + q.y, 0) / 4;
  const bx = (trace.BUTT.x + trace.SHOULDER.x) / 2 - sx, by = (trace.BUTT.y + trace.SHOULDER.y) / 2 - sy;
  const e = entry * Math.PI / 180, press = -(bx * Math.sin(e) - by * Math.cos(e));
  return {tilt: Math.abs(deg(Math.atan2(bx, -by))), press};
}

async function worker(root: string, out: string, id: string, seed: number) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id)!;
  const {spec, music, planned} = await resolveCase(c);
  const {withRejectionObserver} = await import(pathToFileURL(join(root, 'scripts/v0/optimizer/arc_evaluate.ts')).href);
  const {withSequenceObserver} = await import(pathToFileURL(join(root, 'scripts/v0/optimizer/arc_sequence.ts')).href);
  // The rider's state at each catch, from the search state the rejection observer sees (interval results do not keep it).
  const rows: any[] = [], seen = new Set<object>(), states = new Map<number, {trace: any; velocity: any; incoming: number; span: number; frame: number}>();
  const row = (s: {trace: any; velocity: any; incoming: number; span: number; frame: number}, cand: any, outcome: string, strength: number | null) => {
    const ask = music.contacts.find((t: any) => t.frame >= s.frame && t.frame <= s.frame + 4)?.impact ?? null;
    return {ask, outcome, strength: strength === null ? null : r2(strength), anchor: cand.receiverAnchor, incidence: r2(cand.entry - s.incoming),
      bend: r2(cand.turn), support: r2(cand.support / s.span), speed: r2(Math.hypot(s.velocity.x, s.velocity.y)), ...Object.fromEntries(
        Object.entries(meeting(s.trace, cand.entry)).map(([k, v]) => [k, r2(v)]))};
  };
  await withRejectionObserver((s: any, cand: any, reason: string) => {
    if (!states.has(s.frame)) states.set(s.frame, {trace: s.trace, velocity: s.velocity, incoming: s.incoming, span: s.span, frame: s.frame});
    if (cand.receiverAnchor !== undefined) rows.push(row(s, cand, reason, null));
  }, () => withSequenceObserver((_i: number, offered: any[]) => {
    for (const interval of new Set(offered.map(o => o.interval))) {
      if (seen.has(interval)) continue;
      seen.add(interval);
      const st = states.get((interval as any).frame);
      if (!st) continue;
      for (const x of (interval as any).candidates) if (x.c.receiverAnchor !== undefined) rows.push(row(st, x.c, 'survived', x.actualImpact ?? null));
    }
  }, () => compileAndMeasure(root, planned, {spec, music}, {budget: 'standard'})));
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({spec: id, seed, rows}) + '\n');
}

function report(out: string) {
  const rows = readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').flatMap(l => JSON.parse(l).rows);
  const share = (xs: any[]) => xs.length ? xs.filter(r => r.outcome === 'survived').length / xs.length : NaN;
  const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  const outcomes = new Map<string, number>();
  for (const r of rows) outcomes.set(r.outcome, (outcomes.get(r.outcome) ?? 0) + 1);
  console.log(`${rows.length} upper candidates measured; outcomes: ${[...outcomes].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(100 * n / rows.length).toFixed(0)}%`).join(', ')}`);
  const strong = rows.filter(r => r.ask >= .6);
  console.log(`on strong asks: ${strong.length}, survived ${(100 * share(strong)).toFixed(0)}%, survivors' strength ${mean(strong.filter(r => r.strength !== null).map(r => r.strength)).toFixed(2)}`);
  const bins = (key: string, edges: number[]) => {
    const parts = [];
    for (let k = 0; k + 1 < edges.length; k++) {
      const g = rows.filter(r => r[key] >= edges[k] && r[key] < edges[k + 1]);
      if (g.length) parts.push(`${edges[k]}–${edges[k + 1]}: ${g.length}, survived ${(100 * share(g)).toFixed(0)}%, strength ${mean(g.filter(r => r.strength !== null).map(r => r.strength)).toFixed(2)}`);
    }
    console.log(`by ${key}: ${parts.join(' | ')}`);
  };
  bins('tilt', [0, 30, 60, 90, 120, 181]);
  bins('press', [0, 3, 6, 9, 12, 99]);
  bins('incidence', [0, 10, 20, 30, 41]);
  bins('bend', [0, 10, 20, 30, 45, 120]);
  bins('support', [0, .3, .5, .7, 1.01]);
  bins('anchor', [1, 2, 3]);
}

if (command === 'worker') await worker(resolve(a1), a2, arg('spec', ''), Number(arg('seed', '101')));
else if (command === 'run') {
  const root = resolve(a1), out = a2, seed = Number(arg('seed', '101'));
  mkdirSync(out, {recursive: true});
  if (existsSync(join(out, 'rides.jsonl'))) throw new Error(`${out} already has rides`);
  const specs = (await v7Cases([seed], '.', SUITE)).map(x => `${x.song}~${x.variant ?? 'spec'}`);
  const pool = new WorkerPool(workerJobs(arg('jobs', '')));
  await pool.run(specs, spec => pool.worker([import.meta.filename, 'worker', root, out, `--spec=${spec}`, `--seed=${seed}`]));
  report(out);
} else report(a1);
process.exit(0);
