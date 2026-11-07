/** The complete structural gate, one line per step. Stops at the first failure and
 * shows the end of its log; every log is kept in generated/check/.
 *
 *   npm run check */
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)), logs = join(root, 'generated/check');
const STEPS: [string, string][] = [
  ['typecheck', 'npm run typecheck'],
  ['reach', 'npm run reach'],
  ['test', 'npm test'],
  ['rust', 'cargo test --locked --manifest-path scripts/lib/native_motion/Cargo.toml --target-dir generated/native-motion-tests'],
  ['physics', 'npm run check:physics'],
  ['engine', 'npm run verify:engine'],
  ['parity', 'npm run parity'],
  ['judge', 'npm run parity:judge'],
  ['smoke', 'npm run check:smoke'],
];

const wanted = Number(/\d+/.exec(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).engines.node)![0]);
if (Number(process.versions.node.split('.')[0]) < wanted) {
  console.error(`FAIL  Node ${process.version}: this repository needs Node ${wanted} or newer (.nvmrc)`);
  process.exit(1);
}
rmSync(logs, {recursive: true, force: true});
mkdirSync(logs, {recursive: true});
const began = performance.now();
for (const [name, command] of STEPS) {
  const start = performance.now();
  const run = spawnSync(command, {cwd: root, shell: true, encoding: 'utf8', maxBuffer: 2 ** 28});
  const log = (run.stdout ?? '') + (run.stderr ?? ''), lines = log.trimEnd().split('\n');
  writeFileSync(join(logs, `${name}.log`), log);
  const seconds = ((performance.now() - start) / 1000).toFixed(0).padStart(4);
  if (run.status !== 0) {
    console.log(`FAIL  ${name.padEnd(10)}${seconds} s  generated/check/${name}.log\n\n${lines.slice(-25).join('\n')}`);
    process.exit(1);
  }
  // The step's own verdict, such as "Tests 402 passed", when it prints one.
  const summary = lines.findLast(line => /\b(PASS|passed|ok|unreachable)\b/.test(line))?.trim() ?? '';
  console.log(`PASS  ${name.padEnd(10)}${seconds} s  ${summary}`.trimEnd());
}
console.log(`\nall checks passed in ${((performance.now() - began) / 60000).toFixed(1)} min`);
