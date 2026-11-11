/** What each measured catch candidate led to: a dataset for forward models of a catch (report only).
 * Compiles V7.1 rides in-process with a read-only sequence observer. For every interval the
 * search offered, it records the situation once (the 57 policy features, incoming heading,
 * pace, span, span targets, family) and, for each retained candidate, its control relative
 * to the arrival with its optional fields, and what it led to: the measured impact, the
 * span residuals, the local cost, and the arrival at the next catch (heading, speed, pose).
 * The committed candidate of each interval is marked, with the interval's rejection counts and
 * each rejected evaluation (`rejected`: its control in the same form, and the reason; memo repeats
 * are counted, not listed).
 * Nothing is simulated beyond the compile; the report checks track identity against a saved arm.
 * `--cases=train` compiles the training catalog instead (value_collect.ts `trainingCases`,
 * catalog v4, every evaluation song excluded), ids as listed there; those rides are not
 * measured (no beats), and their stratum is the source song (`parentId`).
 *   node tools/research/catch_outcomes.ts run OUT [--cases=v7.1|train] [--jobs=N] [--seed=101] [--specs=a~b,...]
 *   node tools/research/catch_outcomes.ts report OUT [ARM_DIR] */
import assert from 'node:assert/strict';
import {appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {dirname, join} from 'node:path';
import {gzipSync, createGunzip} from 'node:zlib';
import {v7Cases, resolveCase, digest} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {withRejectionObserver} from '../../scripts/v0/optimizer/arc_evaluate.ts';
import {trainingCases, EVAL_GROUPS} from './value_collect.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const SUITE = 'tools/eval/suites/v7.1.json';
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const r4 = (x: number | undefined | null) => x === undefined || x === null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;

/** One ride's compile: a V7.1 case (measured), or a training case compiled as value_collect.ts does. */
async function ride(id: string, seed: number, cases: string) {
  if (cases === 'train') {
    const c = (await trainingCases()).find((x: any) => x.id === id);
    assert(c, `unknown training case: ${id}`);
    const [{caseSpec}, {compileHandoff}, {productionBudget}] = await Promise.all([
      import('../../scripts/lib/case.ts'), import('../../scripts/v0/optimizer/handoff.ts'), import('../../scripts/v0/optimizer/production_budget.ts')]);
    const spec = caseSpec(c);
    return {stratum: c.parentId as string, compile: async () => {
      const cp = compileHandoff(spec, seed, {budget: productionBudget(spec.duration), creative: {},
        phraseBoundaries: (c.phases ?? []).map((p: any) => p.start).filter((t: any) => Number.isFinite(t))});
      return {complete: cp.repertoire!.valid, score: null, track: cp.track, rows: cp.repertoire!.result.rows as any[], beats: null};
    }};
  }
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id);
  assert(c, `unknown case: ${id}`);
  const {spec, music, planned} = await resolveCase(c);
  return {stratum: c.bench.stratum, compile: async () => {
    const {cell, track, gallery} = await compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'});
    return {complete: cell.complete, score: cell.score?.score ?? 0, track, rows: gallery.result.rows as any[],
      beats: (cell.impact3?.perBeat ?? []).map((b: any) => ({requested: b.requested, strength: r4(b.hit?.strength)}))};
  }};
}

async function worker(id: string, seed: number, cases: string) {
  const {stratum, compile} = await ride(id, seed, cases);
  const intervals: any[] = [], seen = new Set<object>(), where = new WeakMap<object, [number, number]>();
  // A search's candidate list is the one its interval result offers: rejections are filed under it.
  const rejected = new WeakMap<object, any[]>();
  const relative = (c: any, incoming: number, span: number) => {
    const {entry, turn, exit, support, ...rest} = c;
    return {c: [entry - incoming, turn, exit - incoming, support / span].map(r4), o: Object.fromEntries(Object.entries(rest).map(([key, v]) => [key, r4(v as number)]))};
  };
  await withRejectionObserver((s, c, reason) => {
    let list = rejected.get(s.candidates);
    if (!list) rejected.set(s.candidates, list = []);
    list.push({...relative(c, s.incoming, s.span), reason});
  }, () => withSequenceObserver((i, offered, _chosen, ctx) => {
    for (const interval of new Set(offered.map(o => o.interval))) {
      if (seen.has(interval)) continue;
      seen.add(interval);
      const p = intervals.length, request = (ctx.options as any).constructionRequests?.[i];
      intervals.push({i, frame: interval.frame, next: interval.next, incoming: r4(interval.incoming), pace: r4(interval.pace), span: interval.span,
        family: request?.construction ?? null, guidance: request?.guidance ?? null, rail: request?.railLayout ?? null,
        failures: {...interval.failures}, rejected: rejected.get(interval.candidates) ?? [], targets: interval.targets, features: interval.inputFeatures.map(r4),
        candidates: interval.candidates.map((x, k) => {
          where.set(x.c, [p, k]);
          return {...relative(x.c, interval.incoming, interval.span),
            impact: r4(x.actualImpact), residuals: x.residuals.slice(0, 6).map(r4), local: r4(x.localCost),
            heading: r4(x.heading), endSpeed: r4(x.endSpeed), pose: r4(x.pose)};
        })});
    }
  }, async () => {
    const {complete, score, track, rows, beats} = await compile();
    for (const row of rows) { const at = where.get(row.control); if (at) intervals[at[0]].kept = at[1]; }
    appendFileSync(join(out, 'rides.jsonl.gz'), gzipSync(JSON.stringify({spec: id, stratum, seed, complete,
      score, trackHash: digest(track), beats, intervals}) + '\n'));
  }));
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

const cases = arg('cases', 'v7.1');
assert(cases === 'v7.1' || cases === 'train', '--cases is v7.1 or train');
if (command === 'worker') await worker(arg('spec', ''), Number(arg('seed', '101')), cases);
else if (command === 'run') {
  const pool = new WorkerPool(workerJobs(arg('jobs', '') || undefined)), seed = Number(arg('seed', '101'));
  assert(Number.isSafeInteger(seed), '--seed must be an integer');
  const all = cases === 'train' ? (await trainingCases()).map((x: any) => x.id as string)
    : (await v7Cases([seed], '.', SUITE)).map(x => `${x.song}~${x.variant ?? 'spec'}`);
  const queue = arg('specs', all.join(',')).split(',');
  assert(queue.every(Boolean) && new Set(queue).size === queue.length, '--specs must contain unique cases');
  assert(out && !existsSync(out), 'a new study requires a fresh output directory');
  mkdirSync(dirname(out), {recursive: true});
  mkdirSync(out);
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.catch-outcomes.v1', seed, cases, suite: cases === 'train' ? 'value_collect.ts trainingCases (catalog v4)' : SUITE,
    excludedGroups: cases === 'train' ? EVAL_GROUPS : undefined, specs: queue}, null, 2) + '\n');
  console.log(`${queue.length} rides`);
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--cases=${cases}`, `--spec=${spec}`, `--seed=${seed}`]));
} else await report(out, process.argv[4]);
