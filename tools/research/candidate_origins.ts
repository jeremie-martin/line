/** Which candidate source the committed arcs descend from (report only).
 * Compiles V7.1 rides in-process with origin labels enabled (arc_origin.ts):
 * every proposal is labelled with its root source (centre, learned policy
 * lookup, memory, response, generic sweep, opposing entry, compact fold,
 * receiver, recovery, warm start, direct) and every refinement step appends its
 * stage (coordinate, shape, response). After the compile, each committed row's
 * control carries the label of the candidate it came from. Labels are never
 * read by the compiler; the report checks track identity against a saved arm.
 * Each ride's rows (control, incoming, span, situation features, family) are
 * kept for the variety studies.
 *   node tools/research/candidate_origins.ts run OUT [--jobs=N] [--seed=101] [--specs=a~b,...]
 *   node tools/research/candidate_origins.ts report OUT [ARM_DIR] */
import assert from 'node:assert/strict';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {v7Cases, resolveCase, digest} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {arcOrigins, originOf, rootOf} from '../../scripts/v0/optimizer/arc_origin.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const SUITE = 'tools/eval/suites/v7.1.json';
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

async function worker(id: string, seed: number) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id);
  assert(c, `unknown case: ${id}`);
  const {spec, music, planned} = await resolveCase(c, resolveJoltMs());
  arcOrigins.enabled = true;
  let work: any;
  await withSequenceObserver((_i, _offered, _chosen, ctx) => {work = ctx.work;}, async () => {
    const {cell, track, gallery} = await compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'});
    const requests: any[] = (gallery.production as any).plan?.requests ?? [];
    const sectionOf = (frame: number) => requests.find(r => frame >= r.frame && frame < r.next);
    const rows = (gallery.result.rows as any[]).map((row, i) => {
      const r = sectionOf(row.frame);
      return {i, frame: row.frame, next: row.next, origin: originOf(row.control) ?? 'untagged', family: r?.construction ?? null,
        guidance: r?.guidance ?? null, rail: r?.railLayout ?? null, incoming: row.incoming, span: row.span, control: row.control, root: rootOf(row.control) ?? null, features: row.features};
    });
    appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({spec: id, stratum: c.bench.stratum, seed, complete: cell.complete,
      score: cell.score?.score ?? 0, trackHash: digest(track), tried: work?.initialProposalWork ?? null, rows}) + '\n');
  });
}

const pct = (x: number, total: number) => `${(100 * x / Math.max(1e-12, total)).toFixed(0)}%`;

function report(dir: string, armDir?: string) {
  const rides = readFileSync(join(dir, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  if (armDir) {
    let same = 0;
    for (const r of rides) {
      const saved = JSON.parse(readFileSync(join(armDir, 'cells', `${r.spec}~${r.seed}.json`), 'utf8'));
      if (saved.trackHash === r.trackHash) same++; else console.log(`DIFFERENT track  ${r.spec}~${r.seed}`);
    }
    console.log(`track identity: ${same}/${rides.length} identical to the saved arm`);
  }
  const rows = rides.flatMap(r => r.rows.map((x: any) => ({...x, stratum: r.stratum})));
  const root = (o: string) => o.split('>')[0], refined = (o: string) => o.includes('>');
  console.log(`\n${rides.length} rides, ${rows.length} committed arcs (${rows.filter(x => x.origin === 'untagged').length} untagged)`);

  // Tried (initial proposals) against committed, per root source.
  const tried: Record<string, number> = {};
  const STREAM: Record<string, string> = {learned: 'policy-archive', memory: 'memory (archive or ride)'};
  for (const r of rides) for (const [s, w] of Object.entries(r.tried ?? {})) tried[STREAM[s] ?? s] = (tried[STREAM[s] ?? s] ?? 0) + (w as any).attempts;
  const triedTotal = Object.values(tried).reduce((a, b) => a + b, 0);
  const by = (f: (x: any) => string, xs = rows) => {const m: Record<string, number> = {}; for (const x of xs) m[f(x)] = (m[f(x)] ?? 0) + 1; return m;};
  const roots = by(x => root(x.origin));
  console.log('\n== Root source of the committed arcs (share of initial proposals tried, then of arcs committed)');
  for (const [k, v] of Object.entries(roots).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(12)} tried ${tried[k] !== undefined ? pct(tried[k], triedTotal).padStart(4) : ' n/a'}   committed ${pct(v, rows.length).padStart(4)}  ` +
      `(refined afterwards: ${pct(rows.filter(x => root(x.origin) === k && refined(x.origin)).length, v)})`);

  console.log(`  memory, archive and ride together: tried ${pct(tried['memory (archive or ride)'] ?? 0, triedTotal)}`);
  // How far refinement moved each committed arc from the proposal it started as:
  // the six main controls relative to the arrival, in units of their spread over all committed arcs.
  const rel = (c: any, x: any) => [c.entry - x.incoming, c.turn, c.exit - x.incoming, c.support / x.span, c.bias, c.offset];
  const both = rows.filter(x => x.root && x.control);
  const A = both.map(x => rel(x.control, x)), sd = A[0].map((_: number, j: number) => {
    const m = A.reduce((n: number, v: number[]) => n + v[j], 0) / A.length;
    return Math.sqrt(A.reduce((n: number, v: number[]) => n + (v[j] - m) ** 2, 0) / A.length) || 1;});
  const moved = (x: any) => Math.sqrt(rel(x.control, x).reduce((n: number, v: number, j: number) => n + ((v - rel(x.root, x)[j]) / sd[j]) ** 2, 0));
  const q = (xs: number[], p: number) => xs.sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
  console.log('\n== How far refinement moved the committed arcs from their proposal (six main controls, in spreads of the committed arcs)');
  for (const k of Object.keys(roots).sort((a, b) => roots[b] - roots[a])) {
    const d = both.filter(x => root(x.origin) === k).map(moved);
    if (d.length >= 20) console.log(`  ${k.padEnd(14)} median ${q(d, .5).toFixed(2)}, quartiles ${q(d, .25).toFixed(2)}–${q(d, .75).toFixed(2)}  (${d.length} arcs)`);
  }
  console.log('\n== Refinement path of the committed arcs');
  const paths = by(x => x.origin.split('>').slice(1).join('>') || '(as proposed)');
  for (const [k, v] of Object.entries(paths).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${k.padEnd(36)} ${pct(v, rows.length)}`);

  console.log('\n== Root source per family (committed arcs)');
  const families = by(x => `${x.family ?? '?'}${x.guidance === 'forbidden' ? ' (unguided)' : ''}${x.rail === 'transfer' ? ' (transfer)' : ''}`);
  const sources = Object.keys(roots).sort((a, b) => roots[b] - roots[a]);
  console.log(`  ${'family'.padEnd(26)} ${'arcs'.padStart(5)}  ${sources.map(s => s.padStart(9)).join('')}`);
  for (const [f, n] of Object.entries(families).sort((a, b) => b[1] - a[1])) {
    const xs = rows.filter(x => `${x.family ?? '?'}${x.guidance === 'forbidden' ? ' (unguided)' : ''}${x.rail === 'transfer' ? ' (transfer)' : ''}` === f);
    const m = by(x => root(x.origin), xs);
    console.log(`  ${f.padEnd(26)} ${String(n).padStart(5)}  ${sources.map(s => pct(m[s] ?? 0, n).padStart(9)).join('')}`);
  }
  console.log('\n== Root source by stratum');
  for (const s of ['G', 'E', 'P']) {
    const xs = rows.filter(x => (s === 'P' ? x.stratum.startsWith('P') : x.stratum === s));
    if (!xs.length) continue;
    const m = by(x => root(x.origin), xs);
    console.log(`  ${s}: ${xs.length} arcs; ${sources.map(k => `${k} ${pct(m[k] ?? 0, xs.length)}`).join(', ')}`);
  }
}

if (command === 'worker') await worker(arg('spec', ''), Number(arg('seed', '101')));
else if (command === 'run') {
  const pool = new WorkerPool(workerJobs(arg('jobs', '') || undefined)), seed = Number(arg('seed', '101'));
  assert(Number.isSafeInteger(seed), '--seed must be an integer');
  const all = (await v7Cases([seed], '.', SUITE)).map(x => `${x.song}~${x.variant ?? 'spec'}`);
  const queue = arg('specs', all.join(',')).split(',');
  assert(queue.every(Boolean) && new Set(queue).size === queue.length, '--specs must contain unique cases');
  assert(out && !existsSync(out), 'a new study requires a fresh output directory');
  mkdirSync(dirname(out), {recursive: true});
  mkdirSync(out);
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.candidate-origins.v1', seed, suite: SUITE, specs: queue}, null, 2) + '\n');
  console.log(`${queue.length} rides`);
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${seed}`]));
} else report(out, process.argv[4]);
