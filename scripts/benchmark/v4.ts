/** Separate V4 pilot CLI. Full panels only; the previous version command surfaces stay intact. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { loadCases, caseSpec, sha, type Case } from '../../benchmark/v4/model.ts';
import { policy } from '../../benchmark/v4/policy.ts';
import { evaluateTrack, summarize } from '../../benchmark/v4/evaluator.ts';
import {enginePath,verifyFrozen} from '../../benchmark/v4/contract.ts';
import {loadCases as loadV3} from '../../benchmark/v3/model.ts';
import { validateSpec } from '../v0/core/substrate.ts';

const args = process.argv.slice(2), command = args.find(a => !a.startsWith('--')) ?? 'help';
const arg = (key: string) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const write = (path: string, value: unknown) => {
  mkdirSync(dirname(path), { recursive: true });
  const body = JSON.stringify(value) + '\n', temporary = path + '.' + process.pid + '.tmp';
  writeFileSync(temporary, body); renameSync(temporary, path); writeFileSync(path + '.sha256', sha(body) + '\n');
};
const verified = (path: string) => { const b = readFileSync(path); assert.equal(sha(b), readFileSync(path + '.sha256', 'utf8').trim(), path); return JSON.parse((path.endsWith('.gz') ? gunzipSync(b) : b).toString()); };
const cases = loadCases(), lock = read('benchmark/v4/catalog.lock.json');
const judge = verifyFrozen;
function compilerIdentity(root: string) {
  const paths: string[] = read('benchmark/v2/campaign-baseline.json').compiler_source_files;
  const files = Object.fromEntries(paths.filter(p => existsSync(resolve(root, p))).map(p => [p, sha(readFileSync(resolve(root, p)))]));
  return { commit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(),
    sourceSha256: sha(JSON.stringify(files)), files, engineSha256: sha(readFileSync(resolve(root, enginePath))) };
}
function geometry(track: any) {
  // Endpoint-connected components, independent of compiler line IDs or arc count.
  const owners = new Map<string, number>(), parents: number[] = [];
  const find = (i: number): number => parents[i] === i ? i : (parents[i] = find(parents[i]));
  for (const [i, l] of track.lines.entries()) {
    parents.push(i);
    for (const key of [`${l.x1},${l.y1}`, `${l.x2},${l.y2}`]) {
      const previous = owners.get(key); if (previous !== undefined) parents[find(i)] = find(previous); else owners.set(key, i);
    }
  }
  const groups = new Map<number, { segments: number; length: number }>();
  for (const [i, l] of track.lines.entries()) {
    const id = find(i), value = groups.get(id) ?? { segments: 0, length: 0 };
    value.segments++; value.length += Math.hypot(l.x2 - l.x1, l.y2 - l.y1); groups.set(id, value);
  }
  const components = [...groups.values()];
  return { segments: track.lines.length, allNormal: track.lines.every((l: any) => l.type === 0), components: components.length,
    singleSegmentComponents: components.filter(c => c.segments === 1).length,
    shortestComponent: components.length ? Math.min(...components.map(c => c.length)) : null,
    note: 'Descriptive physical geometry, not an automatic aesthetic certificate.' };
}
if (command === 'status') {
  console.log(JSON.stringify({ policy, catalog: lock, audit: read('benchmark/v4/static-audit.json'),
    ...(existsSync('benchmark/v4/baseline.json') ? { baseline: verified('benchmark/v4/baseline.json') } : {}) }, null, 2));
} else if (command === 'worker') {
  const out = resolve(arg('out')!), plan = verified(resolve(out, 'plan.json'));
  const c = cases.find(c => c.id === arg('source'))!; assert.ok(c);
  const seed = Number(arg('seed')); assert.ok(plan.seeds.includes(seed));
  assert.equal(plan.judge.inputSha256, lock.specificationsSha256);
  const { compileHandoff } = await import(pathToFileURL(resolve(plan.compilerRoot, 'scripts/v0/optimizer/handoff.ts')).href);
  const start = performance.now(), result = compileHandoff(caseSpec(c), seed, { budget: plan.budget });
  const compileMs = performance.now() - start, compileMaxRssKb = process.resourceUsage().maxRSS;
  assert.ok(Number.isFinite(result.stats.sim_frames) && result.stats.sim_frames <= plan.budget, 'compiler work budget overrun');
  const judgeStart = performance.now(), evaluation = evaluateTrack(c, result.track), judgeMs = performance.now() - judgeStart;
  const trackHash = sha(JSON.stringify(result.track)), name = `${c.id}-${seed}`;
  write(resolve(out, 'tracks', name + '.json'), result.track);
  write(resolve(out, 'cells', name + '.json'), { schema: 'line.benchmark-v4.cell.v1', sourceId: c.id, seed,
    planSha256: sha(readFileSync(resolve(out, 'plan.json'))), trackHash, ...evaluation,
    resources: { physicalFrames: result.stats.sim_frames, compileMs, judgeMs, compileMaxRssKb, processMaxRssKb: process.resourceUsage().maxRSS },
    geometry: geometry(result.track), compilerStats: result.stats });
} else if (command === 'eval') {
  if (!arg('out') || !arg('compiler-root')) throw new Error('eval requires --out and --compiler-root');
  const out = resolve(arg('out')!), compilerRoot = resolve(arg('compiler-root')!);
  const seeds = (arg('seeds') ?? policy.seeds.join(',')).split(',').map(Number), budget = Number(arg('budget') ?? policy.budget), jobs = Number(arg('jobs') ?? 16);
  assert.ok(seeds.length && seeds.every(Number.isSafeInteger) && new Set(seeds).size === seeds.length);
  assert.ok(Number.isSafeInteger(budget) && budget > 0 && Number.isSafeInteger(jobs) && jobs > 0 && jobs <= 48);
  for (const c of cases) validateSpec(caseSpec(c));
  const compiler = compilerIdentity(compilerRoot); assert.equal(compiler.dirty, '', 'use a clean compiler checkout');
  const identity = judge(); assert.equal(compiler.engineSha256, identity.engineSha256, 'compiler/judge engine mismatch');
  const plan = { schema: 'line.benchmark-v4.plan.v1', compilerRoot, compiler, judge: identity,
    suiteFingerprint: sha(JSON.stringify(identity)), executionSha256: sha(readFileSync(import.meta.filename)),
    node: process.version, seeds, budget, sources: cases.map(c => c.id),
    profile: budget === policy.budget && JSON.stringify(seeds) === JSON.stringify(policy.seeds) ? 'canonical' : 'diagnostic' };
  mkdirSync(out, { recursive: true });
  const planPath = resolve(out, 'plan.json');
  if (existsSync(planPath)) assert.deepEqual(verified(planPath), plan, 'cached plan mismatch'); else write(planPath, plan);
  const queue = cases.flatMap(c => seeds.map(seed => ({ c, seed }))), failed: string[] = [];
  let done = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) {
      const { c, seed } = queue.shift()!, name = `${c.id}-${seed}`, path = resolve(out, 'cells', name + '.json');
      if (existsSync(path)) { const row = verified(path); assert.equal(row.planSha256, sha(readFileSync(planPath))); done++; continue; }
      mkdirSync(resolve(out, 'logs'), { recursive: true }); const log = openSync(resolve(out, 'logs', name + '.log'), 'w');
      try {
        const code = await new Promise<number | null>((finish, reject) => {
          const p = spawn(process.execPath, ['--import', 'tsx', import.meta.filename, 'worker', `--out=${out}`, `--source=${c.id}`, `--seed=${seed}`], { env: { ...process.env, LR_ENGINE: 'wasm' }, stdio: ['ignore', log, log] });
          p.once('error', reject); p.once('exit', finish);
        });
        if (code !== 0) failed.push(name);
      } finally { closeSync(log); }
      done++; if (done % 16 === 0) console.log(JSON.stringify({ completed: done, total: cases.length * seeds.length, executionFailures: failed.length }));
    }
  }));
  assert.deepEqual(compilerIdentity(compilerRoot), compiler, 'compiler changed during run');
  assert.deepEqual(judge(), identity, 'judge changed during run');
  assert.equal(sha(readFileSync(import.meta.filename)),plan.executionSha256,'execution code changed during run');
  if (failed.length) { write(resolve(out, 'execution-failures.json'), failed); throw new Error(`${failed.length} execution failures; no headline published`); }
  const rows = cases.flatMap(c => seeds.map(seed => verified(resolve(out, 'cells', `${c.id}-${seed}.json`))));
  for (const r of rows) assert.equal(r.planSha256, sha(readFileSync(planPath)));
  const summary = summarize(rows, cases, seeds);
  const originalIds=new Set(loadV3().map(c=>c.id));
  const panels=Object.fromEntries([['v3',true],['extension',false]].map(([name,original])=>{
    const selected=cases.filter(c=>originalIds.has(c.id)===original);
    const ids=new Set(selected.map(c=>c.id));return [name,summarize(rows.filter(r=>ids.has(r.sourceId)),selected,seeds)];
  }));
  const record = { schema: 'line.benchmark-v4.run.v1', plan, summary, panels, rows };
  write(resolve(out, 'run.json'), record);
  console.log(JSON.stringify({ headline: summary.headline, valid: summary.valid, runs: summary.runs, distinctTracks: summary.distinctTracks, strata: summary.strata, out }));
} else if (command === 'compare') {
  if (!arg('candidate')) throw new Error('compare requires --candidate=RUN');
  const baselinePath = resolve(arg('baseline') ?? verified('benchmark/v4/baseline.json').archive.path);
  const left = verified(baselinePath), right = verified(resolve(arg('candidate')!));
  assert.equal(left.plan.suiteFingerprint, right.plan.suiteFingerprint, 'suite mismatch');
  assert.equal(right.plan.suiteFingerprint,sha(JSON.stringify(judge())),'not the frozen V4 suite');
  assert.equal(left.plan.budget, right.plan.budget, 'budget mismatch');
  assert.deepEqual(left.plan.seeds, right.plan.seeds, 'seed mismatch');
  assert.deepEqual(left.plan.sources, right.plan.sources, 'catalog mismatch');
  const before = summarize(left.rows, cases, left.plan.seeds), after = summarize(right.rows, cases, right.plan.seeds);
  const delta = round(after.headline - before.headline);
  const result = { schema: 'line.benchmark-v4.comparison.v1', suiteFingerprint: right.plan.suiteFingerprint,
    baselineSha256: sha(readFileSync(baselinePath)), candidateSha256: sha(readFileSync(resolve(arg('candidate')!))),
    before, after, delta, cases: after.specifications.map(c => ({ id: c.id, before: before.specifications.find(b => b.id === c.id)!.score, after: c.score, delta: round(c.score - before.specifications.find(b => b.id === c.id)!.score) })),
    decision: 'descriptive paired full-suite result; no automatic promotion or claim of generalization probability' };
  if (arg('out')) write(resolve(arg('out')!), result);
  console.log(JSON.stringify({ before: before.headline, after: after.headline, delta, validBefore: before.valid, validAfter: after.valid }));
} else {
  console.log('V4 pilot: status | eval --compiler-root=PATH --out=PATH [--jobs=16] [--seeds=16,17] [--budget=750000] | compare --baseline=RUN --candidate=RUN --out=PATH');
}
function round(v: number) { return Math.round(v * 10000) / 10000; }
