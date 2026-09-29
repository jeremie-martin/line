/** Matched warm-process timing; the error limit is not fitted on these results. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadCases, caseSpec, sha} from '../../benchmark/v4/model.ts';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(arg('compiler-root') ?? '.'), out = resolve(arg('out') ?? 'generated/preview-quality-20260929/timing');
const identity = () => JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
  'import {compilerCandidateIdentity} from "./scripts/v0/benchmark_v2/compiler_identity.ts"; const {trackedChanges,...identity}=compilerCandidateIdentity("wasm"); console.log(JSON.stringify(identity));'],
  {cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024}));
const compiler = identity(), harnessSha256 = sha(readFileSync(import.meta.filename));
const {compileArcMotion} = await import(pathToFileURL(resolve(root, 'scripts/v0/optimizer/arc_motion.ts')).href);
const {connectedArcOptions} = await import(pathToFileURL(resolve(root, 'scripts/v0/optimizer/connected_arcs.ts')).href);
const all = loadCases(), indices = [0, 35, 70, 105, 140, 175], cases = indices.map(i => all[i]);
const modelStart = performance.now(), model = connectedArcOptions({duration: 20}, 750000).controlPolicy();
const modelLoadMs = performance.now() - modelStart;
const rows: any[] = [];
for (let repeat = 0; repeat < 3; repeat++) for (const c of cases) {
  for (const mode of repeat % 2 ? ['always', 'failure'] : ['failure', 'always']) {
    const spec = caseSpec(c), options = {...connectedArcOptions(spec, 750000), controlPolicy: model, searchAfterPreview: mode};
    const started = performance.now(), result = compileArcMotion(spec, 16, options), compileMs = performance.now() - started;
    rows.push({source: c.id, repeat, mode, compileMs, physicalFrames: result.stats.sim_frames,
      loss: result.trajectoryLoss, decision: result.proposalDecision, trackHash: sha(JSON.stringify(result.track))});
    console.log(JSON.stringify(rows.at(-1)));
  }
}
assert.deepEqual(identity(), compiler); assert.equal(sha(readFileSync(import.meta.filename)), harnessSha256);
const median = (values: number[]) => values.slice().sort((a,b) => a-b)[Math.floor(values.length / 2)];
const paired = cases.map(c => {
  const selected = rows.filter(r => r.source === c.id);
  const byMode = Object.fromEntries(['always', 'failure'].map(mode => {
    const results = selected.filter(r => r.mode === mode);
    assert.equal(new Set(results.map(r => r.trackHash)).size, 1, 'timing runs must be deterministic');
    return [mode, {medianMs: median(results.map(r => r.compileMs)), physicalFrames: results[0].physicalFrames, trackHash: results[0].trackHash}];
  }));
  return {source: c.id, ...byMode, ratio: byMode.always.medianMs / byMode.failure.medianMs};
});
mkdirSync(out, {recursive: true});
const record = {schema: 'line.preview-timing.v1', compiler, harnessSha256, modelLoadMs, indices, repeats: 3, paired, rows,
  note: 'Six equally spaced catalog entries, fixed seed 16; three paired warm-process runs with alternating order. Model decode/loading is measured separately. Shared host with other qualification jobs, not isolated latency benchmarking. These six cases do not establish a suite-wide wall-time speedup.'};
const body = JSON.stringify(record) + '\n', path = resolve(out, 'result.json');
writeFileSync(path, body); writeFileSync(path + '.sha256', sha(body) + '\n');
console.log(JSON.stringify({modelLoadMs, paired}));
