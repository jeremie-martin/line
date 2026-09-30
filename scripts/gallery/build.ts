/** Generate replayable, matched geometry evidence. Raw tracks and traces stay local. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, existsSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {galleryCases} from './cases.ts';
import {galleryActiveMethods, galleryMethodDetails, galleryArcOptions, type GalleryMethod} from './methods.ts';
import {caseSpec, sha} from '../../benchmark/v3/model.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
import {galleryCompilerIdentity,galleryHarnessIdentity,writeGalleryJson,replayGalleryTrack} from './artifacts.ts';

const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const out = resolve(arg('out') ?? 'generated/motion-gallery/20260930-functional-rails');
const compilerRoot = resolve(arg('compiler-root') ?? '.');
const budgets = (arg('budgets') ?? '100000,250000').split(',').map(Number);
const seeds = (arg('seeds') ?? '201,202').split(',').map(Number);
const methodDetails = galleryMethodDetails;
const methods = (arg('methods') ?? galleryActiveMethods.join(',')).split(',') as GalleryMethod[];
assert.ok(methods.length > 0 && new Set(methods).size === methods.length && methods.every(m => Object.hasOwn(methodDetails,m)));
const jitter = Number(arg('jitter') ?? .02);
assert.ok(budgets.every(b => Number.isSafeInteger(b) && b > 1000) && seeds.every(Number.isSafeInteger));
assert.ok(new Set(budgets).size === budgets.length && new Set(seeds).size === seeds.length);
assert.ok(Number.isFinite(jitter) && jitter >= 0 && jitter < 1);
const identity = () => galleryCompilerIdentity(compilerRoot);
const harness = () => galleryHarnessIdentity(['scripts/gallery/build.ts','scripts/gallery/artifacts.ts','scripts/gallery/cases.ts','scripts/gallery/methods.ts']);
const plan = {schema: 'line.motion-gallery-plan.v1', researchOnly: true, compilerRoot, compiler: identity(),
  judge: verifyFrozen(), harness: harness(), cases: galleryCases, budgets, seeds, jitter,
  methods, methodDetails, observer: Object.fromEntries(execFileSync('git', ['ls-files', 'vendor/lr-core'], {cwd: compilerRoot, encoding: 'utf8'}).trim().split('\n').map(p => [p, sha(readFileSync(resolve(compilerRoot,p)))])), note: 'Matched geometry research. Single rails are independently searched with guides disabled during every candidate simulation. Paired rails retain complete guides; ordinary arcs trim unused guide sections after replay. Shapes are constructed before physics search. Matched short passages, not a benchmark headline. Improved scattered construction compares two normal-segment methods; its choice and all work are recorded. No arc track is substituted for scattered geometry. Wall times include lazy model loading; first cell is cold, later cells reuse the process.'};
mkdirSync(out, {recursive: true});
const write = (name:string,value:unknown) => writeGalleryJson(out,name,value);
if (existsSync(resolve(out, 'plan.json'))) assert.deepEqual(JSON.parse(readFileSync(resolve(out, 'plan.json'), 'utf8')), plan);
else write('plan.json', plan);
const planSha256 = sha(readFileSync(resolve(out, 'plan.json')));
const {compileArcMotion} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/v0/optimizer/arc_motion.ts')).href);
const {connectedArcOptions} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/v0/optimizer/connected_arcs.ts')).href);
const {compileNormalMotion} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/v0/optimizer/normal_motion.ts')).href);
const {compileScatteredMotion} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/v0/optimizer/normal_contacts.ts')).href);
const {getPhysicsFrameCount} = await import(pathToFileURL(resolve(compilerRoot, 'scripts/lib/detector.ts')).href);
const cells: any[] = [];
let compileCalls = 0;
for (const c of galleryCases) for (const budget of budgets) for (const seed of seeds) for (const method of plan.methods) {
  const id = `${c.id}-${method}-${budget}-${seed}`, path = `${id}.json`;
  // Restarting re-runs compilation deliberately: cached timings cannot be mixed
  // with a differently warmed process while claiming one matched timing study.
  const spec = {...caseSpec(c), jitter};
  const started = performance.now();
  const overrides = galleryArcOptions(method);
  const options = overrides ? {...connectedArcOptions(spec, budget), ...overrides} : undefined;
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
  const {grade,trace}=replayGalleryTrack(result.track,c);
  const cell = {id, caseId: c.id, method, railLayout:methodDetails[method].railLayout, seed, jitter, budget, score: grade.score, compileMs,
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
