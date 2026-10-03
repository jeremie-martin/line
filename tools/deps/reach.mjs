// Reachability guard: which tracked code files can the product actually reach?
//
//   node tools/deps/reach.mjs              # summary + unreachable files
//   node tools/deps/reach.mjs --tests      # also classify tests
//
// Entry points are declared in tools/deps/entries.json. Edges: static imports,
// literal dynamic imports, new URL(..., import.meta.url), and string literals
// naming a tracked script (spawned children). Anything unreachable is a
// candidate for deletion; a test is live only if everything it imports is live.
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname, resolve, relative, join} from 'node:path';
import {createRequire} from 'node:module';

const ROOT = resolve(import.meta.dirname, '../..');
const ts = createRequire(join(ROOT, 'package.json'))('typescript');
const tracked = execSync('git ls-files', {cwd: ROOT, maxBuffer: 1 << 28}).toString().split('\n').filter(Boolean);
const CODE = /\.(ts|mts|mjs|js|cjs)$/;
const files = tracked.filter(f => CODE.test(f) && !/^(node_modules|vendor|remotion\/node_modules)\//.test(f));
const fileSet = new Set(tracked.filter(f => CODE.test(f)));
const tryResolve = base => [base, base + '.ts', base + '.mts', base + '.mjs', base + '.js', base + '/index.ts', base + '/index.js',
  ...(base.endsWith('.js') ? [base.slice(0, -3) + '.ts'] : [])].find(c => fileSet.has(c)) ?? null;
const resolveSpec = (spec, from) => spec.startsWith('.') || spec.startsWith('/')
  ? tryResolve(relative(ROOT, spec.startsWith('/') ? spec : resolve(ROOT, dirname(from), spec))) : null;

const isTest = f => f.startsWith('tests/');
const graph = {}, lines = {};
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8'), out = new Set();
  lines[f] = src.split('\n').length;
  for (const imp of ts.preProcessFile(src, true, true).importedFiles) {const r = resolveSpec(imp.fileName, f); if (r) out.add(r);}
  for (const re of [/import\(\s*["'`]([^"'`]+)["'`]/g, /new URL\(\s*["'`]([^"'`?]+)[^"'`]*["'`]\s*,\s*import\.meta\.url/g])
    for (const m of src.matchAll(re)) {const r = resolveSpec(m[1], f); if (r) out.add(r);}
  // String literals only (comments are skipped by the scanner), naming a tracked script.
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, src);
  for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) {
    if (k === ts.SyntaxKind.SlashToken || k === ts.SyntaxKind.SlashEqualsToken) {try {scanner.reScanSlashToken();} catch {}}
    if (k !== ts.SyntaxKind.StringLiteral && k !== ts.SyntaxKind.NoSubstitutionTemplateLiteral && k !== ts.SyntaxKind.TemplateHead) continue;
    for (const m of scanner.getTokenValue().matchAll(/([A-Za-z0-9_./-]+\.(?:ts|mts|mjs|js))(?![A-Za-z0-9])/g)) {
      const bare = m[1].replace(/^\.\//, '');
      const r = resolveSpec(m[1].startsWith('.') ? m[1] : './' + m[1], f) ?? (fileSet.has(bare) ? bare : null);
      if (r && r !== f && (isTest(f) || !isTest(r))) out.add(r);
    }
  }
  graph[f] = [...out];
}
const closure = entries => {
  const seen = new Set(), stack = [...entries];
  while (stack.length) {const f = stack.pop(); if (seen.has(f)) continue; seen.add(f); for (const t of graph[f] ?? []) stack.push(t);}
  return seen;
};
const glob = p => {const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*') + '$');
  return files.filter(f => re.test(f));};
const entries = JSON.parse(readFileSync(join(ROOT, 'tools/deps/entries.json'), 'utf8')).entries.flatMap(glob);
const live = closure(entries);
const sum = list => list.reduce((n, f) => n + (lines[f] ?? 0), 0);
const code = files.filter(f => !isTest(f));
const dead = code.filter(f => !live.has(f));
console.log(`entries ${entries.length}  live ${code.filter(f => live.has(f)).length} files / ${sum(code.filter(f => live.has(f)))} lines  ` +
  `unreachable ${dead.length} files / ${sum(dead)} lines`);
if (process.argv.includes('--list')) for (const f of dead) console.log('dead  ' + f);
if (process.argv.includes('--tests')) {
  for (const t of files.filter(f => isTest(f) && /\.test\.ts$/.test(f))) {
    const reach = [...closure([t])].filter(f => !isTest(f));
    const bad = reach.filter(f => !live.has(f));
    console.log(`${bad.length ? 'dead-test' : 'live-test'}  ${t}${bad.length ? '  (' + bad.slice(0, 3).join(', ') + ')' : ''}`);
  }
}
if (process.argv.includes('--live')) for (const f of code.filter(f => live.has(f))) console.log(`live  ${String(lines[f]).padStart(6)}  ${f}`);
const why = process.argv.find(a => a.startsWith('--why='))?.slice(6);
if (why) {
  const parent = new Map(entries.map(e => [e, null])), queue = [...entries];
  while (queue.length) {const f = queue.shift(); for (const t of graph[f] ?? []) if (!parent.has(t)) {parent.set(t, f); queue.push(t);}}
  const path = []; for (let f = why; f; f = parent.get(f)) path.unshift(f);
  console.log(parent.has(why) ? path.join('\n  <- '.replace('<-', '->')) : `${why} is unreachable`);
}
