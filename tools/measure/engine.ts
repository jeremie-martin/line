/** Physics-only paired WASM benchmark. No compiler/search/quality scoring.
 * node tools/measure/engine.ts --reference=before.wasm --candidate=after.wasm
 * Both modules are warmed; order alternates; verification is outside timing.
 * Use a quiet machine and, on hybrid CPUs, pin the process to one core.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cpus, platform, release} from 'node:os';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {run, instance, tracks, workloads, type Workload} from './engine_workload.ts';
import {seedBlocks} from '../eval/uncertainty.ts';

const arg = (key: string, fallback: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const paths = [arg('reference', 'scripts/lib/native_motion/engine.wasm'), arg('candidate', 'scripts/lib/native_motion/engine.wasm')];
const bytes = paths.map(p => readFileSync(p)), modules = bytes.map(b => new WebAssembly.Module(b));
const rounds = Number(arg('rounds', '8')), warmup = Number(arg('warmup', '3'));
assert(Number.isInteger(rounds) && rounds >= 3 && Number.isInteger(warmup) && warmup >= 0);
const verification = workloads.map(workload => {
  const a = run(instance(modules[0]), workload, true), b = run(instance(modules[1]), workload, true);
  assert.deepEqual(b, a, `${workload}: state/event/cache-work mismatch`);
  return {workload, ...a};
});
const samples: {round: number; workload: Workload; arm: number; wallMs: number; cpuMs: number; frames: number}[] = [];
for (const workload of workloads) {
  for (let round = -warmup; round < rounds; round++) {
    for (const arm of (round % 2 === 0 ? [0, 1] : [1, 0])) {
      globalThis.gc?.();
      const ex = instance(modules[arm]);
      const cpu = process.cpuUsage(), began = performance.now();
      const {frames} = run(ex, workload);
      const wallMs = performance.now() - began, used = process.cpuUsage(cpu), cpuMs = (used.user + used.system) / 1000;
      if (round >= 0) samples.push({round, workload, arm, wallMs, cpuMs, frames});
    }
  }
}
const summary = workloads.map(workload => {
  const pairs = Array.from({length: rounds}, (_, round) => [0, 1].map(arm => samples.find(s => s.round === round && s.arm === arm && s.workload === workload)!));
  const logs = seedBlocks(pairs.map(([a, b]) => Math.log(b.wallMs / a.wallMs)));
  return {workload, referenceMs: pairs.reduce((s, [a]) => s + a.wallMs, 0) / rounds,
    candidateMs: pairs.reduce((s, [, b]) => s + b.wallMs, 0) / rounds, ratio: Math.exp(logs.mean),
    interval: 'interval' in logs ? logs.interval.map(Math.exp) : null};
});
const result = {schema: 'line.engine-performance.v1', date: new Date().toISOString(),
  machine: {cpu: cpus()[0].model, threads: cpus().length, platform: platform(), release: release(), node: process.version},
  artifacts: paths.map((path, i) => ({path: resolve(path), sha256: hash(bytes[i])})),
  inputs: tracks.map(({name}) => ({name, sha256: hash(readFileSync(resolve('tools/parity/tracks', name)))})),
  protocol: {rounds, warmup, order: 'alternating, sequential', interval: '95% Student t on paired log wall-time ratios; fixed workloads, timing noise only'},
  verification, summary, samples};
writeFileSync(arg('out', '/tmp/line-engine-performance.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({verification, summary}, null, 2));
