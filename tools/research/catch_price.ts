/** What a stronger catch really costs the next one (report only).
 * Compiles V7 rides in-process. At every catch asked >= 0.6 (and not the last
 * two), from the prefix of the beam's first kept candidate K, it also commits
 * two alternatives from the same measured pool: the candidate closest to the
 * ask (S) and the one with the lowest measured local cost (M). It then runs the
 * next interval's own search from each. Each probe owns its context and engine.
 * Prefix preparation is excluded from their remaining search budget. Neither
 * compiler caches nor learning are modified; the report checks track identity.
 * Compared, for X against K:
 *   predicted = what ranking charges X for the future (valueRank beyond the
 *               local cost: the priors at their ranking weights plus the
 *               weighted learned estimate), minus the same for K;
 *   measured  = the next interval's lowest measured local cost after X, minus
 *               after K.
 * node tools/research/catch_price.ts run OUT [--jobs=N] [--seed=101] [--specs=a~b,c~d]
 * node tools/research/catch_price.ts report OUT [ARM_DIR] */
import assert from 'node:assert/strict';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {v7Cases, resolveCase} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {digest} from '../eval/inputs.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {searchInterval} from '../../scripts/v0/optimizer/arc_interval.ts';
import {valueRank} from '../../scripts/v0/optimizer/arc_candidates.ts';
import {withArcStudy} from './arc_study.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const DEFAULT_SPECS = ['luna_bala_44s~spec', 'tiki_tiki_48s~spec', 'amor_na_praia_46s~spec', 'amour_de_ma_vie_44s~spec',
  'tiki_tiki_48s~v7-intense', 'tiki_tiki_48s~bench-pairs', 'amour_de_ma_vie_44s~bench-intense', 'luna_bala_44s~bench-breakdown'];
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const impactDistance = (value: number | undefined, target: number) => value === undefined ? Infinity : Math.abs(value - target);
const r4 = (x: number | undefined) => x === undefined || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;

async function worker(id: string, seed: number) {
  const c = (await v7Cases([seed])).find(x => `${x.song}~${x.variant ?? 'spec'}` === id)!;
  assert(c, `unknown study case: ${id}`);
  const {spec, music, planned} = await resolveCase(c, resolveJoltMs());
  const asks = [undefined, ...music.contacts.map((t: any) => t.impact)];
  const probes: any[] = [];
  const observe: Parameters<typeof withSequenceObserver>[0] = (i, offered, chosen, ctx) => {
    if (!(asks[i]! >= .6) || i + 2 >= ctx.contacts.length || !chosen.length) return;
    const kept = offered.find(o => o.candidate === chosen[0].candidate)!, pool = kept.interval.candidates;
    const ask = asks[i]!;
    const closest = pool.reduce((a, b) => impactDistance(b.actualImpact, ask) < impactDistance(a.actualImpact, ask) ? b : a);
    const measured = pool.reduce((a, b) => b.localCost < a.localCost ? b : a);
    const arms = [['K', kept.candidate], ['S', closest], ['M', measured]] as const;
    const row: any = {i, ask, nextAsk: asks[i + 1] ?? null, pool: pool.length, arms: {}};
    for (const [name, x] of arms) {
      const same = arms.find(([, y]) => y === x)![0];
      if (same !== name) {row.arms[name] = {same}; continue;}
      // What ranking charges beyond the measured local cost: the ranking's own formula (valueRank).
      const entry: any = {imp: r4(x.actualImpact), local: r4(x.localCost), ahead: r4(valueRank(ctx.options, x) - x.localCost)};
      withArcStudy(ctx, [...kept.parent.seq.lines, ...x.lines], i + 1, (study, child) => {
        try {
          const next = searchInterval(study, child, i + 1, {}, [child]);
          const cs = next?.candidates ?? [];
          if (!cs.length) {entry.next = null; return;}
          const best = cs.reduce((a, b) => b.localCost < a.localCost ? b : a);
          const near = cs.reduce((a, b) => impactDistance(b.actualImpact, asks[i + 1] ?? 0) < impactDistance(a.actualImpact, asks[i + 1] ?? 0) ? b : a);
          entry.next = {local: r4(best.localCost), imp: r4(best.actualImpact), nearImp: r4(near.actualImpact), viable: cs.length};
        } catch (error) {entry.next = null; entry.error = String(error).slice(0, 120);}
      });
      row.arms[name] = entry;
    }
    probes.push(row);
  };
  const {cell, track} = await withSequenceObserver(observe, () =>
    compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'}));
  for (const p of probes) appendFileSync(join(out, 'probes.jsonl'), JSON.stringify({spec: id, seed, ...p}) + '\n');
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({spec: id, seed, complete: cell.complete, score: cell.score?.score ?? 0, trackHash: digest(track)}) + '\n');
}

if (command === 'worker') await worker(arg('spec', ''), Number(arg('seed', '101')));
else if (command === 'run') {
  const pool = new WorkerPool(workerJobs(arg('jobs', '') || undefined)), seed = Number(arg('seed', '101'));
  assert(Number.isSafeInteger(seed), '--seed must be an integer');
  const queue = arg('specs', DEFAULT_SPECS.join(',')).split(',');
  assert(queue.every(Boolean) && new Set(queue).size === queue.length, '--specs must contain unique cases');
  assert(out && !existsSync(out), 'new study requires a fresh output directory; existing evidence is never resumed or overwritten');
  mkdirSync(dirname(out), {recursive: true});
  mkdirSync(out);
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.catch-price.v2', seed, specs: queue,
    preparation: 'owned context; cold prefix replayed through next entry frame outside the remaining search budget'}, null, 2) + '\n');
  console.log(`${queue.length} rides`);
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${seed}`]));
} else {
  const studyPath = join(out, 'study.json');
  console.log(existsSync(studyPath) ? JSON.parse(readFileSync(studyPath, 'utf8')) : 'Legacy study: shared engine probes with state restoration.');
  const armDir = process.argv[4];
  if (armDir) {
    for (const r of readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l))) {
      const saved = JSON.parse(readFileSync(join(armDir, 'cells', `${r.spec}~${r.seed}.json`), 'utf8'));
      if (saved.trackHash !== r.trackHash) process.exitCode = 1;
      console.log(`${saved.trackHash === r.trackHash ? 'same' : 'DIFFERENT'} track  ${r.spec}~${r.seed}`);
    }
  }
  const rows = readFileSync(join(out, 'probes.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const corr = (xs: number[], ys: number[]) => {const mx = mean(xs), my = mean(ys); let a = 0, b = 0, c = 0;
    xs.forEach((x, k) => {a += (x - mx) * (ys[k] - my); b += (x - mx) ** 2; c += (ys[k] - my) ** 2;}); return a / Math.sqrt(b * c);};
  console.log(`strong catches probed: ${rows.length}`);
  for (const name of ['S', 'M']) {
    const v = rows.filter(r => r.arms[name] && !r.arms[name].same && r.arms[name].next && r.arms.K.next);
    if (!v.length) continue;
    const label = name === 'S' ? 'S, closest to the ask' : 'M, lowest measured cost';
    const now = v.map(r => r.arms[name].local - r.arms.K.local), predicted = v.map(r => r.arms[name].ahead - r.arms.K.ahead);
    const next = v.map(r => r.arms[name].next.local - r.arms.K.next.local), net = now.map((x, k) => x + next[k]);
    console.log(`\n${label} vs kept (n=${v.length}; ${rows.filter(r => r.arms[name]?.same).length} probes where it was the kept one)`);
    console.log(`  this catch: strength ${mean(v.map(r => r.arms[name].imp)).toFixed(3)} vs ${mean(v.map(r => r.arms.K.imp)).toFixed(3)} (ask ${mean(v.map(r => r.ask)).toFixed(3)}); measured local cost change ${mean(now).toFixed(4)}`);
    console.log(`  next interval: future charged by ranking ${mean(predicted).toFixed(4)}; measured change in its best local cost ${mean(next).toFixed(4)} (median ${[...next].sort((a, b) => a - b)[next.length >> 1].toFixed(4)})`);
    console.log(`  correlation, charged vs measured: ${corr(predicted, next).toFixed(2)}`);
    console.log(`  two steps measured (this + next): ${mean(net).toFixed(4)}; better than kept in ${(net.filter(x => x < 0).length / v.length * 100).toFixed(0)}% of probes`);
    console.log(`  next catch strength (best-cost candidate) ${mean(v.map(r => r.arms[name].next.imp)).toFixed(3)} vs ${mean(v.map(r => r.arms.K.next.imp)).toFixed(3)} (next ask ${mean(v.map(r => r.nextAsk ?? 0)).toFixed(3)}); ` +
      `next pool's closest to its ask ${mean(v.map(r => r.arms[name].next.nearImp)).toFixed(3)} vs ${mean(v.map(r => r.arms.K.next.nearImp)).toFixed(3)}`);
  }
  const failed = rows.flatMap(r => Object.values(r.arms)).filter((a: any) => a && !a.same && a.next === null).length;
  console.log(`\nprobes with no viable next interval: ${failed}`);
}
