/** What a strong catch could be, with far more search (report only).
 * Compiles rides in-process with a read-only sequence observer. At every catch
 * asked >= 0.6 whose kept candidate falls short by more than 0.08, it searches the
 * same interval again from the same prefix (an owned study context, outside the
 * compile's allowance) with WIDTH times the samples, and keeps both pools. For
 * each pool and each distance from the ask it reports the cheapest candidate's
 * cost apart from strength (span air and speed, timing, extra hits, motion, the
 * preceding span's correction), split by contact side (a surface below or above).
 * It answers: does more search find catches near the ask, and what do they cost?
 *   node tools/research/catch_frontier.ts run OUT [--jobs=N] [--seed=101] [--width=10] [--specs=a~b,...]
 *   node tools/research/catch_frontier.ts report OUT [ARM_DIR] */
import assert from 'node:assert/strict';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {v7Cases, resolveCase, digest} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {searchInterval} from '../../scripts/v0/optimizer/arc_interval.ts';
import type {MeasuredCandidate} from '../../scripts/v0/optimizer/arc_candidates.ts';
import {withArcStudy} from './arc_study.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const SUITE = 'tools/eval/suites/v7.1.json';
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const r4 = (x: number | undefined | null) => x === undefined || x === null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
/** [strength, cost apart from strength, signed air, signed speed, contact side] */
const summary = (x: MeasuredCandidate) => [r4(x.actualImpact), r4(x.localCost - (x.residuals[3] ?? 0) ** 2), r4(x.residuals[0]), r4(x.residuals[1]),
  x.c.contactSide ?? 1];

async function worker(id: string, seed: number, width: number) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id);
  assert(c, `unknown case: ${id}`);
  const {spec, music, planned} = await resolveCase(c, resolveJoltMs());
  const asks = [undefined, ...music.contacts.map((t: any) => t.impact)];
  const probes: any[] = [];
  const {cell, track} = await withSequenceObserver((i, offered, chosen, ctx) => {
    const ask = asks[i];
    if (!(ask !== undefined && ask >= .6) || !chosen.length) return;
    const kept = offered.find(o => o.candidate === chosen[0].candidate)!;
    if (!((kept.candidate.actualImpact ?? 0) < ask - .08)) return;
    const row: any = {i, ask, kept: summary(kept.candidate), production: kept.interval.candidates.map(summary)};
    withArcStudy(ctx, kept.parent.seq.lines, i, (study, child) => {
      try {
        const o = ctx.options;
        const wide = searchInterval(study, child, i, {samples: width * (o.samples ?? 80), guidanceSamples: width * (o.guidanceSamples ?? 0),
          responseSamples: width * (o.responseSamples ?? 0)}, [child]);
        row.wide = wide?.candidates.map(summary) ?? [];
      } catch (error) {row.wide = null; row.error = String(error).slice(0, 160);}
    });
    probes.push(row);
  }, () => compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'}));
  for (const p of probes) appendFileSync(join(out, 'probes.jsonl'), JSON.stringify({spec: id, stratum: c.bench.stratum, seed, ...p}) + '\n');
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({spec: id, seed, complete: cell.complete, score: cell.score?.score ?? 0, trackHash: digest(track)}) + '\n');
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => {const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN;};

function report(dir: string, armDir?: string) {
  if (armDir) {
    const rides = readFileSync(join(dir, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    const same = rides.filter(r => JSON.parse(readFileSync(join(armDir, 'cells', `${r.spec}~${r.seed}.json`), 'utf8')).trackHash === r.trackHash).length;
    console.log(`track identity: ${same}/${rides.length} identical to the saved arm`);
  }
  const rows = readFileSync(join(dir, 'probes.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => r.wide);
  console.log(`${rows.length} strong catches short by more than 0.08 (ask ${mean(rows.map(r => r.ask)).toFixed(3)}, kept ${mean(rows.map(r => r.kept[0])).toFixed(3)})`);
  console.log(`pool sizes: production median ${median(rows.map(r => r.production.length))}, wide median ${median(rows.map(r => r.wide.length))}`);
  const closest = (pool: any[], ask: number, side?: number) => pool.filter(t => t[0] !== null && (side === undefined || t[4] === side))
    .reduce((a: any, b: any) => !a || Math.abs(b[0] - ask) < Math.abs(a[0] - ask) ? b : a, null);
  for (const [name, pick] of [['production', (r: any) => r.production], ['wide', (r: any) => r.wide]] as const) {
    const gaps = rows.map(r => {const s = closest(pick(r), r.ask); return s ? r.ask - s[0] : NaN;}).filter(Number.isFinite);
    console.log(`  ${name.padEnd(10)}: the pool's candidate closest to the ask falls short by ${mean(gaps).toFixed(3)} (median ${median(gaps).toFixed(3)}); ` +
      `within 0.05 of the ask in ${(100 * gaps.filter(g => Math.abs(g) <= .05).length / gaps.length).toFixed(0)}% of catches`);
  }
  console.log('\n  cost apart from strength of the cheapest candidate within d of the ask, minus the kept one\'s ' +
    '(share of catches with any such candidate; mean extra cost; its signed speed and air residuals against the kept)');
  for (const d of [.03, .06, .1]) for (const [name, pick] of [['production', (r: any) => r.production], ['wide', (r: any) => r.wide]] as const) {
    const found: number[] = [], speed: number[] = [], air: number[] = [];
    let any = 0;
    for (const r of rows) {
      const near = pick(r).filter((t: any) => t[0] !== null && Math.abs(t[0] - r.ask) <= d);
      if (!near.length) continue;
      any++;
      const best = near.reduce((a: any, b: any) => b[1] < a[1] ? b : a);
      found.push(best[1] - r.kept[1]); speed.push(best[3] - r.kept[3]); air.push(best[2] - r.kept[2]);
    }
    console.log(`  d=${d.toFixed(2)} ${name.padEnd(10)} ${(100 * any / rows.length).toFixed(0).padStart(3)}%  extra cost ${mean(found).toFixed(4)} ` +
      `(median ${median(found).toFixed(4)})  speed ${mean(speed).toFixed(3)}  air ${mean(air).toFixed(3)}`);
  }
  console.log('\n  by contact side in the wide pool: the strongest candidate, and the cheapest within 0.06 of the ask');
  for (const [side, label] of [[1, 'surface below'], [-1, 'surface above']] as const) {
    const strongest = rows.map(r => r.wide.filter((t: any) => t[4] === side && t[0] !== null).reduce((m: number, t: any) => Math.max(m, t[0]), -1)).filter(x => x >= 0);
    const near = rows.map(r => {const n = r.wide.filter((t: any) => t[4] === side && t[0] !== null && Math.abs(t[0] - r.ask) <= .06);
      return n.length ? n.reduce((a: any, b: any) => b[1] < a[1] ? b : a) : null;}).filter(Boolean) as any[];
    console.log(`  ${label.padEnd(14)} candidates in ${(100 * rows.filter(r => r.wide.some((t: any) => t[4] === side)).length / rows.length).toFixed(0)}% of pools; ` +
      `strongest ${mean(strongest).toFixed(3)}; near the ask in ${(100 * near.length / rows.length).toFixed(0)}%, cost apart from strength ${mean(near.map(t => t[1])).toFixed(4)}, ` +
      `speed ${mean(near.map(t => t[3])).toFixed(3)}, air ${mean(near.map(t => t[2])).toFixed(3)}`);
  }
  console.log(`  kept: cost apart from strength ${mean(rows.map(r => r.kept[1])).toFixed(4)}, speed ${mean(rows.map(r => r.kept[3])).toFixed(3)}, air ${mean(rows.map(r => r.kept[2])).toFixed(3)}`);
  const errors = readFileSync(join(dir, 'probes.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => !r.wide).length;
  if (errors) console.log(`\n${errors} probes failed`);
}

if (command === 'worker') await worker(arg('spec', ''), Number(arg('seed', '101')), Number(arg('width', '10')));
else if (command === 'run') {
  const pool = new WorkerPool(workerJobs(arg('jobs', '') || undefined)), seed = Number(arg('seed', '101')), width = Number(arg('width', '10'));
  assert(Number.isSafeInteger(seed) && width >= 1, '--seed must be an integer and --width at least 1');
  const all = (await v7Cases([seed], '.', SUITE)).filter(x => x.bench.stratum !== 'E').map(x => `${x.song}~${x.variant ?? 'spec'}`);
  const queue = arg('specs', all.join(',')).split(',');
  assert(queue.every(Boolean) && new Set(queue).size === queue.length, '--specs must contain unique cases');
  assert(out && !existsSync(out), 'a new study requires a fresh output directory');
  mkdirSync(dirname(out), {recursive: true});
  mkdirSync(out);
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.catch-frontier.v1', seed, width, suite: SUITE, specs: queue}, null, 2) + '\n');
  console.log(`${queue.length} rides`);
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${seed}`, `--width=${width}`]));
} else report(out, process.argv[4]);
