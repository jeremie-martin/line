/** Fixed-sample engine/compiler comparison.
 * Same disposable cwd/Node and fixed runner for both arms. By default swap only
 * WASM; --reference-root also compares a frozen earlier compiler/wrapper source.
 * Each arm gets a fresh warmed process. Fixed rounds, raw samples, no peeking
 * verdict, and a fresh confirmation of a frozen screening candidate.
 */
import assert from 'node:assert/strict';
import {copyFileSync, existsSync, readFileSync, renameSync, symlinkSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpus, platform, release} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decide, decideCompileCells, pairOrder, summarizePairs} from './engine_decision.ts';
import {snapshotSources, sourceOverlay} from './engine_sources.ts';

const knownFlags = new Set(['reference', 'candidate', 'reference-root', 'out', 'mode', 'stage', 'rounds',
  'confirm-rounds', 'reps', 'warmup', 'confidence', 'margin-pct', 'seed', 'slowdown-pct', 'cells', 'screen',
  'report', 'help', 'worker', 'config', 'result', 'verify', 'resources-cell']);
const seenFlags = new Set<string>();
for (const argument of process.argv.slice(2)) {
  const key = argument.slice(2).split('=')[0];
  assert(argument.startsWith('--') && knownFlags.has(key), `unknown option: ${argument}`);
  assert(!seenFlags.has(key), `duplicate option: --${key}`);
  seenFlags.add(key);
  assert(key === 'help' || key === 'worker' ? argument === `--${key}` : argument.startsWith(`--${key}=`) && argument.length > key.length + 3,
    `option requires --${key}=<value>: ${argument}`);
}
const arg = (key: string, fallback = '') => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const sha = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
const enginePath = 'scripts/lib/native_motion/engine.wasm';
const schema = 'line.engine-ab.v3';
type Protocol = {mode: string; stage: string; rounds: number; confirmRounds: number; reps: number; warmup: number; confidence: number; marginPct: number; seed: number; slowdownPct: number; cells: number[]};
type TimingSample = {round: number; arm: number; nsPerFrame: number};

/** Saved progress contains complete, consecutive process pairs in AB or BA order. */
function completedPairs(samples: readonly TimingSample[]) {
  assert(samples.length % 2 === 0, 'incomplete process pair');
  return Array.from({length: samples.length / 2}, (_, round) => {
    const pair = samples.slice(2 * round, 2 * round + 2).sort((a, b) => a.arm - b.arm);
    assert(pair.every((s, arm) => s.round === round && s.arm === arm), 'one sample per arm and round required');
    return {base: pair[0].nsPerFrame, candidate: pair[1].nsPerFrame};
  });
}

/** Report saved evidence without rerunning or rewriting it. A failed null
 * control must also fail the CLI, so automation cannot silently bless it. */
function report(result: any) {
  assert([schema, 'line.engine-ab.v2'].includes(result.schema), 'unsupported measurement version');
  if (result.complete !== true) {
    assert.equal(result.complete, false);
    assert.equal(result.schema, schema, 'unfinished reports require v3');
    const progress = summarizePairs(completedPairs(result.samples)), plannedPairs = result.protocol.rounds;
    assert(Number.isInteger(plannedPairs) && plannedPairs >= 8 && plannedPairs <= 256 && plannedPairs % 2 === 0 && progress.n <= plannedPairs);
    console.log(JSON.stringify({schema, complete: false, performanceQualified: false,
      progress: {plannedPairs, ...progress},
      interpretation: 'Descriptive observations only; no probability, confidence interval or verdict. An unfinished run cannot qualify a candidate.'}, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({schema: result.schema, complete: true, control: result.control, controlPassed: result.controlPassed,
    iterationProfile: result.iterationProfile, decision: result.decision, cellDecisions: result.cellDecisions, performanceQualified: result.performanceQualified}, null, 2));
  if (result.control && result.controlPassed !== true) process.exitCode = 1;
}

/** Positive control: actual extra CPU work, recorded separately from compilation.
 * Never used for a candidate or for resource observations. */
function controlCost(cpuMs: number) {
  const pct = Number(arg('slowdown-pct', '0'));
  if (!pct) return {wallMs: 0, cpuMs: 0};
  const cpu = process.cpuUsage(), start = performance.now();
  let used;
  do {used = process.cpuUsage(cpu);} while ((used.user + used.system) / 1000 < cpuMs * pct / 100);
  return {wallMs: performance.now() - start, cpuMs: (used.user + used.system) / 1000};
}

async function worker() {
  const config: Protocol = JSON.parse(readFileSync(arg('config'), 'utf8'));
  if (config.mode === 'engine') {
    const {run, instance, workloads} = await import('./engine_workload.ts');
    const module = new WebAssembly.Module(readFileSync(enginePath));
    if (arg('verify') === 'true') return workloads.map(workload => ({workload, ...run(instance(module), workload, true)}));
    let wallMs = 0, cpuMs = 0, frames = 0;
    const iterations: any[] = [];
    for (let rep = -config.warmup; rep < config.reps; rep++) {
      for (const workload of workloads) {
        globalThis.gc?.();
        const ex = instance(module), cpu = process.cpuUsage(), start = performance.now();
        const result = run(ex, workload), elapsed = performance.now() - start, used = process.cpuUsage(cpu);
        const ms = (used.user + used.system) / 1000, control = controlCost(ms);
        const observation = {rep, workload, wallMs: elapsed + control.wallMs, cpuMs: ms + control.cpuMs, frames: result.frames, control};
        iterations.push(observation);
        if (rep >= 0) {
          wallMs += observation.wallMs; cpuMs += observation.cpuMs; frames += result.frames;
        }
      }
    }
    return {wallMs, cpuMs, frames, nsPerFrame: wallMs * 1e6 / frames, iterations};
  }
  const {compileWorker} = await import('../parity/parity.ts');
  const cells = JSON.parse(readFileSync('tools/parity/cells.json', 'utf8')).cells;
  const resourceCell = arg('resources-cell');
  const selectedCells = resourceCell === '' ? config.cells : [Number(resourceCell)];
  let wallMs = 0, cpuMs = 0, frames = 0;
  const iterations: any[] = [];
  for (let rep = resourceCell === '' ? -config.warmup : 0; rep < (resourceCell === '' ? config.reps : 1); rep++) {
    for (const cell of selectedCells) {
      const output = resolve('worker-cell.json');
      await compileWorker(cell, output, resourceCell !== '');
      const {trackHash, physicalFrames, compileMs, compileCpuMs, resources} = JSON.parse(readFileSync(output, 'utf8'));
      assert.equal(trackHash, cells[cell].trackHash, `cell ${cell}: track parity`);
      assert.equal(physicalFrames, cells[cell].physicalFrames, `cell ${cell}: work parity`);
      const control = resourceCell === '' ? controlCost(compileCpuMs) : {wallMs: 0, cpuMs: 0};
      const observation = {rep, cell, trackHash, physicalFrames, compileMs: compileMs + control.wallMs,
        cpuMs: compileCpuMs + control.cpuMs, control, resources};
      iterations.push(observation);
      if (rep >= 0) {
        wallMs += observation.compileMs; cpuMs += observation.cpuMs; frames += physicalFrames;
      }
    }
  }
  return {wallMs, cpuMs, frames, nsPerFrame: wallMs * 1e6 / frames, iterations};
}

if (process.argv.includes('--worker')) {
  writeFileSync(arg('result'), JSON.stringify(await worker()));
} else if (arg('report')) {
  report(JSON.parse(readFileSync(arg('report'), 'utf8')));
} else if (process.argv.includes('--help')) {
  console.log(`perf:engine --reference=<wasm> --out=<new directory> [--mode=compile|engine]
  --reference-root=<checkout>       compare compiler/wrapper source too
  --stage=screen|confirm            confirm requires --screen=<result.json>
  --cells=61 --rounds=12 --confirm-rounds=24
  --warmup=5 --reps=3               compile defaults; engine defaults: 1, 2; warmup 0 measures cold
  --confidence=.95 --margin-pct=2   interval and practical effect/non-regression bound
                                  margin 0 tests direction without a minimum benefit
  --seed=1729                      balanced randomized AB/BA process pairs
  --slowdown-pct=5                 positive control, identical sources/WASM only
  --report=<result.json>           read evidence, or descriptive progress for unfinished v3 runs

Identical arms form an A/A control. Controls cannot qualify a candidate.
Every iteration is retained. Fixed warmup defines a workload, not proof of steady state.
Live medians and faster/slower counts are descriptive, not probabilities or early verdicts.
Unfinished reports exit nonzero and cannot qualify a candidate.
Do not benchmark alongside other heavy work. See docs/engine-validation.md.`);
} else {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const stage = arg('stage', 'screen'), mode = arg('mode', 'engine');
  const config: Protocol = {mode, stage, rounds: Number(arg('rounds', stage === 'confirm' ? '24' : '12')),
    confirmRounds: Number(arg('confirm-rounds', '24')), reps: Number(arg('reps', mode === 'engine' ? '2' : '3')),
    warmup: Number(arg('warmup', mode === 'engine' ? '1' : '5')), confidence: Number(arg('confidence', '.95')),
    marginPct: Number(arg('margin-pct', '2')), seed: Number(arg('seed', '1729')), slowdownPct: Number(arg('slowdown-pct', '0')),
    cells: arg('cells', '61').split(',').map(Number)};
  assert(['engine', 'compile'].includes(mode) && ['screen', 'confirm'].includes(stage));
  for (const n of [config.rounds, config.confirmRounds]) pairOrder(n, config.seed);
  const order = pairOrder(config.rounds, config.seed);
  assert(Number.isInteger(config.reps) && config.reps >= 1 && config.reps <= 100);
  assert(Number.isInteger(config.warmup) && config.warmup >= 0 && config.warmup <= 100);
  for (const n of [config.rounds, config.confirmRounds])
    decide(Array.from({length: n}, () => ({base: 1, candidate: 1})), config.confidence, config.marginPct);
  assert(Number.isFinite(config.slowdownPct) && config.slowdownPct >= 0 && config.slowdownPct <= 100);
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
  const identical = artifacts[0].sha256 === artifacts[1].sha256 && referenceSourceSha256 === sourceSha256;
  assert(!config.slowdownPct || (identical && stage === 'screen'), 'slowdown controls require identical arms and screen stage');
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
    assert.equal(screening.control, false, 'a control cannot qualify a candidate');
    assert.equal(screening.protocol.stage, 'screen');
    assert.equal(screening.decision.verdict, 'FASTER', 'only a screened candidate can enter confirmation');
    assert.equal(screening.regressionGuardPassed, true, 'screening must bound every compile-cell regression');
    assert.equal(screening.sourceSha256, sourceSha256, 'candidate source changed since screening');
    assert.equal(screening.referenceSourceSha256 ?? screening.sourceSha256, referenceSourceSha256, 'reference source changed since screening');
    assert.deepEqual(screening.artifacts.map((a: any) => a.sha256), artifacts.map(a => a.sha256), 'WASM changed since screening');
    for (const key of ['mode', 'reps', 'warmup', 'confidence', 'marginPct', 'cells'] as const) assert.deepEqual(config[key], screening.protocol[key]);
    assert.equal(config.rounds, screening.protocol.confirmRounds, 'confirmation count must be fixed at screening');
  }
  const result: any = {schema, complete: false,
    date: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    machine: {cpu: cpus()[0].model, node: process.version, v8: process.versions.v8,
      workerFlags: ['--expose-gc'], nodeOptions: process.env.NODE_OPTIONS ?? '', platform: platform(), release: release(),
      affinity: existsSync('/proc/self/status') ? readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(.*)$/m)?.[1] : null},
    sourceSha256, referenceSourceSha256, sourceChanges: sources.changed, referenceRoot: referenceRoot || null, artifacts, protocol: config, pairOrder: order, screening: arg('screen') || null,
    interpretation: 'Exact conservative confidence interval for the median paired percentage change. Fixed independent process pairs; no optional stopping. A timing verdict is not an adoption decision. Full correctness/design gates are separate.',
    timingScope: mode === 'compile' ? 'CPU and wall clocks enclose compileHandoff only, with prepared inputs; hashing, output and resource sampling excluded.' :
      'CPU and wall clocks enclose run(instance, workload); instance creation and GC excluded.',
    resourceScope: 'Compile resources use one fresh process per arm and cell, sampled after compilation without forced GC. WASM linear memory is a high-water capacity, heapUsed is a JS heap snapshot, rss is current process residency, processMaxRssBytes is lifetime process peak. These are not live allocation counts or timed samples.',
    controlScope: config.slowdownPct ? 'Candidate iterations add measured CPU work after compilation/run; control costs are recorded separately. This is calibration, not compiler performance.' : null,
    samples: []};
  if (screening) assert.deepEqual(result.machine, screening.machine, 'host, Node or CPU affinity changed since screening');
  const save = () => {
    writeFileSync(join(out, 'result.json.tmp'), JSON.stringify(result, null, 2) + '\n');
    renameSync(join(out, 'result.json.tmp'), join(out, 'result.json'));
  };
  save(); // Protocol and candidate are frozen before the first measurement.
  function measure(arm: number, label: string, verify = false, resourceCell?: number) {
    sources.activate(arm);
    copyFileSync(snapshots[arm], join(sandbox, enginePath));
    const output = join(out, `${label}-${arm}.json`);
    execFileSync(process.execPath, ['--expose-gc', 'tools/measure/engine_ab.ts', '--worker',
      `--config=${configPath}`, `--result=${output}`, `--verify=${verify}`,
      `--slowdown-pct=${arm === 1 && resourceCell === undefined && !verify ? config.slowdownPct : 0}`,
      ...(resourceCell === undefined ? [] : [`--resources-cell=${resourceCell}`])],
    {cwd: sandbox, env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'pipe']});
    return JSON.parse(readFileSync(output, 'utf8'));
  }
  if (mode === 'engine') {
    result.verification = measure(0, 'verify', true);
    assert.deepEqual(measure(1, 'verify', true), result.verification, 'state/event/cache-work mismatch');
  } else {
    result.resources = config.cells.map(cell => ({cell, arms: [0, 1].map(arm =>
      measure(arm, `resources-${cell}`, false, cell).iterations[0])}));
    save();
  }
  for (let round = 0; round < config.rounds; round++) {
    for (const arm of order[round]) result.samples.push({round, arm, ...measure(arm, `round-${round}`)});
    const pair = result.samples.slice(-2).sort((a: any, b: any) => a.arm - b.arm);
    assert.equal(pair[0].frames, pair[1].frames, 'timed physics work changed');
    save();
    const progress = summarizePairs(completedPairs(result.samples));
    console.log(`pair ${round + 1}/${config.rounds}: base ${pair[0].nsPerFrame.toFixed(1)}, candidate ${pair[1].nsPerFrame.toFixed(1)} ns/frame; ` +
      `running median ${progress.medianDeltaPct!.toFixed(3)}%; faster ${progress.fasterPairs}, slower ${progress.slowerPairs}, tied ${progress.tiedPairs} (descriptive)`);
  }
  // Descriptive warmup diagnostics, not an adaptive rule for discarding data.
  result.iterationProfile = [0, 1].map(arm => ({arm, iterations: Array.from({length: config.warmup + config.reps}, (_, i) => {
    const rep = i - config.warmup;
    const values = result.samples.filter((s: any) => s.arm === arm).map((s: any) =>
      s.iterations.filter((m: any) => m.rep === rep).reduce((sum: number, m: any) => sum + (m.compileMs ?? m.wallMs), 0)).sort((a: number, b: number) => a - b);
    return {rep, warmup: rep < 0, medianWallMs: (values[values.length / 2 - 1] + values[values.length / 2]) / 2};
  })}));
  result.decision = decide(completedPairs(result.samples), config.confidence, config.marginPct);
  // Expose heterogeneous compile effects: an aggregate win must not conceal a
  // unresolved regression in an individual case. These are non-regression
  // bounds, not additional opportunities to claim an aggregate speedup.
  const cells = mode === 'compile' ? decideCompileCells(result.samples, config.cells, config.confidence, config.marginPct) : {decisions: [], regressionGuardPassed: true};
  result.cellDecisions = cells.decisions;
  result.regressionGuardPassed = cells.regressionGuardPassed;
  result.control = identical ? (config.slowdownPct ? 'slowdown' : 'null') : false;
  const controlVerdict = config.slowdownPct ? 'SLOWER' : 'EQUIVALENT';
  result.controlPassed = result.control ? [result.decision, ...cells.decisions.map(c => c.decision)]
    .every(d => d.verdict === controlVerdict) : null;
  result.performanceQualified = !result.control && stage === 'confirm' && result.decision.verdict === 'FASTER' && result.regressionGuardPassed;
  result.complete = true;
  save();
  report(result);
}
