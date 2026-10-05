/** A run is a declared panel, never an opportunistic directory listing. A cell
 * is published last, after its track, and belongs to exactly one run plan. */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, writeFileSync, renameSync, existsSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {join, resolve} from 'node:path';
import {digest, type resolveCase} from './inputs.ts';

export type PlannedCase = Awaited<ReturnType<typeof resolveCase>>['planned'];
export type RunPlan = {schema: 'line.eval.v2'; identity: any; evaluator: string; jolt: number; mode: string; budget: string;
  panelName: string; panel: PlannedCase[]; remeasuredFrom?: {runSha256: string; cellsSha256: string}};
export type Run = {dir: string; run: RunPlan; cells: Map<string, any>};
export const runDir = (name: string) => resolve('generated/eval', name);
export function atomicWrite(path: string, bytes: string | Buffer) {
  const tmp = path + `.${process.pid}.tmp`;
  writeFileSync(tmp, bytes); renameSync(tmp, path);
}
export const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

export function readPlan(dir: string): RunPlan {
  const p = readJson(join(dir, 'run.json'));
  assert.equal(p.schema, 'line.eval.v2', 'run needs explicit remeasurement; old evidence is not a resumable cache');
  assert.ok(Number.isFinite(p.jolt) && typeof p.evaluator === 'string' && p.evaluator.length === 64, 'invalid input/measurement identity');
  assert.ok(Array.isArray(p.panel) && p.panel.length > 0, 'empty evaluation panel');
  assert.equal(new Set(p.panel.map((c: PlannedCase) => c.id)).size, p.panel.length, 'duplicate declared cases');
  for (const c of p.panel) {
    assert.match(c.id, /^[a-z0-9_]+~\d+(~p\d+)?$/);
    assert.equal(c.input.jolt, p.jolt); assert.ok(c.targets.length > 0);
  }
  return p;
}

export function readCell(dir: string, plan: RunPlan, c: PlannedCase) {
  const cell = readJson(join(dir, 'cells', c.id + '.json'));
  assert.equal(cell.planSha256, digest(plan), `${c.id}: cell belongs to another run`);
  assert.deepEqual(cell.case, c, `${c.id}: inputs differ`);
  assert.equal(cell.mode, plan.mode);
  assert.equal(typeof cell.complete, 'boolean'); assert.equal(typeof cell.fulfilled, 'boolean');
  assert.equal(cell.impact3.perBeat.length, c.targets.length);
  assert.deepEqual(cell.beats.map((b: any) => ({t: b.t, frame: b.frame, impact: b.requested})), c.targets);
  assert.equal(digest(readTrack(dir, c.id)), cell.trackHash, `${c.id}: saved track differs`);
  return cell;
}
export function readTrack(dir: string, id: string) {
  return JSON.parse(gunzipSync(readFileSync(join(dir, 'cells', id + '.track.json.gz'))).toString());
}
export function saveCell(dir: string, plan: RunPlan, c: PlannedCase, cell: any, track: any) {
  const base = join(dir, 'cells', c.id);
  atomicWrite(base + '.track.json.gz', gzipSync(JSON.stringify(track)));
  atomicWrite(base + '.json', JSON.stringify({...cell, case: c, mode: plan.mode, trackHash: digest(track), planSha256: digest(plan)}));
}
/** Resume may have absent cells. Existing cells must still be exact and intact. */
export function readCells(dir: string, plan: RunPlan) {
  const names = readdirSync(join(dir, 'cells')).filter(f => f.endsWith('.json'));
  const wanted = new Set(plan.panel.map(c => c.id + '.json'));
  assert.ok(names.every(n => wanted.has(n)), 'undeclared result in run');
  return new Map(plan.panel.filter(c => existsSync(join(dir, 'cells', c.id + '.json'))).map(c => [c.id, readCell(dir, plan, c)]));
}
export function loadRun(name: string): Run {
  const dir = runDir(name), run = readPlan(dir), cells = readCells(dir, run);
  assert.equal(cells.size, run.panel.length, `incomplete evaluation: ${cells.size}/${run.panel.length} cells; resume before reporting`);
  return {dir, run, cells};
}
export function assertPairedRuns(a: Run, b: Run) {
  assert.equal(a.run.evaluator, b.run.evaluator, 'different measurement code: remeasure before comparing');
  const inputs = (r: Run) => [...r.run.panel].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(inputs(a), inputs(b), 'paired runs must have identical resolved inputs');
  for (const r of [a, b]) assert.deepEqual([...r.cells.keys()].sort(), r.run.panel.map(c => c.id).sort(), 'incomplete paired panel');
}
