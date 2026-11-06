/** What the search had to choose from at strong catches (report only).
 * Compiles V7 rides in-process with an observer on each boundary's measured
 * candidates (`sequenceObserver`, arc_sequence.ts; tracks are unchanged). For
 * every catch asked >= 0.6 it keeps each viable candidate's catch strength and
 * cost terms, per parent prefix, and marks the candidate the final track kept.
 * node tools/research/strong_catch_pool.ts run OUT [--jobs=8] [--seed=101] [--specs=a~b,c~d]
 * node tools/research/strong_catch_pool.ts report OUT */
import {spawn} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {v7Cases, resolveCase} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';

const DEFAULT_SPECS = ['luna_bala_44s~spec', 'tiki_tiki_48s~spec', 'amor_na_praia_46s~spec', 'amour_de_ma_vie_44s~spec',
  'tiki_tiki_48s~v7-intense', 'tiki_tiki_48s~bench-pairs', 'amour_de_ma_vie_44s~bench-intense', 'luna_bala_44s~bench-breakdown'];
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const key = (c: any) => JSON.stringify(c);
const r4 = (x: number | undefined) => x === undefined ? null : Math.round(x * 1e4) / 1e4;

async function worker(id: string, seed: number) {
  const c = (await v7Cases([seed])).find(x => `${x.song}~${x.variant ?? 'spec'}` === id)!;
  const {spec, music, planned} = await resolveCase(c, resolveJoltMs());
  const asks = [undefined, ...music.contacts.map((t: any) => t.impact)];
  const pools: any[] = [];
  const observe: Parameters<typeof withSequenceObserver>[0] = (i, offered, chosen) => {
    if (!(asks[i] >= .6)) return;
    const parents = [...new Set(offered.map(o => o.interval))];
    pools.push({i, ask: asks[i], kept: chosen.map(o => key(o.candidate.c)), parents: parents.map(interval => interval.candidates.map(x => {
      const r = x.residuals;
      return {k: key(x.c), imp: r4(x.actualImpact), air: r4(r[0]), speed: r4(r[1]), impR: r4(r[3]),
        rest: r4(r.slice(4,x.localResidualCount).reduce((s, v) => s + v * v, 0)), prior: r4(x.cost - x.localCost),
        local: r4(x.localCost), future: r4(x.predictedFuture), offered: offered.some(o => o.candidate === x)};
    }))});
  };
  const {cell, gallery} = await withSequenceObserver(observe, () =>
    compileAndMeasure('.', planned, {spec, music}, {mode: 'strike3', budget: 'standard'}));
  const finalKeys = gallery.result.rows.map((row: any) => key(row.control));
  const measured = cell.impact3.perBeat.map((b: any) => b.hit?.strength ?? null);
  for (const p of pools) appendFileSync(join(out, 'pools.jsonl'), JSON.stringify({spec: id, seed, ...p, final: finalKeys[p.i], measured: measured[p.i - 1]}) + '\n');
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({spec: id, seed, complete: cell.complete, score: cell.score?.score ?? 0}) + '\n');
}

if (command === 'worker') await worker(arg('spec', ''), Number(arg('seed', '101')));
else if (command === 'run') {
  mkdirSync(out, {recursive: true});
  const done = new Set(existsSync(join(out, 'rides.jsonl')) ? readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).spec) : []);
  const queue = arg('specs', DEFAULT_SPECS.join(',')).split(',').filter(s => !done.has(s));
  console.log(`${queue.length} rides`);
  await Promise.all(Array.from({length: Math.min(Number(arg('jobs', '8')), queue.length)}, async () => {
    while (queue.length) {
      const spec = queue.shift()!;
      await new Promise<void>(resolve => spawn(process.execPath, [import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${arg('seed', '101')}`],
        {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']}).once('exit', () => resolve()));
    }
  }));
} else {
  const pools = readFileSync(join(out, 'pools.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const rows: any[] = [];
  for (const p of pools) {
    // The parent prefix whose pool holds the candidate the final track kept.
    const pool = p.parents.find((cs: any[]) => cs.some(x => x.k === p.final));
    if (!pool) continue;
    const kept = pool.find((x: any) => x.k === p.final), strongest = pool.reduce((a: any, b: any) => b.imp > a.imp ? b : a);
    const closest = pool.reduce((a: any, b: any) => Math.abs(b.imp - p.ask) < Math.abs(a.imp - p.ask) ? b : a);
    rows.push({...p, kept, strongest, closest, n: pool.length, offeredN: pool.filter((x: any) => x.offered).length,
      over: pool.filter((x: any) => x.imp >= p.ask - .05).length});
  }
  console.log(`strong catches with the kept candidate found in a measured pool: ${rows.length} of ${pools.length}`);
  console.log(`viable candidates per pool: median ${rows.map(r => r.n).sort((a, b) => a - b)[rows.length >> 1]}`);
  const under = rows.filter(r => r.kept.imp < r.ask - .15);
  for (const [name, v] of [['all strong', rows], ['kept is under by > 0.15', under]] as const) {
    if (!v.length) continue;
    console.log(`\n${name} (n=${v.length}): ask ${mean(v.map(r => r.ask)).toFixed(2)}, kept strength ${mean(v.map(r => r.kept.imp)).toFixed(2)}, ` +
      `strongest in the same pool ${mean(v.map(r => r.strongest.imp)).toFixed(2)}, closest to the ask ${mean(v.map(r => r.closest.imp)).toFixed(2)}`);
    console.log(`  pools holding a candidate within 0.05 of the ask or above: ${(v.filter(r => r.over > 0).length / v.length * 100).toFixed(0)}%`);
    const alt = v.filter(r => r.closest.k !== r.kept.k);
    if (!alt.length) continue;
    const d = (f: (x: any) => number) => mean(alt.map(r => f(r.closest) - f(r.kept)));
    console.log(`  where the closest-to-ask candidate was not kept (n=${alt.length}), closest minus kept:`);
    console.log(`    strength ${d(x => x.imp).toFixed(3)} | air residual² ${d(x => x.air ** 2).toFixed(4)} | speed residual² ${d(x => x.speed ** 2).toFixed(4)} | ` +
      `impact residual² ${d(x => x.impR ** 2).toFixed(4)} | extras/boundary/motion ${d(x => x.rest).toFixed(4)} | local cost ${d(x => x.local).toFixed(4)} | ` +
      `arrival priors ${d(x => x.prior).toFixed(4)} | predicted future ${d(x => x.future ?? 0).toFixed(4)}`);
    console.log(`    closest was among the offered (distinct) candidates: ${(alt.filter(r => r.closest.offered).length / alt.length * 100).toFixed(0)}%`);
  }
}
