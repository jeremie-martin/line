/** Can a rising arrival make the next strong catch, on a surface above? (report only)
 * Compiles rides in-process with a read-only sequence observer. At catches i where
 * both i and i+1 ask for 0.6 or more, it measures, from the same prefix, in owned
 * study contexts outside the compile's allowance:
 *   kept:    the next interval's own search after the kept candidate K;
 *   rising:  up to three candidates of the same pool that send the rider up (arrival
 *            heading under −5°), cheapest first, each followed by the next interval's
 *            own search. Nothing in the search changes: it sees a rising arrival and
 *            proposes as it always does, surfaces above included.
 * For each next search it records the cheapest, the strongest and the closest-to-ask
 * candidates per contact side, their cost apart from strength, and their arrival
 * heading into catch i+2.
 *   node tools/research/alternation_probe.ts run OUT [--jobs=N] [--seed=101] [--per-ride=8] [--specs=a~b,...]
 *   node tools/research/alternation_probe.ts report OUT */
import assert from 'node:assert/strict';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {v7Cases, resolveCase} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {searchInterval} from '../../scripts/v0/optimizer/arc_interval.ts';
import type {MeasuredCandidate} from '../../scripts/v0/optimizer/arc_candidates.ts';
import type {ArcCompileContext} from '../../scripts/v0/optimizer/arc_compile_context.ts';
import {withArcStudy} from './arc_study.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const SUITE = 'tools/eval/suites/v7.1.json';
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const r4 = (x: number | undefined | null) => x === undefined || x === null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
/** [strength, local cost, cost apart from strength, signed speed residual, side, arrival heading, arrival speed] */
const summary = (x: MeasuredCandidate) => [r4(x.actualImpact), r4(x.localCost), r4(x.localCost - (x.residuals[3] ?? 0) ** 2), r4(x.residuals[1]),
  x.c.contactSide ?? 1, r4(x.heading), r4(x.endSpeed)];

/** The next interval's own search after `lines`; its whole pool, summarized. */
function nextPool(ctx: ArcCompileContext, lines: any[], i: number) {
  return withArcStudy(ctx, lines, i + 1, (study, child) => {
    try {return searchInterval(study, child, i + 1, {}, [child])?.candidates.map(summary) ?? [];}
    catch (error) {return {error: String(error).slice(0, 160)};}
  });
}

async function worker(id: string, seed: number, perRide: number) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id);
  assert(c, `unknown case: ${id}`);
  const {spec, music, planned} = await resolveCase(c, resolveJoltMs());
  const asks = [undefined, ...music.contacts.map((t: any) => t.impact)];
  const probes: any[] = [];
  await withSequenceObserver((i, offered, chosen, ctx) => {
    if (probes.length >= perRide || !chosen.length || i + 2 >= ctx.contacts.length) return;
    if (!((asks[i] ?? 0) >= .6 && (asks[i + 1] ?? 0) >= .6)) return;
    const kept = offered.find(o => o.candidate === chosen[0].candidate)!, K = kept.candidate, prefix = kept.parent.seq.lines;
    // Candidates of this very pool whose support sends the rider up (arrival heading under −5°):
    // the search's own viable shapes, cheapest first.
    const rising = kept.interval.candidates.filter(x => x.heading < -5).sort((a, b) => a.localCost - b.localCost).slice(0, 3);
    if (!rising.length) return;
    const row: any = {i, ask: asks[i], nextAsk: asks[i + 1], gap: ctx.contacts[i + 1].frame - ctx.contacts[i].frame,
      kept: summary(K), keptNext: nextPool(ctx, [...prefix, ...K.lines], i), rising: []};
    for (const x of rising) row.rising.push({viable: true, exit: Math.round(x.heading), self: summary(x), next: nextPool(ctx, [...prefix, ...x.lines], i)});
    probes.push(row);
  }, () => compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'}));
  for (const p of probes) appendFileSync(join(out, 'probes.jsonl'), JSON.stringify({spec: id, stratum: c.bench.stratum, seed, ...p}) + '\n');
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const fmt = (x: number) => Number.isFinite(x) ? x.toFixed(3) : '—';

function report(dir: string) {
  const rows = readFileSync(join(dir, 'probes.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const pool = (p: any) => Array.isArray(p) ? p.filter((t: any) => t[0] !== null) : [];
  console.log(`${rows.length} strong catches followed by a strong ask (ask ${fmt(mean(rows.map(r => r.ask)))}, next ${fmt(mean(rows.map(r => r.nextAsk)))}, ` +
    `${mean(rows.map(r => r.gap)).toFixed(1)} frames apart)`);
  console.log(`kept: strength ${fmt(mean(rows.map(r => r.kept[0])))}, arrival at the next catch ${mean(rows.map(r => r.kept[5])).toFixed(1)}° (positive descending)`);
  const variants = rows.flatMap(r => r.rising.map((v: any) => ({...v, r})));
  const viable = variants.filter(v => v.viable);
  console.log(`rising candidates: ${viable.length}; strength ${fmt(mean(viable.map(v => v.self[0])))}, ` +
    `cost apart from strength ${fmt(mean(viable.map(v => v.self[2])))} (kept ${fmt(mean(rows.map(r => r.kept[2])))}), arrival ${mean(viable.map(v => v.self[5])).toFixed(1)}°`);
  const reasons: Record<string, number> = {};
  for (const v of variants.filter(v => !v.viable)) reasons[v.reason ?? v.error ?? 'unknown'] = (reasons[v.reason ?? v.error ?? 'unknown'] ?? 0) + 1;
  console.log(`  not viable: ${Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  const describe = (label: string, items: Array<{p: any[]; ask: number}>) => {
    const parts = items.filter(x => x.p.length);
    for (const side of [1, -1]) {
      const s = parts.map(x => ({ask: x.ask, p: x.p.filter((t: any) => t[4] === side)})).filter(x => x.p.length);
      if (!s.length) {console.log(`  ${label.padEnd(22)} ${side === 1 ? 'below' : 'above'}: none`); continue;}
      const strongest = s.map(x => Math.max(...x.p.map((t: any) => t[0])));
      const near = s.map(x => x.p.filter((t: any) => Math.abs(t[0] - x.ask) <= .06)).filter(n => n.length).map(n => n.reduce((a: any, b: any) => b[2] < a[2] ? b : a));
      console.log(`  ${label.padEnd(22)} ${side === 1 ? 'below' : 'above'}: in ${s.length}/${items.length} pools; strongest ${fmt(mean(strongest))}; ` +
        `within 0.06 of the ask in ${near.length} (cost apart from strength ${fmt(mean(near.map(t => t[2])))}, speed ${fmt(mean(near.map(t => t[3])))}, ` +
        `then arrives ${mean(near.map(t => t[5])).toFixed(1)}°)`);
    }
    const cheapest = parts.map(x => x.p.reduce((a: any, b: any) => b[1] < a[1] ? b : a));
    console.log(`  ${label.padEnd(22)} cheapest: strength ${fmt(mean(cheapest.map(t => t[0])))} (ask ${fmt(mean(parts.map(x => x.ask)))}), local ${fmt(mean(cheapest.map(t => t[1])))}, ` +
      `above in ${cheapest.filter(t => t[4] === -1).length}/${cheapest.length}`);
  };
  console.log('\nThe next catch, after the kept candidate:');
  describe('after kept', rows.map(r => ({p: pool(r.keptNext), ask: r.nextAsk})));
  console.log('\nThe next catch, after rising candidates (by arrival heading):');
  for (const [lo, hi] of [[-90, -30], [-30, -15], [-15, -5]]) {
    const vs = viable.filter(v => v.self[5] >= lo && v.self[5] < hi);
    describe(`rising ${lo}..${hi}° (${vs.length})`, vs.map(v => ({p: pool(v.next), ask: v.r.nextAsk})));
  }
  // Best pair per catch: kept-then-next against the best rising-then-next, two steps of local cost.
  let better = 0, n = 0; const gains: number[] = [];
  for (const r of rows) {
    const kn = pool(r.keptNext); if (!kn.length) continue;
    const base = r.kept[1] + Math.min(...kn.map((t: any) => t[1]));
    const alts = r.rising.filter((v: any) => v.viable && pool(v.next).length).map((v: any) => v.self[1] + Math.min(...pool(v.next).map((t: any) => t[1])));
    if (!alts.length) continue;
    n++; const best = Math.min(...alts); gains.push(base - best); if (best < base) better++;
  }
  console.log(`\nTwo steps (this catch + the next's cheapest), best rising variant against kept: better in ${better}/${n}; mean saving ${fmt(mean(gains))}`);
}

if (command === 'worker') await worker(arg('spec', ''), Number(arg('seed', '101')), Number(arg('per-ride', '8')));
else if (command === 'run') {
  const pool = new WorkerPool(workerJobs(arg('jobs', '') || undefined)), seed = Number(arg('seed', '101')), perRide = Number(arg('per-ride', '8'));
  const all = (await v7Cases([seed], '.', SUITE)).filter(x => x.bench.stratum !== 'E').map(x => `${x.song}~${x.variant ?? 'spec'}`);
  const queue = arg('specs', all.join(',')).split(',');
  assert(queue.every(Boolean) && new Set(queue).size === queue.length, '--specs must contain unique cases');
  assert(out && !existsSync(out), 'a new study requires a fresh output directory');
  mkdirSync(dirname(out), {recursive: true});
  mkdirSync(out);
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.alternation-probe.v1', seed, perRide, suite: SUITE, specs: queue}, null, 2) + '\n');
  console.log(`${queue.length} rides`);
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${seed}`, `--per-ride=${perRide}`]));
} else report(out);
