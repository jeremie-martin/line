/** What a stronger catch really costs the next one (report only).
 * Compiles V7 rides in-process. At every catch asked >= 0.6 (and not the last
 * two), from the prefix of the beam's first kept candidate K, it also commits
 * two alternatives from the same measured pool: the candidate closest to the
 * ask (S) and the one with the lowest measured local cost (M). It then runs the
 * next interval's own search from each. These probes are isolated: the physics
 * meter is refunded, and the search memos, control memory and work counters
 * are restored, so the compiled ride must equal the saved one (checked by the
 * report).
 * Compared, for X against K:
 *   predicted = what ranking charges X for the future (valueRank beyond the
 *               local cost: the priors at their ranking weights plus the
 *               weighted learned estimate), minus the same for K;
 *   measured  = the next interval's lowest measured local cost after X, minus
 *               after K.
 * node --import tsx tools/research/catch_price.ts run OUT [--jobs=8] [--seed=101] [--specs=a~b,c~d]
 * node --import tsx tools/research/catch_price.ts report OUT [ARM_DIR] */
import {spawn} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {v7Cases, resolveCase} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {digest} from '../eval/inputs.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {searchInterval} from '../../scripts/v0/optimizer/arc_interval.ts';
import {valueRank} from '../../scripts/v0/optimizer/arc_candidates.ts';
import {withPhysicsFrameProbe} from '../../scripts/lib/detector.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';

const DEFAULT_SPECS = ['luna_bala_44s~spec', 'tiki_tiki_48s~spec', 'amor_na_praia_46s~spec', 'amour_de_ma_vie_44s~spec',
  'tiki_tiki_48s~v7-intense', 'tiki_tiki_48s~bench-pairs', 'amour_de_ma_vie_44s~bench-intense', 'luna_bala_44s~bench-breakdown'];
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const r4 = (x: number | undefined) => x === undefined || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;

/** Runs `probe` with every compile-visible side effect undone afterwards. */
function isolated<T>(ctx: any, index: number, protectedEngines: readonly Engine[], probe: () => T & (T extends PromiseLike<unknown> ? never : unknown)): T {
  const work = structuredClone(ctx.work);
  const memos = [...ctx.lineage.memoContexts].map(([k, v]: [string, Map<string, any>]) => [k, v, new Map(v)] as const);
  const memory: any = ctx.memoryFor(index), controls = memory.controls.slice(), responses = memory.responses.slice();
  try {
    return withPhysicsFrameProbe(probe);
  } finally {
    Object.assign(ctx.work, work);
    ctx.lineage.memoContexts.clear();
    for (const [k, original, copy] of memos) {original.clear(); for (const [a, b] of copy) original.set(a, b); ctx.lineage.memoContexts.set(k, original);}
    memory.controls.splice(0, memory.controls.length, ...controls);
    memory.responses.splice(0, memory.responses.length, ...responses);
    Engine.retainOnly([...protectedEngines]);
  }
}

async function worker(id: string, seed: number) {
  const c = (await v7Cases([seed])).find(x => `${x.song}~${x.variant ?? 'spec'}` === id)!;
  const {spec, music, planned} = await resolveCase(c, resolveJoltMs());
  const asks = [undefined, ...music.contacts.map((t: any) => t.impact)];
  const probes: any[] = [];
  const observe: Parameters<typeof withSequenceObserver>[0] = (i, offered, chosen, ctx, protectedEngines) => {
    if (!(asks[i]! >= .6) || i + 2 >= ctx.contacts.length || !chosen.length) return;
    const kept = offered.find(o => o.candidate === chosen[0].candidate)!, pool = kept.interval.candidates as any[];
    const ask = asks[i]!;
    const closest = pool.reduce((a, b) => Math.abs(b.meta.impact - ask) < Math.abs(a.meta.impact - ask) ? b : a);
    const measured = pool.reduce((a, b) => b.localCost < a.localCost ? b : a);
    const arms = [['K', kept.candidate], ['S', closest], ['M', measured]] as const;
    const row: any = {i, ask, nextAsk: asks[i + 1] ?? null, pool: pool.length, arms: {}};
    for (const [name, x] of arms) {
      const same = arms.find(([, y]) => y === x)![0];
      if (same !== name) {row.arms[name] = {same}; continue;}
      // What ranking charges beyond the measured local cost: the ranking's own formula (valueRank).
      const entry: any = {imp: r4(x.meta.impact), local: r4(x.localCost), ahead: r4(valueRank(ctx.options, x) - x.localCost)};
      isolated(ctx, i + 1, [...protectedEngines], () => {
        const child = ctx.lineage.add(kept.parent.seq.engine, x.lines);
        try {
          const next = searchInterval(ctx, child, i + 1, {}, [...protectedEngines, child]);
          const cs = (next?.candidates ?? []) as any[];
          if (!cs.length) {entry.next = null; return;}
          const best = cs.reduce((a, b) => b.localCost < a.localCost ? b : a);
          const near = cs.reduce((a, b) => Math.abs(b.meta.impact - (asks[i + 1] ?? 0)) < Math.abs(a.meta.impact - (asks[i + 1] ?? 0)) ? b : a);
          entry.next = {local: r4(best.localCost), imp: r4(best.meta.impact), nearImp: r4(near.meta.impact), viable: cs.length};
        } catch (error) {entry.next = null; entry.error = String(error).slice(0, 120);}
      });
      row.arms[name] = entry;
    }
    probes.push(row);
  };
  const {cell, track} = await withSequenceObserver(observe, () =>
    compileAndMeasure('.', planned, {spec, music}, {mode: 'strike3', budget: 'standard'}));
  for (const p of probes) appendFileSync(join(out, 'probes.jsonl'), JSON.stringify({spec: id, seed, ...p}) + '\n');
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({spec: id, seed, complete: cell.complete, score: cell.score?.score ?? 0, trackHash: digest(track)}) + '\n');
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
      await new Promise<void>(resolve => spawn(process.execPath, ['--import', 'tsx', import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${arg('seed', '101')}`],
        {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']}).once('exit', () => resolve()));
    }
  }));
} else {
  const armDir = process.argv[4];
  if (armDir) {
    for (const r of readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l))) {
      const saved = JSON.parse(readFileSync(join(armDir, 'cells', `${r.spec}~${r.seed}.json`), 'utf8'));
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
