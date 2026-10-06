/** Paired automatic-construction audit of the complete disjoint collection catalog.
 * Both compilers receive identical frozen authoring; one current cold evaluator
 * measures every saved track under all existing rulers. Large outputs stay local. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';

const out = '/tmp/line-quality-catalog-panel-20261006';
const roots = {baseline: '/tmp/line-quality-catalog-baseline-20261006', candidate: '/tmp/line-quality-final-candidate-20261006'};
const moduleAt = (root: string, file: string) => import(pathToFileURL(join(root, file)).href);
const digest = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const collector = JSON.parse(readFileSync('/tmp/line-quality-current-value-20261006/generated/value-current/collect/plan.json', 'utf8'));
const study = digest(readFileSync(import.meta.filename, 'utf8'));
const identity = async (root: string) => (await moduleAt(root, 'scripts/lib/compiler_identity.ts')).compilerIdentity(root);
const evaluator = await moduleAt(roots.candidate, 'tools/eval/inputs.ts');
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value));

if (process.argv[2] === 'worker') {
  const label = process.argv[3] as keyof typeof roots, index = Number(process.argv[4]), root = roots[label];
  const plan = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8')), w = plan.work[index];
  assert.equal(plan.study, study); assert.deepEqual(await identity(root), plan.identities[label]);
  assert.equal(evaluator.evaluatorIdentity(roots.candidate), plan.evaluator);
  const {loadCases, caseSpec} = await moduleAt(root, 'benchmark/v4/model.ts');
  const source = loadCases().find((c: any) => c.id === w.id);
  assert.equal(digest(source), w.inputSha256);
  const spec = caseSpec(source), {compileHandoff} = await moduleAt(root, 'scripts/v0/optimizer/handoff.ts');
  const {productionBudget} = await moduleAt(root, 'scripts/v0/optimizer/production_budget.ts');
  const start = performance.now(), cpu = process.cpuUsage();
  const cp = compileHandoff(spec, w.seed, {budget: productionBudget(spec.duration), creative: {}, impactContract: 'line.strike.v3',
    phraseBoundaries: source.phases.map((p: any) => p.start).filter(Number.isFinite)});
  const compileMs = performance.now() - start, used = process.cpuUsage(cpu), maxRssKiB = process.resourceUsage().maxRSS;
  assert.ok(cp.track.lines.every((l: any) => l.type === 0));
  const {measureCell} = await moduleAt(roots.candidate, 'tools/eval/measure.ts');
  const c = {id: `${w.id}~${w.seed}`, song: source.group, seed: w.seed, perturbation: null};
  const cell = measureCell({c, mode: 'strike3', track: cp.track, spec, music: source,
    physicalFrames: cp.repertoire.physicalFrames, compileMs, complete: cp.repertoire.valid,
    fulfilled: cp.repertoire.qualified, motion: cp.repertoire.motion.full});
  assert.deepEqual(await identity(root), plan.identities[label]);
  assert.equal(evaluator.evaluatorIdentity(roots.candidate), plan.evaluator);
  const record = {planSha256: digest(plan), inputSha256: w.inputSha256, sourceId: w.id, group: source.group,
    trackHash: digest(cp.track), work: cp.work, failure: cp.repertoire.result.failure,
    layoutFulfilled: cp.repertoire.realization.fulfilled, requested: cp.repertoire.plan.requests.length, constructed: cp.repertoire.result.rows.length,
    cpuMs: (used.user + used.system) / 1000, maxRssKiB, ...cell};
  writeFileSync(join(out, label, `${c.id}.checkpoint.json.gz`), gzipSync(JSON.stringify(cp)));
  write(join(out, label, `${c.id}.json`), record);
} else {
  mkdirSync(out, {recursive: true});
  const release = lockArtifacts(out);
  try {
    const plan = {schema: 'line.quality-catalog-panel.v1', study, sourceCollectionPlanSha256: digest(collector), roots,
      identities: Object.fromEntries(await Promise.all(Object.entries(roots).map(async ([k, r]) => [k, await identity(r)]))),
      evaluator: evaluator.evaluatorIdentity(roots.candidate), work: collector.work,
      hypothesis: 'Assess the coherent candidate across all 336 declared catalog compiles, including failure recovery. Same authored geometry policy, inputs, nominal production allowance and all unchanged rulers. These are training-catalog robustness results, not held-out musical generalization. Completion is separate from quality; aggregate by the 15 source groups, never by treating correlated seeds as independent songs.'};
    const file = join(out, 'plan.json');
    if (existsSync(file)) assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), plan); else write(file, plan);
    for (const label of Object.keys(roots)) mkdirSync(join(out, label), {recursive: true});
    const queue = plan.work.map((w: any, i: number) => ({w, i}));
    let done = 0;
    const failures: string[] = [];
    await Promise.all(Array.from({length: 4}, async () => {
      while (queue.length) {
        const {w, i} = queue.shift()!;
        await Promise.all(Object.entries(roots).map(async ([label, root]) => {
          const path = join(out, label, `${w.id}~${w.seed}.json`);
          if (existsSync(path)) {assert.equal(JSON.parse(readFileSync(path, 'utf8')).planSha256, digest(plan)); return;}
          try {
            await new Promise<void>((ok, fail) => {
              const p = spawn(process.execPath, ['--max-old-space-size=4096', '--import', 'tsx', import.meta.filename, 'worker', label, String(i)],
                {cwd: root, stdio: ['ignore', 'ignore', 'inherit']});
              p.once('error', fail); p.once('exit', (code, signal) => code === 0 ? ok() : fail(Error(String(code ?? signal))));
            });
          } catch (e) {failures.push(`${label}/${w.id}~${w.seed}: ${e}`);}
        }));
        console.log(`${++done}/${plan.work.length} pairs ${w.id}~${w.seed}`);
      }
    }));
    assert.deepEqual(failures, [], 'worker failures; preserve plan and resume');
    console.log('Complete paired catalog; saved full checkpoints and every ruler');
  } finally {release();}
}
