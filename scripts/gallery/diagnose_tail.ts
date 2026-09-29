/** Replay a gallery segment-controller case with its existing diagnostic hook. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {caseSpec, sha} from '../../benchmark/v3/model.ts';
const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const root = resolve(arg('compiler-root') ?? '.'), gallery = resolve(arg('gallery') ?? 'generated/motion-gallery/20260929');
const read = (path: string) => {const bytes = readFileSync(path); assert.equal(sha(bytes), readFileSync(path+'.sha256','utf8').trim()); return JSON.parse(bytes.toString());};
const manifest = read(resolve(gallery, 'manifest.json')), caseId = arg('case') ?? 'quiet-tail', budget = Number(arg('budget') ?? 100000);
const identity = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
  'import {compilerCandidateIdentity} from "./scripts/v0/benchmark_v2/compiler_identity.ts"; console.log(JSON.stringify(compilerCandidateIdentity("wasm")));'],
  {cwd: root, encoding: 'utf8', maxBuffer: 16*1024*1024}));
assert.equal(identity.candidateFingerprint, manifest.plan.compiler.candidateFingerprint, 'use the gallery compiler');
const {compileNormalMotion} = await import(pathToFileURL(resolve(root, 'scripts/v0/optimizer/normal_motion.ts')).href);
const c = manifest.plan.cases.find((c: any) => c.id === caseId); assert.ok(c);
const rows = manifest.cells.filter((r: any) => r.caseId === caseId && r.method === 'segments' && r.budget === budget).map((cell: any) => {
  const diagnostics: any[] = [];
  const result = compileNormalMotion({...caseSpec(c), jitter: cell.jitter}, cell.seed, {budget,
    onDiagnostic: (value: any) => diagnostics.push({failure: value.failure, terminalContinuationAcceptedAt: value.terminalContinuationAcceptedAt})});
  const trackHash = sha(JSON.stringify(result.track)); assert.equal(trackHash, cell.trackHash);
  assert.equal(result.stats.sim_frames, cell.physicalFrames);
  return {seed: cell.seed, budget, trackHash, physicalFrames: result.stats.sim_frames, score: cell.score, diagnostics,
    lastContactFrame: c.contacts.at(-1).frame, durationFrames: c.durationFrames, tail: cell.observations.filter((o: any) => o.tail)};
});
assert.ok(rows.length);
const record = {schema: 'line.normal-terminal-probe.v1', compiler: manifest.plan.compiler,
  harnessSha256: sha(readFileSync(import.meta.filename)), manifestSha256: sha(readFileSync(resolve(gallery, 'manifest.json'))), caseId, rows};
const body = JSON.stringify(record)+'\n', path = resolve(gallery, 'terminal-probe.json');
writeFileSync(path, body); writeFileSync(path+'.sha256', sha(body)+'\n');
console.log(JSON.stringify(rows.map((r: any) => ({seed: r.seed, score: r.score.score, diagnostics: r.diagnostics}))));
