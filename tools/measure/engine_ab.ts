/** Is this checkout faster or slower than a commit? One line of answer, on real compiles.
 *
 *   npm run perf:engine -- --against=HEAD --name=my-idea     compare; wrapped in taskset
 *   npm run perf:engine                                      the latest runs, one line each
 *   npm run perf:engine -- --report=my-idea,other            those runs
 *
 * Both arms are frozen copies run by the same Node, one fresh process per compile, in
 * balanced AB/BA pairs. Every compile must reproduce its committed track and work. The
 * answer is the median paired change with an exact interval; `result.json` keeps every
 * sample and nothing else stays on disk. See docs/engine-validation.md. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {cpus, tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {cellIndices, cellName, decide, measuredPairs, pairOrder, PERF_CELLS, summarizePairs} from './engine_decision.ts';
import {changedSources, enginePath, snapshotSources} from './engine_sources.ts';

const root = fileURLToPath(new URL('../../', import.meta.url)), runs = join(root, 'generated/engine-ab');
const text = {type: 'string'} as const;
const {values: options} = parseArgs({options: {against: text, candidate: text, reference: text, name: text, cells: text,
  rounds: text, 'margin-pct': text, report: text, help: {type: 'boolean'}}});
const signed = (x: number, digits = 1) => `${x > 0 ? '+' : ''}${x.toFixed(digits)}`;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1];
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** Typical value per cell, then their mean: unaffected by how many rounds finished. */
function typical(samples: any[], arm: number, key: string) {
  const cells = [...new Set(samples.map(s => s.cell))];
  const values = cells.map(cell => median(samples.filter(s => s.arm === arm && s.cell === cell).map(s => s[key])));
  return mean(values);
}

function verdict(decision: any, pairs: {base: number; candidate: number}[]) {
  const [low, high] = decision.intervalPct, {fasterPairs, slowerPairs} = summarizePairs(pairs);
  const word = decision.verdict === 'INCONCLUSIVE' ? 'unclear' : decision.verdict;
  return `${word.padEnd(10)} ${signed(decision.medianDeltaPct).padStart(5)}% [${signed(low)}, ${signed(high)}]  ` +
    `${fasterPairs} faster, ${slowerPairs} slower`;
}

/** One run, one line. */
function line(result: any, width = 0) {
  const name = (result.name as string).padEnd(width), {samples} = result, pairs = measuredPairs(samples);
  if (!result.complete) {
    const {n, medianDeltaPct} = summarizePairs(pairs);
    return `${name}  unfinished ${n}/${result.rounds} pairs${n ? `, ${signed(medianDeltaPct!)}% so far` : ''}`;
  }
  const memory = typical(samples, 1, 'maxRssMb') - typical(samples, 0, 'maxRssMb');
  return `${name}  ${verdict(result.decision, pairs)}  ${typical(samples, 0, 'nsPerFrame').toFixed(0)} -> ` +
    `${typical(samples, 1, 'nsPerFrame').toFixed(0)} ns  memory ${signed(memory, 0)} MB${result.identical ? '  (identical arms)' : ''}`;
}

function report(names: string[]) {
  const paths = names.map(name => existsSync(name) ? name : join(runs, name, 'result.json'));
  const results = paths.map(path => JSON.parse(readFileSync(path, 'utf8')));
  for (const result of results) assert.equal(result.schema, 'line.engine-ab.v4', `${result.name ?? 'this run'} predates this report`);
  const width = Math.max(0, ...results.map(r => r.name.length));
  for (const result of results) console.log(line(result, width));
}

/** The newest runs this report can read. */
function latest(count: number) {
  const saved = existsSync(runs) ? readdirSync(runs).map(name => ({name, path: join(runs, name, 'result.json')})).filter(r => existsSync(r.path)) : [];
  return saved.filter(r => JSON.parse(readFileSync(r.path, 'utf8')).schema === 'line.engine-ab.v4')
    .sort((a, b) => statSync(a.path).mtimeMs - statSync(b.path).mtimeMs).slice(-count).map(r => r.name);
}

/** A frozen source tree for one arm: a commit, or this checkout. */
function freeze(ref: string | undefined, directory: string, unpacked: string) {
  if (ref) {
    mkdirSync(unpacked);
    execFileSync('tar', ['-x', '-C', unpacked], {input: execFileSync('git', ['archive', ref], {cwd: root, maxBuffer: 2 ** 31})});
  }
  snapshotSources(ref ? unpacked : root, directory, root);
  if (ref) rmSync(unpacked, {recursive: true});
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'));
}

const commit = (ref: string) => execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {cwd: root, encoding: 'utf8'}).trim();

function compare() {
  const {against, candidate, reference} = options;
  assert(!!against !== !!reference, 'give one of --against=<git ref> or --reference=<wasm>');
  const name = options.name ?? new Date().toISOString().slice(0, 19).replace(/\D/g, ''), out = join(runs, name);
  assert(!existsSync(out), `${name} already exists; choose another --name`);
  const {cells} = JSON.parse(readFileSync(join(root, 'tools/parity/cells.json'), 'utf8'));
  const chosen = cellIndices(cells, (options.cells ?? PERF_CELLS.join(',')).split(','));
  const rounds = Number(options.rounds ?? 8), marginPct = Number(options['margin-pct'] ?? .5), order = pairOrder(rounds, 1729);
  const work = mkdtempSync(join(tmpdir(), 'perf-engine-')), arms = [join(work, 'a'), join(work, 'b')];
  try {
    freeze(against && commit(against), arms[0], join(work, 'unpacked'));
    freeze(candidate && commit(candidate), arms[1], join(work, 'unpacked'));
    if (reference) copyFileSync(resolve(reference), join(arms[0], enginePath));
    const changed = changedSources(arms[0], arms[1]);
    const identical = !changed.length && readFileSync(join(arms[0], enginePath)).equals(readFileSync(join(arms[1], enginePath)));
    mkdirSync(out, {recursive: true});
    const result: any = {schema: 'line.engine-ab.v4', name, complete: false, date: new Date().toISOString(), head: commit('HEAD'),
      against: against ?? null, candidate: candidate ?? 'checkout', reference: reference ?? null, identical, sourceChanges: changed,
      machine: {cpu: cpus()[0].model, node: process.version, nodeOptions: process.env.NODE_OPTIONS ?? '',
        affinity: readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(.*)$/m)?.[1]},
      cells: chosen.map(index => cellName(cells[index])), rounds, marginPct, samples: []};
    const save = () => {
      writeFileSync(join(out, 'result.tmp'), JSON.stringify(result, null, 2) + '\n');
      renameSync(join(out, 'result.tmp'), join(out, 'result.json'));
    };
    save();
    for (let round = 0; round < rounds; round++) {
      for (const cell of chosen) for (const arm of order[round]) {
        const output = join(work, 'cell.json');
        execFileSync(process.execPath, ['tools/parity/parity.ts', 'worker', `--cell=${cell}`, `--out=${output}`],
          {cwd: arms[arm], stdio: ['ignore', 'ignore', 'inherit'], env: {...process.env, LR_ENGINE: 'wasm'}});
        const {trackHash, physicalFrames, compileMs, compileCpuMs, resources} = JSON.parse(readFileSync(output, 'utf8'));
        assert.equal(trackHash, cells[cell].trackHash, `${cellName(cells[cell])}: track changed in arm ${arm}`);
        assert.equal(physicalFrames, cells[cell].physicalFrames, `${cellName(cells[cell])}: charged work changed in arm ${arm}`);
        result.samples.push({round, cell: cellName(cells[cell]), arm, compileMs, cpuMs: compileCpuMs, nsPerFrame: compileMs * 1e6 / physicalFrames,
          wasmMb: resources.wasmLinearMemoryBytes / 2 ** 20, maxRssMb: resources.processMaxRssBytes / 2 ** 20});
      }
      save();
      console.log(`pair ${round + 1}/${rounds}: ${signed(summarizePairs(measuredPairs(result.samples)).medianDeltaPct!)}% so far`);
    }
    result.decision = decide(measuredPairs(result.samples), .95, marginPct);
    result.cellDecisions = result.cells.map((cell: string) => ({cell, decision: decide(measuredPairs(result.samples, cell), .95, marginPct)}));
    result.complete = true;
    save();
    console.log(`\n${line(result)}`);
    if (result.cells.length > 1) for (const {cell, decision} of result.cellDecisions)
      console.log(`  ${verdict(decision, measuredPairs(result.samples, cell))}  ${cell}`);
    console.log(`\n${join(out, 'result.json')}`);
  } finally {
    rmSync(work, {recursive: true, force: true});
  }
}

if (options.help) console.log(`npm run perf:engine -- --against=<git ref> [options]
  --candidate=<git ref>    measure this commit instead of the checkout
  --reference=<wasm>       instead of --against: same source, another engine build
  --name=<run>             saved under generated/engine-ab; default: the time
  --cells=<a,b>            default: two songs at the production allowance
  --rounds=8               pairs per cell, even; 8 is the fewest with a 95% interval
  --margin-pct=.5          changes smaller than this do not count as a difference
  --report=<run,run>       show saved runs; with no options at all, the latest ten
Wrap it in taskset with two performance cores, on a quiet machine.`);
else if (options.against || options.reference) compare();
else report(options.report?.split(',') ?? latest(10));
