/** Where a real compile spends its time or allocates.
 *
 *   npm run perf:profile -- [--cell=NAME] [--kind=cpu|allocation] [--top=40] [--warmup=0]
 *
 * The profile encloses exactly what perf:engine times: compileHandoff with
 * prepared inputs, default standard allowance, verified against the cell's
 * committed track and work. The raw profile is saved under generated/profile/
 * (open a .cpuprofile in Chrome DevTools). Native functions are named from an
 * unstripped build of the same source. Profiles show where to look; only paired
 * perf:engine runs establish a speedup. Inlined callees appear as their caller. */
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {Session} from 'node:inspector/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareCell} from '../parity/parity.ts';
import {cellIndices, PERF_CELLS} from './engine_decision.ts';

const arg = (key: string, fallback: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
if (process.argv.includes('--help')) {
  console.log('npm run perf:profile -- [--cell=NAME] [--kind=cpu|allocation] [--top=40] [--warmup=0]');
  process.exit(0);
}
const root = fileURLToPath(new URL('../../', import.meta.url));
const name = arg('cell', PERF_CELLS[0]), kind = arg('kind', 'cpu'), top = Number(arg('top', '40')), warmup = Number(arg('warmup', '0'));
if (kind !== 'cpu' && kind !== 'allocation') throw new Error('--kind must be cpu or allocation');
const index = cellIndices(JSON.parse(readFileSync(join(root, 'tools/parity/cells.json'), 'utf8')).cells, [name])[0];

type CallFrame = {functionName: string; url: string; lineNumber: number};
type CpuNode = {id: number; callFrame: CallFrame; children?: number[]};
type HeapNode = {callFrame: CallFrame; selfSize: number; children?: HeapNode[]};

/** _ZN9lr_engine6kernel10step_state17h…E → kernel::step_state */
function demangle(name: string) {
  const parts: string[] = [];
  if (name.startsWith('_ZN')) for (let at = 3; /\d/.test(name[at] ?? '');) {
    const digits = /^\d+/.exec(name.slice(at))![0], length = Number(digits);
    at += digits.length;
    parts.push(name.slice(at, at + length));
    at += length;
  }
  return parts.length ? parts.filter(p => p !== 'lr_engine' && !/^h[0-9a-f]{16}$/.test(p)).join('::').replaceAll('$LT$', '<').replaceAll('$GT$', '>').replaceAll('$C$', ',') : name;
}

/** Function indices of an unstripped build; identical code, separate target directory. */
function nativeNames(): Map<number, string> {
  const target = join(root, 'generated/native-motion-symbols');
  execFileSync('cargo', ['build', '--quiet', '--locked', '--release', '--target', 'wasm32-unknown-unknown',
    '--manifest-path', 'scripts/lib/native_motion/Cargo.toml', '--target-dir', target],
  {cwd: root, stdio: 'inherit', env: {...process.env, CARGO_PROFILE_RELEASE_STRIP: 'none'}});
  const bytes = readFileSync(join(target, 'wasm32-unknown-unknown/release/lr_engine.wasm')), names = new Map<number, string>();
  const leb = (at: number): [number, number] => {
    let value = 0, shift = 0;
    for (;;) {const byte = bytes[at++]; value += (byte & 127) * 2 ** shift; shift += 7; if (byte < 128) return [value, at];}
  };
  for (let at = 8; at < bytes.length;) {
    const id = bytes[at++];
    let size; [size, at] = leb(at);
    const end = at + size;
    if (id === 0) {
      let [length, p] = leb(at);
      if (bytes.toString('utf8', p, p + length) === 'name') for (p += length; p < end;) {
        const sub = bytes[p++];
        let span; [span, p] = leb(p);
        const next = p + span;
        if (sub === 1) {
          let count; [count, p] = leb(p);
          for (; count > 0; count--) {
            let fn; [fn, p] = leb(p);
            [length, p] = leb(p);
            names.set(fn, demangle(bytes.toString('utf8', p, p + length)));
            p += length;
          }
        }
        p = next;
      }
    }
    at = end;
  }
  return names;
}

const names = nativeNames();
const label = ({functionName, url, lineNumber}: CallFrame) => {
  const native = /^wasm-function\[(\d+)\]$/.exec(functionName);
  if (native) return `${names.get(Number(native[1])) ?? functionName} [native]`;
  return `${functionName || '(anonymous)'} ${url.split('/').at(-1)}${lineNumber >= 0 ? `:${lineNumber + 1}` : ''}`;
};
const show = (title: string, rows: Map<string, number>, total: number, unit: string, scale: number, count = top) => {
  console.log(`\n${title}`);
  for (const [name, value] of [...rows].sort((a, b) => b[1] - a[1]).slice(0, count))
    console.log(`${(value / scale).toFixed(unit === 'ms' ? 0 : 1).padStart(9)} ${unit} ${(100 * value / total).toFixed(1).padStart(5)}%  ${name}`);
};
const add = (rows: Map<string, number>, key: string, value: number) => rows.set(key, (rows.get(key) ?? 0) + value);

/** Where a profile node's own time belongs: a native module, a source file or the GC. */
function area({functionName, url}: CallFrame) {
  const native = /^wasm-function\[(\d+)\]$/.exec(functionName);
  if (native) {
    const name = names.get(Number(native[1])) ?? '';
    return {kind: 'native', file: /^[a-z_]+::/.test(name) ? `${name.split('::')[0]} [native]` : 'other [native]'};
  }
  if (functionName === '(garbage collector)') return {kind: 'GC', file: 'garbage collector'};
  return url ? {kind: 'JS', file: url.split('/').at(-1)!} : {kind: 'other', file: functionName || '(other)'};
}

function reportCpu(profile: {nodes: CpuNode[]; samples: number[]; timeDeltas: number[]}) {
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parents = new Map<number, number>(), own = new Map<number, number>();
  for (const node of profile.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
  profile.samples.forEach((id, i) => own.set(id, (own.get(id) ?? 0) + profile.timeDeltas[i]));
  const self = new Map<string, number>(), inclusive = new Map<string, number>(), kinds = new Map<string, number>(), files = new Map<string, number>();
  let total = 0;
  for (const [id, micros] of own) {
    total += micros;
    const frame = byId.get(id)!.callFrame, {kind, file} = area(frame);
    add(self, label(frame), micros);
    add(kinds, kind, micros);
    add(files, file, micros);
    const seen = new Set<string>();
    for (let at: number | undefined = id; at !== undefined; at = parents.get(at)) {
      const name = label(byId.get(at)!.callFrame);
      if (!seen.has(name)) {seen.add(name); add(inclusive, name, micros);}
    }
  }
  console.log(`\n${['native', 'JS', 'GC', 'other'].map(kind => `${kind} ${((kinds.get(kind) ?? 0) / 1e6).toFixed(1)} s`).join('  ')}`);
  show('By file', files, total, 'ms', 1e3, 15);
  show('Self time', self, total, 'ms', 1e3);
  show('Inclusive time', inclusive, total, 'ms', 1e3);
}

function reportAllocation(head: HeapNode) {
  const self = new Map<string, number>();
  const walk = (node: HeapNode) => {add(self, label(node.callFrame), node.selfSize); node.children?.forEach(walk);};
  walk(head);
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  console.log(`Allocated ${(total / 1e9).toFixed(2)} GB, sampled`);
  show('Allocation traffic', self, total, 'MB', 1e6);
}

const {cell, compile, exact} = await prepareCell(index), session = new Session();
session.connect();
for (let rep = 0; rep < warmup; rep++) compile();
if (kind === 'cpu') {
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', {interval: 500});
  await session.post('Profiler.start');
} else {
  await session.post('HeapProfiler.enable');
  await session.post('HeapProfiler.startSampling', {samplingInterval: 65536, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true});
}
const began = performance.now(), checkpoint = compile(), ms = performance.now() - began;
const {profile} = await session.post(kind === 'cpu' ? 'Profiler.stop' : 'HeapProfiler.stopSampling') as unknown as {profile: any};
session.disconnect();
if (!exact(checkpoint)) throw new Error(`${name}: track or charged work differs from its parity record`);
const directory = resolve(root, 'generated/profile'), path = join(directory, `${name.replace(/\W+/g, '-')}.${kind === 'cpu' ? 'cpuprofile' : 'heapprofile'}`);
mkdirSync(directory, {recursive: true});
writeFileSync(path, JSON.stringify(profile));
console.log(`${name}: ${(ms / 1000).toFixed(2)} s, ${cell.physicalFrames} charged frames, exact; profiler overhead included\n${path}`);
if (kind === 'cpu') reportCpu(profile); else reportAllocation(profile.head);
