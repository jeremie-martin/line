/** Generate replayable, matched geometry evidence. Raw tracks and traces stay local. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {galleryCases} from './cases.ts';
import {caseSpec, sha} from '../../benchmark/v3/model.ts';
import {evaluateDetection} from '../../benchmark/v4/evaluator.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
import {detect, extractRawTrajectory} from '../lib/detector.ts';

const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const out = resolve(arg('out') ?? 'generated/motion-gallery/20260929-expanded');
const compilerRoot = resolve(arg('compiler-root') ?? '.');
const budgets = (arg('budgets') ?? '25000,100000,750000').split(',').map(Number);
const seeds = (arg('seeds') ?? '101,102').split(',').map(Number);
const methodDetails = {
  arcs: {title: 'Arcs and guides', description: 'Smooth connected support curves with optional guides.'},
  segments: {title: 'Scattered · original', description: 'The original velocity-feedback controller.'},
  scattered: {title: 'Scattered · improved', description: 'Keeps the original scattered ride, then tests fragments of a measured reference ride using the remaining allowance.'},
  waves: {title: 'Wave curves', description: 'A returning bend followed by an independently shaped exit. Revives the existing wave geometry in measured search.'},
  facets: {title: 'Faceted curves', description: 'Long straight faces, searched and replayed with their actual angular geometry.'},
};
const methods = (arg('methods') ?? 'arcs,segments,scattered,waves,facets').split(',') as Array<keyof typeof methodDetails>;
assert.ok(methods.length > 0 && new Set(methods).size === methods.length && methods.every(m => m in methodDetails));
const jitter = Number(arg('jitter') ?? .02);
assert.ok(budgets.every(b => Number.isSafeInteger(b) && b > 1000) && seeds.every(Number.isSafeInteger));
assert.ok(new Set(budgets).size === budgets.length && new Set(seeds).size === seeds.length);
assert.ok(Number.isFinite(jitter) && jitter >= 0 && jitter < 1);
const identity = () => JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
  'import {compilerCandidateIdentity} from "./scripts/v0/benchmark_v2/compiler_identity.ts"; const {trackedChanges,...identity}=compilerCandidateIdentity("wasm"); console.log(JSON.stringify(identity));'],
  {cwd: compilerRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024}));
const harness = () => Object.fromEntries(['scripts/gallery/build.ts', 'scripts/gallery/cases.ts'].map(p => [p, sha(readFileSync(p))]));
const plan = {schema: 'line.motion-gallery-plan.v1', researchOnly: true, compilerRoot, compiler: identity(),
  judge: verifyFrozen(), harness: harness(), cases: galleryCases, budgets, seeds, jitter,
  methods, methodDetails, observer: Object.fromEntries(execFileSync('git', ['ls-files', 'vendor/lr-core'], {cwd: compilerRoot, encoding: 'utf8'}).trim().split('\n').map(p => [p, sha(readFileSync(resolve(compilerRoot,p)))])), note: 'Matched short passages, not a benchmark headline. Improved scattered construction compares two normal-segment methods; its choice and all work are recorded. No arc track is substituted for scattered geometry. Wall times include lazy model loading; first cell is cold, later cells reuse the process.'};
mkdirSync(out, {recursive: true});
const write = (name: string, value: unknown) => {
  const body = JSON.stringify(value) + '\n'; writeFileSync(resolve(out, name), body);
  writeFileSync(resolve(out, name + '.sha256'), sha(body) + '\n'); return sha(body);
};
if (existsSync(resolve(out, 'plan.json'))) assert.deepEqual(JSON.parse(readFileSync(resolve(out, 'plan.json'), 'utf8')), plan);
else write('plan.json', plan);
const planSha256 = sha(readFileSync(resolve(out, 'plan.json')));
const {compileArcMotion} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/v0/optimizer/arc_motion.ts')).href);
const {connectedArcOptions} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/v0/optimizer/connected_arcs.ts')).href);
const {compileNormalMotion} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/v0/optimizer/normal_motion.ts')).href);
const {compileScatteredMotion} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/v0/optimizer/normal_contacts.ts')).href);
const {getPhysicsFrameCount} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/lib/detector.ts')).href);
const {LineRiderEngine: Engine, disposeAllWasmEnginesForStudy: dispose} =
  await import(new URL('../lib/_lr_engine_wasm.ts?motion-gallery-replay', import.meta.url).href);
const pointIds = ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
const cells: any[] = [];
let compileCalls = 0;
for (const c of galleryCases) for (const budget of budgets) for (const seed of seeds) for (const method of plan.methods) {
  const id = `${c.id}-${method}-${budget}-${seed}`, path = `${id}.json`;
  // Restarting re-runs compilation deliberately: cached timings cannot be mixed
  // with a differently warmed process while claiming one matched timing study.
  const spec = {...caseSpec(c), jitter};
  const started = performance.now();
  const options = ['arcs','waves','facets'].includes(method) ? {...connectedArcOptions(spec, budget),
    ...(method === 'waves' ? {wave: true, policyPreview: false} : {}),
    ...(method === 'facets' ? {subdivisions: .5, policyPreview: false} : {})} : undefined;
  const result = options ? compileArcMotion(spec, seed, options) : method === 'scattered' ? compileScatteredMotion(spec, seed, {budget}) : compileNormalMotion(spec, seed, {budget});
  const compileMs = performance.now() - started, physicalFrames = result.stats.sim_frames;
  if (result.work) {
    assert.equal(result.work.feedback + result.work.reconstruction, physicalFrames);
    assert.equal(result.work.lastMeter, getPhysicsFrameCount());
    assert.equal(result.work.reconstruction || result.work.feedback, getPhysicsFrameCount());
  } else assert.equal(physicalFrames, getPhysicsFrameCount());
  assert.ok(physicalFrames <= budget);
  assert.ok(result.track.lines.every((l: any) => l.type === 0));
  const trackHash = sha(JSON.stringify(result.track));
  const replayStart = performance.now();
  let grade: ReturnType<typeof evaluateDetection>, trace: any;
  try {
    const engine = new Engine().setStart(result.track.startPosition, result.track.riders[0].startVelocity).addLine(result.track.lines);
    const det = detect(extractRawTrajectory(engine, c.durationFrames + 20));
    grade = evaluateDetection(c, det);
    const frames = Array.from({length: Math.min(c.durationFrames + 20, det.terminus.frame) + 1}, (_, frame) => {
      const state = engine.getRider(frame).ballisticState();
      return pointIds.flatMap(id => [state.points[id].x, state.points[id].y]);
    });
    trace = {fps: 40, pointIds, frames, terminus: det.terminus};
  } finally { dispose(); }
  const cell = {id, caseId: c.id, method, seed, jitter, budget, score: grade.score, compileMs,
    processCompileCall: ++compileCalls, construction: result.construction ?? null, work: result.work ?? null,
    usesPolicy: Boolean(options?.controlPolicy), replayMs: performance.now() - replayStart, physicalFrames,
    lines: result.track.lines.length, trackHash, attempts: result.attempts ?? null, proposalDecision: result.proposalDecision ?? null,
    observations: grade.observations, contacts: grade.contacts, offBeat: grade.offBeat,
    failure: result.failure ?? null, terminus: grade.terminus};
  const digest = write(path, {schema: 'line.motion-gallery-cell.v1', planSha256, ...cell, case: c, track: result.track, trace});
  cells.push({...cell, path, sha256: digest});
  console.log(JSON.stringify({id, valid: grade.score.valid, score: grade.score.score, physicalFrames, compileMs: Math.round(compileMs)}));
}
assert.deepEqual(identity(), plan.compiler, 'compiler changed during gallery study');
assert.deepEqual(harness(), plan.harness, 'gallery harness changed during study');
assert.deepEqual(verifyFrozen(), plan.judge);
for (const [p,digest] of Object.entries(plan.observer)) assert.equal(sha(readFileSync(resolve(compilerRoot,p))),digest,'observer changed during study');
const summary = plan.methods.flatMap(method => budgets.map(budget => {
  const rows = cells.filter(c => c.method === method && c.budget === budget);
  return {method, budget, runs: rows.length, valid: rows.filter(r => r.score.valid).length,
    meanScore: rows.reduce((s, r) => s + r.score.score, 0) / rows.length,
    totalPhysicalFrames: rows.reduce((s, r) => s + r.physicalFrames, 0),
    totalCompileMs: rows.reduce((s, r) => s + r.compileMs, 0),
    distinctTracks: new Set(rows.map(r => r.trackHash)).size};
}));
write('manifest.json', {schema: 'line.motion-gallery.v1', planSha256, plan, summary, cells});
console.log(JSON.stringify({complete: true, out: relative(process.cwd(), out), summary}));
