/** Physics-only paired WASM benchmark. No compiler/search/quality scoring.
 * node --import tsx tools/measure/engine.ts --reference=before.wasm --candidate=after.wasm
 * Both modules are warmed; order alternates; verification is outside timing.
 * Use a quiet machine and, on hybrid CPUs, pin the process to one core.
 */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {cpus, platform, release} from 'node:os';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {seedBlocks} from '../eval/uncertainty.ts';

const arg = (key: string, fallback: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const paths = [arg('reference', 'scripts/lib/native_motion/engine.wasm'), arg('candidate', 'scripts/lib/native_motion/engine.wasm')];
const bytes = paths.map(p => readFileSync(p)), modules = bytes.map(b => new WebAssembly.Module(b));
const rounds = Number(arg('rounds', '8')), warmup = Number(arg('warmup', '3'));
assert(Number.isInteger(rounds) && rounds >= 3 && Number.isInteger(warmup) && warmup >= 0);
const directory = resolve('tools/parity/tracks');
const tracks = readdirSync(directory).filter(p => p.endsWith('.json.gz')).sort().map(name => ({name,
  track: JSON.parse(gunzipSync(readFileSync(resolve(directory, name))).toString())}));
// ABI kept private here: the production wrapper and engine selection are unchanged.
type Exports = Record<string, any> & {memory: WebAssembly.Memory};
function instance(module: WebAssembly.Module): Exports {
  return new WebAssembly.Instance(module, {}).exports as Exports;
}
function add(ex: Exports, handle: number, lines: any[]) {
  for (let start = 0; start < lines.length; start += ex.add_lines_cap()) {
    const batch = lines.slice(start, start + ex.add_lines_cap());
    const ids = new Int32Array(ex.memory.buffer, ex.add_ids_ptr(), batch.length * 3);
    const coords = new Float64Array(ex.memory.buffer, ex.add_coords_ptr(), batch.length * 4);
    batch.forEach((l, i) => {
      ids[i * 3] = l.id; ids[i * 3 + 1] = l.type;
      ids[i * 3 + 2] = (l.flipped ? 1 : 0) | (l.leftExtended ? 2 : 0) | (l.rightExtended ? 4 : 0);
      coords[i * 4] = l.x1; coords[i * 4 + 1] = l.y1;
      coords[i * 4 + 2] = l.x2; coords[i * 4 + 3] = l.y2;
    });
    const next = ex.add_lines(handle, batch.length);
    ex.free_engine(handle);
    handle = next;
  }
  return handle;
}
function start(ex: Exports, track: any) {
  const root = ex.create_engine(), p = track.startPosition, v = track.riders[0].startVelocity;
  const handle = ex.set_start(root, p.x, p.y, v.x, v.y);
  ex.free_engine(root);
  return handle;
}
type Workload = 'register' | 'replay' | 'branches';
function run(ex: Exports, workload: Workload, verify = false) {
  const digest = createHash('sha256');
  let frames = 0;
  const observe = (h: number, f: number) => {
    const before = ex.get_last_frame_index(h);
    frames += Math.max(0, f - before);
    ex.get_state_map(h, f);
    if (verify) {
      digest.update(String(before));
      digest.update(new Uint8Array(ex.memory.buffer, ex.scratch_ptr(), 84 * 8));
      const count = ex.get_updates(h, f);
      digest.update(String(count));
      digest.update(new Uint8Array(ex.memory.buffer, ex.events_ptr(), count * 3 * 8));
      if (ex.get_contact_positions) {
        const contacts = ex.get_contact_positions(h, f, f);
        assert(contacts >= 0);
        digest.update(String(contacts));
        digest.update(new Uint8Array(ex.memory.buffer, ex.contact_positions_ptr(), contacts * 3 * 8));
      }
    }
  };
  for (const {track} of tracks) {
    let root = start(ex, track);
    if (workload !== 'branches') {
      root = add(ex, root, track.lines);
      ex.get_last_frame_index(root); // forces registration, even without stepping
      if (workload === 'replay') {
        if (verify) for (let f = 0; f <= track.duration; f++) observe(root, f);
        else observe(root, track.duration);
      }
    } else {
      // Sibling versions add real track suffixes; switching back forces removal,
      // invalidation, lazy history materialization, and re-simulation.
      const split = Math.min(100, track.lines.length);
      root = add(ex, root, track.lines.slice(0, split));
      observe(root, 120);
      for (let i = 0; i < 12; i++) {
        const branch = ex.add_line(root, 1000000 + i, i % 2, -50, 20 + i, 350, 40 + i, 0);
        const child = add(ex, branch, track.lines.slice(split, split + 100 + i * 20));
        observe(child, 180);
        if (verify) for (let f = 0; f <= 180; f++) observe(child, f);
        ex.free_engine(child);
        observe(root, 120);
      }
      // A detached prefix must not retain pointers into its source grid.
      const detached = ex.detach_engine(root);
      ex.free_engine(root);
      root = detached;
      observe(root, 200);
    }
    ex.free_engine(root);
  }
  return {frames, fingerprint: verify ? digest.digest('hex') : null};
}
const workloads: Workload[] = ['register', 'replay', 'branches'];
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
  inputs: tracks.map(({name}) => ({name, sha256: hash(readFileSync(resolve(directory, name)))})),
  protocol: {rounds, warmup, order: 'alternating, sequential', interval: '95% Student t on paired log wall-time ratios; fixed workloads, timing noise only'},
  verification, summary, samples};
writeFileSync(arg('out', '/tmp/line-engine-performance.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({verification, summary}, null, 2));
