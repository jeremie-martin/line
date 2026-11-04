/** Modern adapter for the archived perf_ab engine decision workflow.
 * Same disposable cwd/Node and fixed runner for both arms. By default swap only
 * WASM; --reference-root also compares a frozen earlier compiler/wrapper source.
 * Each arm gets a fresh warmed process. Fixed rounds, raw samples, no peeking
 * verdict, and a fresh confirmation of a frozen screening candidate.
 */
import assert from 'node:assert/strict';
import {copyFileSync, existsSync, readFileSync, symlinkSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpus, platform, release} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decide, decideCompileCells} from './engine_decision.ts';
import {snapshotSources, sourceOverlay} from './engine_sources.ts';

const arg = (key: string, fallback = '') => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const sha = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
const enginePath = 'scripts/lib/native_motion/engine.wasm';
const schema = 'line.engine-ab.v2';
type Protocol = {mode: string; stage: string; rounds: number; confirmRounds: number; reps: number; warmup: number; threshold: number; cells: number[]};

/** Report saved evidence without rerunning or rewriting it. A failed null
 * control must also fail the CLI, so automation cannot silently bless it. */
function report(result: any) {
  assert.equal(result.schema, schema, 'unsupported measurement version');
  assert.equal(result.complete, true, 'measurement is incomplete');
  console.log(JSON.stringify({schema: result.schema, control: result.control, controlPassed: result.controlPassed,
    decision: result.decision, cellDecisions: result.cellDecisions, performanceQualified: result.performanceQualified}, null, 2));
  if (result.control && result.controlPassed !== true) process.exitCode = 1;
}

async function worker() {
  const config: Protocol = JSON.parse(readFileSync(arg('config'), 'utf8'));
  if (config.mode === 'engine') {
    const {run, instance, workloads} = await import('./engine_workload.ts');
    const module = new WebAssembly.Module(readFileSync(enginePath));
    if (arg('verify') === 'true') return workloads.map(workload => ({workload, ...run(instance(module), workload, true)}));
    let wallMs = 0, cpuMs = 0, frames = 0;
    const measurements: {workload: string; wallMs: number; cpuMs: number; frames: number}[] = [];
    for (let rep = -config.warmup; rep < config.reps; rep++) {
      for (const workload of workloads) {
        globalThis.gc?.();
        const ex = instance(module), cpu = process.cpuUsage(), start = performance.now();
        const result = run(ex, workload), elapsed = performance.now() - start, used = process.cpuUsage(cpu);
        if (rep >= 0) {
          const ms = (used.user + used.system) / 1000;
          wallMs += elapsed; cpuMs += ms; frames += result.frames;
          measurements.push({workload, wallMs: elapsed, cpuMs: ms, frames: result.frames});
        }
      }
    }
    return {wallMs, cpuMs, frames, nsPerFrame: wallMs * 1e6 / frames, measurements};
  }
  const {compileWorker} = await import('../parity/parity.ts');
  const cells = JSON.parse(readFileSync('tools/parity/cells.json', 'utf8')).cells;
  const resourceCell = arg('resources-cell');
  const selectedCells = resourceCell === '' ? config.cells : [Number(resourceCell)];
  let wallMs = 0, cpuMs = 0, frames = 0;
  const measurements: any[] = [];
  for (let rep = resourceCell === '' ? -config.warmup : 0; rep < (resourceCell === '' ? config.reps : 1); rep++) {
    for (const cell of selectedCells) {
      const output = resolve('worker-cell.json');
      await compileWorker(cell, output, resourceCell !== '');
      const {trackHash, physicalFrames, compileMs, compileCpuMs, resources} = JSON.parse(readFileSync(output, 'utf8'));
      assert.equal(trackHash, cells[cell].trackHash, `cell ${cell}: track parity`);
      assert.equal(physicalFrames, cells[cell].physicalFrames, `cell ${cell}: work parity`);
      if (rep >= 0) {
        wallMs += compileMs; cpuMs += compileCpuMs; frames += physicalFrames;
        measurements.push({cell, trackHash, physicalFrames, compileMs, cpuMs: compileCpuMs, resources});
      }
    }
  }
  return {wallMs, cpuMs, frames, nsPerFrame: wallMs * 1e6 / frames, measurements};
}

if (process.argv.includes('--worker')) {
  writeFileSync(arg('result'), JSON.stringify(await worker()));
} else if (arg('report')) {
  report(JSON.parse(readFileSync(arg('report'), 'utf8')));
} else {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const stage = arg('stage', 'screen'), mode = arg('mode', 'engine');
  const config: Protocol = {mode, stage, rounds: Number(arg('rounds', stage === 'confirm' ? '24' : '12')),
    confirmRounds: Number(arg('confirm-rounds', '24')), reps: Number(arg('reps', mode === 'engine' ? '2' : '1')),
    warmup: Number(arg('warmup', '1')), threshold: Number(arg('p', '.95')),
    cells: arg('cells', '61').split(',').map(Number)};
  assert(['engine', 'compile'].includes(mode) && ['screen', 'confirm'].includes(stage));
  for (const n of [config.rounds, config.confirmRounds]) assert(Number.isInteger(n) && n >= 8 && n <= 256, 'rounds must be 8..256');
  for (const n of [config.reps, config.warmup]) assert(Number.isInteger(n) && n >= 1 && n <= 100);
  assert(config.threshold > .5 && config.threshold < 1);
  const cellCount = JSON.parse(readFileSync(join(root, 'tools/parity/cells.json'), 'utf8')).cells.length;
  assert(config.cells.length && new Set(config.cells).size === config.cells.length && config.cells.every(c => Number.isInteger(c) && c >= 0 && c < cellCount));
  const paths = [resolve(arg('reference')), resolve(arg('candidate', enginePath))];
  assert(arg('reference') && arg('out'), '--reference=<wasm> and --out=<new directory> are required');
  const binaries = paths.map(p => readFileSync(p)), artifacts = paths.map((path, i) => ({path, sha256: sha(binaries[i])}));
  const out = resolve(arg('out'));
  assert(!existsSync(out), 'output already exists; use a new run name (never overwrite evidence)');
  const sandbox = join(out, 'worktree');
  snapshotSources(root, sandbox, root);
  const referenceRoot = arg('reference-root');
  const referenceSource = referenceRoot ? join(out, 'reference-source') : sandbox;
  if (referenceRoot) snapshotSources(resolve(referenceRoot), referenceSource, root);
  const sources = sourceOverlay(referenceSource, sandbox);
  const [referenceSourceSha256, sourceSha256] = sources.sourceSha256;
  symlinkSync(join(root, 'node_modules'), join(sandbox, 'node_modules'));
  const snapshots = binaries.map((bytes, i) => {const path = join(out, `arm-${i}.wasm`); writeFileSync(path, bytes); return path;});
  const configPath = join(out, 'protocol.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  let screening: any;
  if (stage === 'confirm') {
    assert(arg('screen'), 'confirmation requires --screen=<screen result.json>');
    screening = JSON.parse(readFileSync(arg('screen'), 'utf8'));
    assert.equal(screening.schema, schema, 'measurement protocol changed; run a fresh screen');
    assert.equal(screening.complete, true);
    assert.equal(screening.control, false, 'an A/A control cannot qualify a candidate');
    assert.equal(screening.protocol.stage, 'screen');
    assert.equal(screening.decision.verdict, 'KEEP', 'only a screened candidate can enter confirmation');
    assert(!screening.cellDecisions?.some((c: any) => c.decision.verdict === 'REJECT'), 'screening detected a compile-cell regression');
    assert.equal(screening.sourceSha256, sourceSha256, 'candidate source changed since screening');
    assert.equal(screening.referenceSourceSha256 ?? screening.sourceSha256, referenceSourceSha256, 'reference source changed since screening');
    assert.deepEqual(screening.artifacts.map((a: any) => a.sha256), artifacts.map(a => a.sha256), 'WASM changed since screening');
    for (const key of ['mode', 'reps', 'warmup', 'threshold', 'cells'] as const) assert.deepEqual(config[key], screening.protocol[key]);
    assert.equal(config.rounds, screening.protocol.confirmRounds, 'confirmation count must be fixed at screening');
  }
  const result: any = {schema, complete: false,
    adaptedFrom: 'archive/pre-rework-2026-10-03:scripts/v0/bench/perf_ab.ts',
    date: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    machine: {cpu: cpus()[0].model, node: process.version, v8: process.versions.v8,
      workerFlags: ['--expose-gc', '--import', 'tsx'], nodeOptions: process.env.NODE_OPTIONS ?? '', platform: platform(), release: release(),
      affinity: existsSync('/proc/self/status') ? readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(.*)$/m)?.[1] : null},
    sourceSha256, referenceSourceSha256, sourceChanges: sources.changed, referenceRoot: referenceRoot || null, artifacts, protocol: config, screening: arg('screen') || null,
    interpretation: 'Fixed-round paired bootstrap support and exact sign safeguard on this workload; not a posterior probability or an anytime-valid rule. Full correctness gates are separate.',
    timingScope: mode === 'compile' ? 'CPU and wall clocks enclose compileHandoff only, with prepared inputs; hashing, output and resource sampling excluded.' :
      'CPU and wall clocks enclose run(instance, workload); instance creation and GC excluded.',
    resourceScope: 'Compile resources use one fresh process per arm and cell, sampled after compilation without forced GC. WASM linear memory is a high-water capacity, heapUsed is a JS heap snapshot, rss is current process residency, processMaxRssBytes is lifetime process peak. These are not live allocation counts or timed samples.',
    samples: []};
  if (screening) assert.deepEqual(result.machine, screening.machine, 'host, Node or CPU affinity changed since screening');
  const save = () => writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  save(); // Protocol and candidate are frozen before the first measurement.
  function measure(arm: number, label: string, verify = false, resourceCell?: number) {
    sources.activate(arm);
    copyFileSync(snapshots[arm], join(sandbox, enginePath));
    const output = join(out, `${label}-${arm}.json`);
    execFileSync(process.execPath, ['--expose-gc', '--import', 'tsx', 'tools/measure/engine_ab.ts', '--worker',
      `--config=${configPath}`, `--result=${output}`, `--verify=${verify}`,
      ...(resourceCell === undefined ? [] : [`--resources-cell=${resourceCell}`])],
    {cwd: sandbox, env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'pipe']});
    return JSON.parse(readFileSync(output, 'utf8'));
  }
  if (mode === 'engine') {
    result.verification = measure(0, 'verify', true);
    assert.deepEqual(measure(1, 'verify', true), result.verification, 'state/event/cache-work mismatch');
  } else {
    result.resources = config.cells.map(cell => ({cell, arms: [0, 1].map(arm =>
      measure(arm, `resources-${cell}`, false, cell).measurements[0])}));
    save();
  }
  for (let round = 0; round < config.rounds; round++) {
    for (const arm of round % 2 === 0 ? [0, 1] : [1, 0]) result.samples.push({round, arm, ...measure(arm, `round-${round}`)});
    const pair = result.samples.slice(-2).sort((a: any, b: any) => a.arm - b.arm);
    assert.equal(pair[0].frames, pair[1].frames, 'timed physics work changed');
    save();
    console.log(`pair ${round + 1}/${config.rounds}: base ${pair[0].nsPerFrame.toFixed(1)}, candidate ${pair[1].nsPerFrame.toFixed(1)} ns/frame`);
  }
  result.decision = decide(Array.from({length: config.rounds}, (_, round) => ({
    base: result.samples.find((s: any) => s.round === round && s.arm === 0).nsPerFrame,
    candidate: result.samples.find((s: any) => s.round === round && s.arm === 1).nsPerFrame})), config.threshold);
  // Expose heterogeneous compile effects: an aggregate win must not conceal a
  // detected regression in an individual case. These are conservative harm
  // checks, not additional opportunities to claim an aggregate speedup.
  const cells = mode === 'compile' ? decideCompileCells(result.samples, config.cells, config.threshold) : {decisions: [], regressionGuardPassed: true};
  result.cellDecisions = cells.decisions;
  result.regressionGuardPassed = cells.regressionGuardPassed;
  result.control = artifacts[0].sha256 === artifacts[1].sha256 && referenceSourceSha256 === sourceSha256;
  result.controlPassed = result.control ? result.decision.verdict === 'INCONCLUSIVE' : null;
  result.performanceQualified = !result.control && stage === 'confirm' && result.decision.verdict === 'KEEP' && result.regressionGuardPassed;
  result.complete = true;
  save();
  report(result);
}
