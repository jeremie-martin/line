/** Explicit evidence migration / remeasurement, never an implicit cache shim.
 * Reads an immutable source run and writes a fresh directory. Compiler identity,
 * tracks, work and construction fulfillment remain historical; observations
 * carry the current evaluator identity. --jolt-ms is mandatory for old evidence.
 *
 * node --import tsx tools/eval/remeasure.ts --from=OLD --name=NEW --jolt-ms=-15 */
import assert from 'node:assert/strict';
import {mkdirSync, existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {resolveCase, digest, evaluatorIdentity} from './inputs.ts';
import {readJson, readTrack, saveCell, atomicWrite, loadRun, runDir, type RunPlan} from './records.ts';
import {measureCell} from './measure.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const from = arg('from'), name = arg('name'), joltArg = arg('jolt-ms');
assert.ok(from && name && joltArg !== undefined, '--from, --name and --jolt-ms are required');
const source = runDir(from), out = runDir(name), jolt = Number(joltArg);
assert.ok(Number.isFinite(jolt)); assert.ok(!existsSync(out), 'remeasure into a fresh directory; preserve the original evidence');
const old = readJson(join(source, 'run.json')), ids = old.panel.map((c: any) => c.id).sort();
assert.deepEqual(readdirSync(join(source, 'cells')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort(), ids, 'incomplete source run');
assert.equal(new Set(ids).size, ids.length, 'duplicate source cases');
const inputs = await Promise.all(old.panel.map((c: any) => resolveCase(c, jolt)));
const plan: RunPlan = {schema: 'line.eval.v2', identity: old.identity, evaluator: evaluatorIdentity(), jolt,
  mode: old.mode, budget: old.budget, panelName: old.panelName ?? 'dev', panel: inputs.map(x => x.planned),
  remeasuredFrom: {runSha256: digest(old), cellsSha256: digest(ids.map((id: string) => readJson(join(source, 'cells', id + '.json'))))}};
// The saved case list defines this panel. Its name is a provenance label;
// independently declared confirmation panels need not be CLI presets.
// Preflight every input before producing any output. A declared offset alone is
// insufficient: it must reproduce the actual saved times and requested strengths.
for (const {planned: c} of inputs) {
  const prior = readJson(join(source, 'cells', c.id + '.json'));
  assert.deepEqual(prior.beats.map((b: any) => ({t: b.t, frame: b.frame, impact: b.requested})), c.targets, `${c.id}: authoring or timing differs`);
  assert.equal(digest(readTrack(source, c.id)), prior.trackHash, `${c.id}: source track differs`);
}
mkdirSync(join(out, 'cells'), {recursive: true}); atomicWrite(join(out, 'run.json'), JSON.stringify(plan));
for (const {spec, music, planned: c} of inputs) {
  const prior = readJson(join(source, 'cells', c.id + '.json')), track = readTrack(source, c.id);
  const cell = measureCell({c, mode: plan.mode, spec, music, track, physicalFrames: prior.physicalFrames,
    compileMs: prior.compileMs, complete: prior.complete, fulfilled: prior.fulfilled, motion: prior.motion});
  // Frozen V6 observations also pin the saved non-impact requests. Replaying
  // current authoring must not silently reinterpret an old track's axes.
  assert.deepEqual(JSON.parse(JSON.stringify(cell.frozen)), prior.frozen, `${c.id}: frozen observations changed`);
  if (prior.gaps) assert.deepEqual(cell.gaps, prior.gaps, `${c.id}: axis requests changed`);
  saveCell(out, plan, c, cell, track); Engine.retainOnly([]);
}
assert.equal(evaluatorIdentity(), plan.evaluator, 'measurement code changed during replay');
console.log(`${from} → ${name}: ${loadRun(out).cells.size} tracks remeasured; compiler outputs preserved`);
