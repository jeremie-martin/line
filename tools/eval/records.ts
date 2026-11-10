/** A run is a declared panel, never an opportunistic directory listing. A cell
 * is published last, after its track, and belongs to exactly one run plan. */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, writeFileSync, renameSync, existsSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {join, resolve} from 'node:path';
import {digest, type resolveCase} from './inputs.ts';

export type PlannedCase = Awaited<ReturnType<typeof resolveCase>>['planned'];
export type RunPlan = {schema: 'line.eval.v2'; identity: any; evaluator: string; jolt: number; budget: string;
  panelName: string; panel: PlannedCase[]; remeasuredFrom?: {runSha256: string; cellsSha256: string};
  /** sha256 of the compile adapter (tools/eval/compile.ts) the run compiles with; absent on older runs. */
  adapter?: string;
  /** Creative preferences passed to the planner (absent = the defaults). An arm, not an input: paired runs may differ. */
  creative?: Record<string, unknown>};
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
    // song~seed[~pN] (legacy panels) or song~variant~seed (stratified; spec.ts is `spec`).
    assert.match(c.id, /^[a-z0-9_]+(~[A-Za-z0-9_-]+)?~\d+(~p\d+)?$/);
    assert.equal(c.input.jolt, p.jolt); assert.ok(c.targets.length > 0);
  }
  return p;
}

export function readCell(dir: string, plan: RunPlan, c: PlannedCase) {
  const cell = readJson(join(dir, 'cells', c.id + '.json'));
  assert.equal(cell.planSha256, digest(plan), `${c.id}: cell belongs to another run`);
  assert.deepEqual(cell.case, c, `${c.id}: inputs differ`);
  assert.equal(typeof cell.complete, 'boolean'); assert.equal(typeof cell.fulfilled, 'boolean');
  assert.equal(cell.impact3.perBeat.length, c.targets.length);
  assert.deepEqual(cell.beats.map((b: any) => ({t: b.t, frame: b.frame, impact: b.requested})), c.targets);
  assert.equal(digest(readTrack(dir, c.id)), cell.trackHash, `${c.id}: saved track differs`);
  return cell;
}
/** The one difference a jolt comparison allows between two resolutions of a
 * case: the jolt itself, each target's time (moved by the jolts' difference,
 * its frame rounded from it) and the resolved digest that covers them.
 * Everything else is identical: the declared case, spec, audio, analysis,
 * authored targets, target count and impacts. (Duration, preroll and the music
 * inside the digest are checked by compare on the resolved inputs.) */
export function assertJoltPair(a: PlannedCase, b: PlannedCase, joltA: number, joltB: number) {
  const unmoved = (c: PlannedCase, jolt: number) => {
    assert.equal(c.input.jolt, jolt, `${c.id}: resolved at jolt ${c.input.jolt}, not ${jolt}`);
    return {...c, input: {...c.input, jolt: null, resolvedSha256: null}, targets: c.targets.map((t: {impact: number | null}) => t.impact)};
  };
  assert.deepEqual(unmoved(a, joltA), unmoved(b, joltB), 'paired runs must have identical resolved inputs but for the jolt');
  a.targets.forEach((t: {t: number; frame: number}, i: number) => {
    const u = b.targets[i];
    assert.ok(Math.abs(t.t + joltA / 1000 - (u.t + joltB / 1000)) < 1e-9 && t.frame === Math.round(t.t * 40) && u.frame === Math.round(u.t * 40),
      `${a.id}: target ${i} is not the same contact moved by the jolt`);
  });
}
export const readJsonGz = (path: string) => JSON.parse(gunzipSync(readFileSync(path)).toString());
export const readTrack = (dir: string, id: string) => readJsonGz(join(dir, 'cells', id + '.track.json.gz'));
/** What a remeasured cell carries over from its compile: compiler outputs that
 * a replay of the saved track cannot reconstruct. */
export const compiledOutputs = (cell: any) => ({physicalFrames: cell.physicalFrames, compileMs: cell.compileMs, complete: cell.complete,
  fulfilled: cell.fulfilled, motion: cell.motion, geometry: cell.geometry});
export function saveCell(dir: string, plan: RunPlan, c: PlannedCase, cell: any, track: any) {
  const base = join(dir, 'cells', c.id);
  atomicWrite(base + '.track.json.gz', gzipSync(JSON.stringify(track)));
  atomicWrite(base + '.json', JSON.stringify({...cell, case: c, trackHash: digest(track), planSha256: digest(plan)}));
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
/** Paired runs: the same measurement code and identical resolved inputs. A
 * declared jolt comparison (`compare --candidate-jolt`, `allowJolt`) lets the
 * jolt differ, and nothing else (assertJoltPair). */
export function assertPairedRuns(a: Run, b: Run, {allowJolt = false} = {}) {
  assert.equal(a.run.evaluator, b.run.evaluator, 'different measurement code: remeasure before comparing');
  const inputs = (r: Run) => [...r.run.panel].sort((x, y) => x.id.localeCompare(y.id));
  if (allowJolt && a.run.jolt !== b.run.jolt) {
    const pa = inputs(a), pb = inputs(b);
    assert.equal(pa.length, pb.length, 'paired runs must have identical resolved inputs');
    pa.forEach((c, i) => assertJoltPair(c, pb[i], a.run.jolt, b.run.jolt));
  } else assert.deepEqual(inputs(a), inputs(b), 'paired runs must have identical resolved inputs');
  for (const r of [a, b]) assert.deepEqual([...r.cells.keys()].sort(), r.run.panel.map(c => c.id).sort(), 'incomplete paired panel');
}
