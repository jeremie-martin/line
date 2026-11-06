// Reachability guard: which tracked code files can the product actually reach?
//
//   node tools/deps/reach.mjs              # summary + unreachable files
//   node tools/deps/reach.mjs --tests      # also classify tests
//
// Entry points are declared in tools/deps/entries.json. Edges, from the syntax tree:
// imports, literal dynamic imports, new URL(..., import.meta.url), and string
// literals naming a tracked script (spawned children). A file reached only for
// its types stays, but keeps nothing else alive. Anything unreachable is a
// candidate for deletion; a test is live only if everything it imports is live.
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname, resolve, relative, join} from 'node:path';
import {createRequire} from 'node:module';

const ROOT = resolve(import.meta.dirname, '../..');
const ts = createRequire(join(ROOT, 'package.json'))('typescript');
const tracked = execSync('git ls-files', {cwd: ROOT, maxBuffer: 1 << 28}).toString().split('\n').filter(Boolean);
const CODE = /\.(ts|mts|mjs|js|cjs)$/;
const files = tracked.filter(f => CODE.test(f) && !/^(node_modules|remotion\/node_modules)\//.test(f));
const fileSet = new Set(tracked.filter(f => CODE.test(f)));
const tryResolve = base => [base, base + '.ts', base + '.mts', base + '.mjs', base + '.js', base + '/index.ts', base + '/index.js',
  ...(base.endsWith('.js') ? [base.slice(0, -3) + '.ts'] : [])].find(c => fileSet.has(c)) ?? null;
const resolveSpec = (spec, from) => spec.startsWith('.') || spec.startsWith('/')
  ? tryResolve(relative(ROOT, spec.startsWith('/') ? spec : resolve(ROOT, dirname(from), spec))) : null;

const isTest = f => f.startsWith('tests/');
const graph = {}, typeGraph = {}, lines = {};
const importsOnlyTypes = clause => !!clause && (clause.isTypeOnly || clause.phaseModifier === ts.SyntaxKind.TypeKeyword ||
  !clause.name && !!clause.namedBindings && ts.isNamedImports(clause.namedBindings) &&
  clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every(e => e.isTypeOnly));
const exportsOnlyTypes = node => node.isTypeOnly || node.exportClause && ts.isNamedExports(node.exportClause) &&
  node.exportClause.elements.length > 0 && node.exportClause.elements.every(e => e.isTypeOnly);
/** Real syntax, not tokens: comments create no edges, and an import that names only
 * types keeps its target available without keeping that target's own imports alive. */
function edges(f, src) {
  const runtime = new Set(), types = new Set(), kind = f.endsWith('.ts') || f.endsWith('.mts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const add = (set, spec) => {const r = resolveSpec(spec, f); if (r) set.add(r);};
  const visit = node => {
    // A module specifier is not a string naming a script: stop at these nodes.
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
      return add(importsOnlyTypes(node.importClause) ? types : runtime, node.moduleSpecifier.text);
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
      return add(exportsOnlyTypes(node) ? types : runtime, node.moduleSpecifier.text);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal))
      return add(types, node.argument.literal.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteralLike(node.arguments[0]))
      add(runtime, node.arguments[0].text);
    else if (ts.isNewExpression(node) && node.expression.getText() === 'URL' && node.arguments?.[0] && ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[1]?.getText() === 'import.meta.url') add(runtime, node.arguments[0].text.split('?')[0]);
    else if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node)) {
      // A string naming a tracked script: a spawned child.
      for (const m of node.text.matchAll(/([A-Za-z0-9_./-]+\.(?:ts|mts|mjs|js))(?![A-Za-z0-9])/g)) {
        const bare = m[1].replace(/^\.\//, '');
        const r = resolveSpec(m[1].startsWith('.') ? m[1] : './' + m[1], f) ?? (fileSet.has(bare) ? bare : null);
        if (r && r !== f && (isTest(f) || !isTest(r))) runtime.add(r);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, kind));
  return {runtime, types};
}
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8'), {runtime, types} = edges(f, src);
  lines[f] = src.split('\n').length;
  graph[f] = [...runtime];
  typeGraph[f] = [...types].filter(t => !runtime.has(t));
}
const closure = entries => {
  const seen = new Set(), stack = [...entries];
  while (stack.length) {const f = stack.pop(); if (seen.has(f)) continue; seen.add(f); for (const t of graph[f] ?? []) stack.push(t);}
  return seen;
};
const glob = p => {const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*') + '$');
  return files.filter(f => re.test(f));};
const declared = JSON.parse(readFileSync(join(ROOT, 'tools/deps/entries.json'), 'utf8'));
const entries = declared.entries.flatMap(glob), assets = new Set((declared.assets ?? []).flatMap(glob));
const live = closure(entries);
// Declarations a live file names; erased at runtime, so their own imports do not count.
const typesOnly = new Set(), pending = [...live];
while (pending.length) for (const t of typeGraph[pending.pop()] ?? []) if (!live.has(t) && !typesOnly.has(t)) {typesOnly.add(t); pending.push(t);}
const sum = list => list.reduce((n, f) => n + (lines[f] ?? 0), 0);
const code = files.filter(f => !isTest(f));
const dead = code.filter(f => !live.has(f) && !typesOnly.has(f) && !assets.has(f));
console.log(`entries ${entries.length}  live ${code.filter(f => live.has(f)).length} files / ${sum(code.filter(f => live.has(f)))} lines  ` +
  `types only ${typesOnly.size}  unreachable ${dead.length} files / ${sum(dead)} lines`);
if (process.argv.includes('--list')) {
  for (const f of dead) console.log('dead  ' + f);
  for (const f of typesOnly) console.log('types ' + f);
}
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
if (dead.length) process.exitCode = 1;
