/** Where the headline's loss comes from, and why (report only).
 * Compiles rides in-process with a read-only sequence observer. At every step it
 * keeps a compact record of each measured candidate in every offered pool. After
 * the compile, each interval of the final ride is matched to its pool through
 * its control object, so for each catch we know what the search could have
 * taken instead and what that would have cost, part by part. The final track is
 * replayed for the rider's mechanical energy per frame (½v² − g·y, body mean).
 * Nothing is simulated beyond the compile and the replay; the report checks
 * track identity against a saved arm.
 *   node tools/research/loss_attribution.ts run OUT [--jobs=N] [--seed=101] [--suite=v7.1|v8] [--specs=a~b,...]
 *   node tools/research/loss_attribution.ts report OUT [ARM_DIR] */
import assert from 'node:assert/strict';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {v7Cases, resolveCase, digest} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {valueRank} from '../../scripts/v0/optimizer/arc_candidates.ts';
import {observe} from '../measure/observe.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SUITE = `tools/eval/suites/${arg('suite', 'v7.1')}.json`;
const r4 = (x: number | undefined | null) => x === undefined || x === null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
/** One candidate: strength, local cost, signed air and speed residuals, then the squared parts
 * (amplitude, strength, timing, unmatched hits, motion, rest), contact side, ranking value, and
 * its arrival at the next catch: heading (degrees, positive descending), speed (px/frame) and the sled's
 * tail-to-nose angle (degrees). */
const FIELDS = ['imp', 'local', 'air', 'speed', 'amplitude2', 'impact2', 'timing2', 'extra2', 'motion', 'rest', 'side', 'rank',
  'heading', 'endSpeed', 'pose'] as const;

async function worker(id: string, seed: number) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id);
  assert(c, `unknown case: ${id}`);
  const {spec, music, planned} = await resolveCase(c);
  const pools: number[][][] = [], where = new WeakMap<object, [number, number]>();
  await withSequenceObserver((_i, offered, _chosen, ctx) => {
    for (const interval of new Set(offered.map(o => o.interval))) {
      const p = pools.length;
      pools.push(interval.candidates.map((x, k) => {
        where.set(x.c, [p, k]);
        const r = x.residuals, sq = (j: number) => (r[j] ?? 0) ** 2, motion = x.motionCost ?? 0;
        const rest = x.localCost - sq(0) - sq(1) - sq(2) - sq(3) - sq(4) - sq(5) - motion;
        return [x.actualImpact ?? NaN, x.localCost, r[0], r[1], sq(2), sq(3), sq(4), sq(5), motion, rest, x.c.contactSide ?? 1,
          valueRank(ctx.options, x), x.heading, x.endSpeed, x.pose].map(v => r4(v) ?? NaN);
      }));
    }
  }, async () => {
    const {cell, track, gallery} = await compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'});
    const rows = gallery.result.rows as any[];
    const asks = [undefined, ...music.contacts.map((t: any) => t.impact)];
    const beats = cell.impact3?.perBeat ?? [];
    const intervals = rows.map((row, i) => {
      const at = where.get(row.control);
      const pool = at ? pools[at[0]] : null;
      return {i, frame: row.frame, next: row.next, ask: asks[i] ?? null, kept: at ? at[1] : null,
        strength: r4(beats[i - 1]?.hit?.strength), failures: row.failures ?? null, pool: pool?.map(t => t.map(v => Number.isNaN(v) ? null : v)) ?? null};
    });
    // Energy per frame: body-point mean of ½|v|² − g·y (y down), v from the point's previous position.
    const obs = observe(track, music.durationFrames, music.contacts);
    const energy = obs.frames.map((f: any) => r4(f.points.reduce((n: number, [x, y, px, py]: number[]) =>
      n + .5 * ((x - px) ** 2 + (y - py) ** 2) - .175 * y, 0) / f.points.length));
    const height = obs.frames.map((f: any) => r4(-f.points.reduce((n: number, p: number[]) => n + p[1], 0) / f.points.length));
    appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({spec: id, stratum: c.bench.stratum, seed, complete: cell.complete,
      score: cell.score?.score ?? 0, trackHash: digest(track), fields: FIELDS, intervals,
      gaps: cell.gaps, beats: music.contacts.map((t: any) => ({frame: t.frame, impact: t.impact ?? null})), energy, height}) + '\n');
  });
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
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
  const F = (name: string) => (FIELDS as readonly string[]).indexOf(name);
  const groups: Record<string, any[]> = {};
  for (const r of rides) (groups[r.stratum === 'G' ? 'G (library songs)' : r.stratum === 'E' ? 'E' : 'P (bench specs)'] ??= []).push(r);
  groups['all'] = rides;
  console.log(`\n${rides.length} rides; ${rides.reduce((n, r) => n + r.intervals.length, 0)} intervals; ` +
    `${rides.reduce((n, r) => n + r.intervals.filter((x: any) => x.pool).length, 0)} matched to their pool`);

  // Study 1: strength. Weighted by the final ride's squared strength error.
  console.log('\n== Strength: where a catch misses its ask, what the search could have taken instead');
  console.log('   classes, weighted by squared strength error:');
  console.log('   none     no candidate in the pool meaningfully closer to the ask (by 0.05)');
  console.log('   cheaper  a closer candidate cost less locally: kept for what ranking predicts ahead');
  console.log('   costly   a closer candidate cost more locally; its dominant extra part is named');
  for (const [name, rs] of Object.entries(groups)) {
    const cls: Record<string, number> = {}, parts: Record<string, number> = {};
    let total = 0, under = 0, n = 0;
    for (const r of rs) for (const x of r.intervals) {
      if (x.ask === null || x.strength === null || !x.pool || x.kept === null) continue;
      const err = x.strength - x.ask, w = err * err;
      total += w; if (err < 0) under += w; n++;
      const K = x.pool[x.kept], kErr = Math.abs(K[F('imp')] - x.ask);
      const closer = x.pool.filter((t: number[]) => t[F('imp')] !== null && Math.abs(t[F('imp')] - x.ask) <= kErr - .05);
      let key = 'none';
      if (closer.length) {
        const S = closer.reduce((a: number[], b: number[]) => b[F('local')] < a[F('local')] ? b : a);
        if (S[F('local')] <= K[F('local')]) key = 'cheaper';
        else {
          const d: Record<string, number> = {air: S[F('air')] ** 2 - K[F('air')] ** 2, speed: S[F('speed')] ** 2 - K[F('speed')] ** 2,
            timing: S[F('timing2')] - K[F('timing2')], extra: S[F('extra2')] - K[F('extra2')], motion: S[F('motion')] - K[F('motion')],
            rest: S[F('rest')] - K[F('rest')], amplitude: S[F('amplitude2')] - K[F('amplitude2')]};
          const top = Object.entries(d).reduce((a, b) => b[1] > a[1] ? b : a);
          key = `costly: ${top[0]}`;
          for (const [k, v] of Object.entries(d)) parts[k] = (parts[k] ?? 0) + w * v;
        }
      }
      cls[key] = (cls[key] ?? 0) + w;
    }
    console.log(`  ${name}: ${n} catches; undershoot ${pct(under, total)} of the squared error`);
    for (const [k, v] of Object.entries(cls).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(18)} ${pct(v, total)}`);
    const pt = Object.values(parts).reduce((a, b) => a + Math.max(0, b), 0);
    if (pt > 0) console.log(`    extra cost of the closer candidates, error-weighted: ${Object.entries(parts).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${pct(Math.max(0, v), pt)}`).join(', ')}`);
  }

  // Study 1: air, per interval (the span after each catch).
  console.log('\n== Air: the span after each catch, the same classes (weighted by the kept squared air residual)');
  for (const [name, rs] of Object.entries(groups)) {
    const cls: Record<string, number> = {};
    let total = 0, short = 0;
    for (const r of rs) for (const x of r.intervals) {
      if (!x.pool || x.kept === null) continue;
      const K = x.pool[x.kept], a = K[F('air')];
      if (a === null) continue;
      const w = a * a; total += w; if (a < 0) short += w;
      const closer = x.pool.filter((t: number[]) => t[F('air')] !== null && Math.abs(t[F('air')]) <= Math.abs(a) - .05);
      let key = 'none';
      if (closer.length) {
        const S = closer.reduce((p: number[], q: number[]) => q[F('local')] < p[F('local')] ? q : p);
        if (S[F('local')] <= K[F('local')]) key = 'cheaper';
        else {
          const d: Record<string, number> = {speed: S[F('speed')] ** 2 - K[F('speed')] ** 2, strength: S[F('impact2')] - K[F('impact2')],
            timing: S[F('timing2')] - K[F('timing2')], extra: S[F('extra2')] - K[F('extra2')], motion: S[F('motion')] - K[F('motion')],
            rest: S[F('rest')] - K[F('rest')]};
          key = `costly: ${Object.entries(d).reduce((p, q) => q[1] > p[1] ? q : p)[0]}`;
        }
      }
      cls[key] = (cls[key] ?? 0) + w;
    }
    console.log(`  ${name}: too little air ${pct(short, total)} of the squared residual`);
    for (const [k, v] of Object.entries(cls).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(18)} ${pct(v, total)}`);
  }

  // Study 3: energy over whole rides.
  console.log('\n== Energy over whole rides (½v² − g·y per unit mass, body mean)');
  console.log('   at catches: from 3 frames before each authored beat to 4 after; between: the rest');
  for (const [name, rs] of Object.entries(groups)) {
    let atCatch = 0, between = 0, frames = 0, drop = 0, strongLoss: number[] = [], strongAsk: number[] = [];
    for (const r of rs) {
      const E = r.energy, last = E.length - 1;
      const inWindow = new Array(E.length).fill(false);
      for (const b of r.beats) for (let f = Math.max(1, b.frame - 3); f <= Math.min(last, b.frame + 4); f++) inWindow[f] = true;
      for (let f = 1; f <= last; f++) if (E[f] !== null && E[f - 1] !== null) (inWindow[f] ? (atCatch += E[f] - E[f - 1]) : (between += E[f] - E[f - 1]));
      frames += last; drop += r.height[0] - r.height[last];
      for (const b of r.beats) if (b.impact !== null && b.impact >= .6 && b.frame - 3 >= 0 && b.frame + 4 <= last) {
        strongLoss.push(E[b.frame - 3] - E[b.frame + 4]); strongAsk.push(b.impact);
      }
    }
    console.log(`  ${name}: energy change per second at catches ${(atCatch / frames * 40).toFixed(1)}, between ${(between / frames * 40).toFixed(1)}; ` +
      `descent ${(drop / frames * 40).toFixed(0)} px/s; strong asks lose ${mean(strongLoss).toFixed(1)} each (ask ${mean(strongAsk).toFixed(2)})`);
  }
  // Does a strong catch's loss show in the next span's speed? Next span's signed speed residual against the loss.
  console.log('\n== Strong catches (ask >= 0.6): energy lost through the catch against the next span\'s signed speed residual');
  const pairs: Array<[number, number, number]> = [];
  for (const r of rides) for (const x of r.intervals) {
    if (x.ask === null || x.ask < .6 || !x.pool || x.kept === null) continue;
    const f = x.frame, E = r.energy;
    if (f - 3 < 0 || f + 4 >= E.length || E[f - 3] === null || E[f + 4] === null) continue;
    pairs.push([E[f - 3] - E[f + 4], x.pool[x.kept][F('speed')], x.strength ?? NaN]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const q = Math.floor(pairs.length / 4);
  [['least loss', pairs.slice(0, q)], ['', pairs.slice(q, 2 * q)], ['', pairs.slice(2 * q, 3 * q)], ['most loss', pairs.slice(3 * q)]]
    .forEach(([label, ps]: any) => console.log(`  ${String(label).padEnd(10)} loss ${mean(ps.map((p: any) => p[0])).toFixed(1)}  ` +
      `strength ${mean(ps.map((p: any) => p[2]).filter(Number.isFinite)).toFixed(3)}  next span speed residual ${mean(ps.map((p: any) => p[1])).toFixed(3)}`));
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
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.loss-attribution.v1', seed, suite: SUITE, specs: queue}, null, 2) + '\n');
  console.log(`${queue.length} rides`);
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${seed}`, `--suite=${arg('suite', 'v7.1')}`]));
} else report(out, process.argv[4]);
