/** What each measured catch candidate led to: a dataset for forward models of a catch (report only).
 * Compiles V7.1 rides in-process with a read-only sequence observer. For every interval the
 * search offered, it records the situation once (the 57 policy features, incoming heading,
 * pace, span, span targets, family) and, for each retained candidate, its control relative
 * to the arrival with its optional fields, and what it led to: the measured impact, the
 * span residuals, the local cost, and the arrival at the next catch (heading, speed, pose).
 * The committed candidate of each interval is marked. Nothing is simulated beyond the
 * compile; the report checks track identity against a saved arm.
 *   node tools/research/catch_outcomes.ts run OUT [--jobs=N] [--seed=101] [--specs=a~b,...]
 *   node tools/research/catch_outcomes.ts report OUT [ARM_DIR] */
import assert from 'node:assert/strict';
import {appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {dirname, join} from 'node:path';
import {gzipSync, createGunzip} from 'node:zlib';
import {v7Cases, resolveCase, digest} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const SUITE = 'tools/eval/suites/v7.1.json';
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const r4 = (x: number | undefined | null) => x === undefined || x === null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;

async function worker(id: string, seed: number) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id);
  assert(c, `unknown case: ${id}`);
  const {spec, music, planned} = await resolveCase(c);
  const intervals: any[] = [], seen = new Set<object>(), where = new WeakMap<object, [number, number]>();
  await withSequenceObserver((i, offered, _chosen, ctx) => {
    for (const interval of new Set(offered.map(o => o.interval))) {
      if (seen.has(interval)) continue;
      seen.add(interval);
      const p = intervals.length, request = (ctx.options as any).constructionRequests?.[i];
      intervals.push({i, frame: interval.frame, next: interval.next, incoming: r4(interval.incoming), pace: r4(interval.pace), span: interval.span,
        family: request?.construction ?? null, guidance: request?.guidance ?? null, rail: request?.railLayout ?? null,
        targets: interval.targets, features: interval.inputFeatures.map(r4),
        candidates: interval.candidates.map((x, k) => {
          where.set(x.c, [p, k]);
          const {entry, turn, exit, support, ...rest} = x.c as any;
          return {c: [entry - interval.incoming, turn, exit - interval.incoming, support / interval.span].map(r4), o: Object.fromEntries(Object.entries(rest).map(([key, v]) => [key, r4(v as number)])),
            impact: r4(x.actualImpact), residuals: x.residuals.slice(0, 6).map(r4), local: r4(x.localCost),
            heading: r4(x.heading), endSpeed: r4(x.endSpeed), pose: r4(x.pose)};
        })});
    }
  }, async () => {
    const {cell, track, gallery} = await compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'});
    const rows = gallery.result.rows as any[];
    for (const row of rows) { const at = where.get(row.control); if (at) intervals[at[0]].kept = at[1]; }
    const beats = (cell.impact3?.perBeat ?? []).map((b: any) => ({requested: b.requested, strength: r4(b.hit?.strength)}));
    appendFileSync(join(out, 'rides.jsonl.gz'), gzipSync(JSON.stringify({spec: id, stratum: c.bench.stratum, seed, complete: cell.complete,
      score: cell.score?.score ?? 0, trackHash: digest(track), beats, intervals}) + '\n'));
  });
}

async function report(dir: string, armDir?: string) {
  // Streamed: a full study is far larger than one string may be.
  let rides = 0, same = 0, intervals = 0, candidates = 0, committed = 0;
  for await (const line of createInterface({input: createReadStream(join(dir, 'rides.jsonl.gz')).pipe(createGunzip()), crlfDelay: Infinity})) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    rides++;
    intervals += r.intervals.length;
    for (const x of r.intervals) { candidates += x.candidates.length; if (x.kept !== undefined) committed++; }
    if (armDir) {
      const saved = JSON.parse(readFileSync(join(armDir, 'cells', `${r.spec}~${r.seed}.json`), 'utf8'));
      if (saved.trackHash === r.trackHash) same++; else console.log(`DIFFERENT track  ${r.spec}~${r.seed}`);
    }
  }
  if (armDir) console.log(`track identity: ${same}/${rides} identical to the saved arm`);
  console.log(`${rides} rides, ${intervals} intervals offered, ${candidates} candidates (${(candidates / Math.max(1, intervals)).toFixed(1)} per interval), ${committed} committed`);
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
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.catch-outcomes.v1', seed, suite: SUITE, specs: queue}, null, 2) + '\n');
  console.log(`${queue.length} rides`);
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${seed}`]));
} else await report(out, process.argv[4]);
