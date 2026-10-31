/** Stratified benchmark tooling: panel discovery from variant files, the sealed
 * and held-out guards, and the stratified report arithmetic on synthetic runs. */
import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {panelCases, SONGS} from '../tools/eval/inputs.ts';
import {stratify, windowImpact, failurePoint} from '../tools/eval/summary.ts';
import {validateRunOptions, stratifiedReport} from '../tools/eval/eval.ts';
import type {Run} from '../tools/eval/records.ts';

const dirs: string[] = [];
afterEach(() => {for (const d of dirs.splice(0)) rmSync(d, {recursive: true, force: true});});
function productions(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'line-bench-test-')); dirs.push(root);
  mkdirSync(join(root, 'productions', 'no_variants_song'), {recursive: true});
  for (const [path, src] of Object.entries(files)) {
    mkdirSync(join(root, 'productions', path, '..'), {recursive: true}); writeFileSync(join(root, 'productions', path), src);
  }
  return root;
}
const variant = (bench: unknown, duration = 40) => `export const bench = ${JSON.stringify(bench)};\nexport default {duration: ${duration}, contacts: []};\n`;

it('discovers bench and sealed variants into the declared panels', async () => {
  const root = productions({
    'tiki_tiki_48s/variants/bench-pairs.ts': variant({stratum: 'P1', pattern: 'kick-snare pairs', windows: [[10, 14], [20, 22.5]]}),
    'luna_bala_44s/variants/bench-words.ts': variant({stratum: 'P2', pattern: 'voice intro', windows: [[0, 8.6]]}),
    'luna_bala_44s/variants/bench-calm.ts': variant({stratum: 'P3', pattern: 'floats', windows: [[0, 9]]}),
    'amor_na_praia_46s/variants/sealed-pairs.ts': variant({stratum: 'P1', pattern: 'pairs', windows: [[5, 6]]}),
    'amor_na_praia_46s/variants/pairs.ts': variant({stratum: 'P1', pattern: 'not a bench spec', windows: [[5, 6]]}),
  });
  const bench = await panelCases('bench', root);
  expect(bench).toHaveLength(4 * 2 + 3 * 3);
  expect(bench.filter(c => c.bench!.stratum === 'G').map(c => c.id)).toEqual(SONGS.flatMap(s => [`${s}~spec~101`, `${s}~spec~202`]));
  expect(bench.find(c => c.id === 'tiki_tiki_48s~bench-pairs~303')).toEqual({id: 'tiki_tiki_48s~bench-pairs~303', song: 'tiki_tiki_48s',
    seed: 303, perturbation: null, variant: 'bench-pairs', bench: {stratum: 'P1', pattern: 'kick-snare pairs', windows: [[10, 14], [20, 22.5]]}});
  expect(bench.every(c => !c.variant?.startsWith('sealed') && c.variant !== 'pairs')).toBe(true);
  const confirm = await panelCases('bench-confirm', root);
  expect([...new Set(confirm.map(c => c.seed))].sort()).toEqual([505, 606, 707]);
  expect(confirm.filter(c => c.bench!.stratum === 'G').every(c => c.seed !== 707)).toBe(true);
  const pairs8 = await panelCases('bench-pairs8', root);
  expect(pairs8).toHaveLength(2 * 8);
  expect(new Set(pairs8.map(c => c.bench!.stratum))).toEqual(new Set(['P1', 'P2']));
  expect((await panelCases('sealed', root)).map(c => c.id)).toEqual([101, 202, 303].map(s => `amor_na_praia_46s~sealed-pairs~${s}`));
  const heldout = await panelCases('heldout', root);
  expect(heldout).toHaveLength(16);
  expect(heldout.map(c => c.id)).toContain('circus_minimus_77s~pairs4~404');
  expect(heldout.map(c => c.id)).toContain('trouble_50s~spec~101');
  expect((await panelCases('dev', root)).map(c => c.id)).toContain('luna_bala_44s~101~p1');
});

it('rejects a malformed bench export with the file named', async () => {
  for (const [bench, message] of [[undefined, /missing/], [{stratum: 'P9', pattern: 'x', windows: [[0, 1]]}, /stratum/],
    [{stratum: 'P1', pattern: '', windows: [[0, 1]]}, /pattern/], [{stratum: 'P1', pattern: 'x', windows: []}, /at least one/],
    [{stratum: 'P1', pattern: 'x', windows: [[2, 1]]}, /0 <= t0 < t1/], [{stratum: 'P1', pattern: 'x', windows: [[0, 41]]}, /duration/],
    [{stratum: 'P1', pattern: 'x', windows: [[3, 5], [4, 6]]}, /disjoint/]] as const) {
    const src = bench === undefined ? 'export default {duration: 40, contacts: []};\n' : variant(bench);
    const root = productions({'luna_bala_44s/variants/bench-bad.ts': src});
    await expect(panelCases('bench', root)).rejects.toThrow(/luna_bala_44s\/variants\/bench-bad\.ts/);
    await expect(panelCases('bench', root)).rejects.toThrow(message);
  }
});

it('runs sealed and held-out panels only on their explicit flag', () => {
  expect(() => validateRunOptions('strike3', 'standard', 1, 'sealed')).toThrow(/only with --sealed/);
  expect(() => validateRunOptions('strike3', 'standard', 1, 'sealed', {sealed: true})).not.toThrow();
  expect(() => validateRunOptions('strike3', 'standard', 1, 'heldout')).toThrow(/only with --heldout.*held out from compiler decisions/);
  expect(() => validateRunOptions('strike3', 'standard', 1, 'heldout', {heldout: true})).not.toThrow();
  expect(() => validateRunOptions('strike3', 'standard', 1, 'heldout', {sealed: true, heldout: true})).toThrow(/--sealed applies only/);
  expect(() => validateRunOptions('strike3', 'standard', 1, 'bench', {heldout: true})).toThrow(/--heldout applies only/);
  for (const p of ['dev', 'confirm', 'bench', 'bench-confirm', 'bench-pairs8']) expect(() => validateRunOptions('strike3', 'standard', 1, p)).not.toThrow();
  expect(() => validateRunOptions('strike3', 'standard', 1, 'patterns')).toThrow(/unknown evaluation panel/);
});

// ---- synthetic runs for the report arithmetic ----
const JOLT = -15, frameOf = (t: number) => Math.round((t - JOLT / 1000) * 40);
function planned(song: string, variant: string | null, seed: number, stratum: string, windows: Array<[number, number]>, times: number[]) {
  return {id: `${song}~${variant ?? 'spec'}~${seed}`, song, seed, perturbation: null, variant, bench: {stratum, pattern: 'p', windows},
    input: {jolt: JOLT, specSha256: 's', audioSha256: 'a', analysisSha256: 'b', resolvedSha256: 'c'},
    targets: times.map(t => ({t: t - JOLT / 1000, frame: frameOf(t), impact: .7})), authoredTargets: []};
}
/** A cell whose v3 loss is `loss`; `strengths[j]` null = beat j missed. */
function cell(c: any, {complete = true, loss = .1, strengths, extras = [], terminus = {frame: 2000, reason: 'endOfSpec'}}:
  {complete?: boolean; loss?: number; strengths?: Array<number | null>; extras?: any[]; terminus?: any} = {}) {
  const s = strengths ?? c.targets.map(() => .7);
  return {case: c, mode: 'strike3', complete, fulfilled: complete, physicalFrames: 1e6, compileMs: 1000, terminus,
    frozen: {valid: true, score: 1, axes: {}}, contact: {loss: 0}, guards: {}, motion: {},
    impact3: {loss, strengthMse: loss, timingMse: 0, extraMse: 0, strongExtras: 0, reversals: [], beats: c.targets.length, extras,
      perBeat: c.targets.map((t: any, j: number) => ({requested: t.impact, hit: s[j] == null ? null : {strength: s[j], onset: t.frame, timingError: 0}}))},
    beats: c.targets.map((t: any) => ({requested: t.impact, r1: {strength: .5, peak: 1}, impulse: {competitor: 0, hit: 1}, extrasR1: [], hiddenBend: 0}))};
}
const run = (panel: any[], cells: any[]): Run => ({dir: '', cells: new Map(cells.map(x => [x.case.id, x])),
  run: {schema: 'line.eval.v2', identity: {head: 'abcdef0123'}, evaluator: 'e'.repeat(64), jolt: JOLT, mode: 'strike3', budget: 'standard', panelName: 'bench', panel}});

it('reports completion first and quality only on cells complete in both arms, strata weighted equally', () => {
  const T = [1, 2, 3];
  const g = [101, 202].map(s => planned('luna_bala_44s', null, s, 'G', [], T));
  const p1a = [101, 202, 303].map(s => planned('tiki_tiki_48s', 'bench-pairs', s, 'P1', [[1.5, 2.5]], T));
  const p1b = [101].map(s => planned('amour_de_ma_vie_44s', 'bench-pairs', s, 'P1', [[0, 5]], T));
  const panel = [...g, ...p1a, ...p1b];
  // A: P1 tiki seed 202 recovered, seed 303 lost; quality of incomplete cells is absurd and must not count.
  const A = run(panel, [cell(g[0], {loss: .10}), cell(g[1], {loss: .30}),
    cell(p1a[0], {loss: .20}), cell(p1a[1], {loss: 9}), cell(p1a[2], {complete: false, loss: 99, strengths: [.7, null, null], terminus: {frame: 70, reason: 'sledBroken'}}),
    cell(p1b[0], {loss: .40})]);
  const B = run(panel, [cell(g[0], {loss: .20}), cell(g[1], {loss: .30}),
    cell(p1a[0], {loss: .25}), cell(p1a[1], {complete: false, loss: 99, strengths: [.7, .7, null]}), cell(p1a[2], {loss: .5}),
    cell(p1b[0], {loss: .10})]);
  const r = stratify(A, B);
  expect(r.strata.map(s => s.stratum)).toEqual(['G', 'P1']);
  const [G, P1] = r.strata;
  expect(G.completion).toMatchObject({total: 2, a: 2, b: 2, recovered: [], lost: []});
  expect(P1.completion).toMatchObject({total: 4, a: 3, b: 3, recovered: ['tiki_tiki_48s~bench-pairs~202'], lost: ['tiki_tiki_48s~bench-pairs~303']});
  expect(r.completionRate.a).toBeCloseTo((1 + 3 / 4) / 2);
  // Failures: crash at frame 70 (t ≈ 1.75 s) before beat 2 → 1 of 3 beats reached; B misses beat 3.
  expect(r.failures.a).toEqual([{id: 'tiki_tiki_48s~bench-pairs~303', kind: 'crash (sledBroken)', time: 70 / 40, reached: 1 / 3}]);
  expect(r.failures.b).toEqual([{id: 'tiki_tiki_48s~bench-pairs~202', kind: 'missed beat', time: frameOf(3) / 40, reached: 2 / 3}]);
  const loss = 'impact loss (v3)';
  // G: one spec, seeds (0.1−0.2) and (0.3−0.3): mean −0.05, signs 0 up, 1 down, 1 same.
  expect(G.quality[0].n).toBe(2);
  expect(G.quality[0].metrics[loss]).toMatchObject({up: 0, down: 1, same: 1});
  expect(G.value[loss].diff).toBeCloseTo(-.05);
  // P1: only tiki 101 is complete in both (−0.05); amour 101 is +0.3. Spec means weigh equally, not cells.
  expect(P1.quality.map(q => q.n)).toEqual([1, 1]);
  expect(P1.value[loss].diff).toBeCloseTo((-.05 + .3) / 2);
  expect(P1.value[loss].a).toBeCloseTo((.2 + .4) / 2);
  expect(r.overall[loss].diff).toBeCloseTo((-.05 + .125) / 2);
  expect(r.metricNames).not.toContain('complete');
  expect(r.metricNames).toEqual(expect.arrayContaining(['v3 strength (mse)', 'v3 timing (mse)', 'v3 extra (mse)', 'window v3 loss', 'air rms', 'speed rms']));
  const text = stratifiedReport(A, B, 'cand', 'ref').join('\n');
  expect(text.indexOf('1. Completion')).toBeLessThan(text.indexOf('2. Quality'));
  expect(text).toContain('recovered: tiki_tiki_48s~bench-pairs~202');
  expect(text).toMatch(/impact loss \(v3\)\s+-0\.050 \+0−1=1/);
  expect(text).not.toMatch(/\[-?\d+\.\d+, -?\d+\.\d+\]|excludes/);
  expect(() => stratifiedReport(A, undefined, 'cand')).not.toThrow();
});

it('restricts the windowed impact account to the pattern windows, in authored time', () => {
  const c = planned('tiki_tiki_48s', 'bench-pairs', 101, 'P1', [[1.5, 2.5], [3.9, 4.1]], [1, 2, 3, 4]);
  const x = cell(c, {strengths: [.1, .5, .7, null], extras: [{onset: frameOf(2.2), strength: .3, cost: .09}, {onset: frameOf(1), strength: .9, cost: .81}]});
  const w = windowImpact(x);
  // Beats inside: t = 2 (error −0.2) and t = 4 (missed); the extra at 2.2 s is inside, the one at 1 s is not.
  expect(w['window v3 strength (mse)']).toBeCloseTo(.04 / 2);
  expect(w['window missing / beat']).toBeCloseTo(.5);
  expect(w['window v3 extra (mse)']).toBeCloseTo(.09 / 2);
  expect(w['window v3 loss']).toBeCloseTo(.02 + .5 + .045);
  expect(w['window strong extra impacts / beat']).toBeCloseTo(.5);
  // No windows: the whole ride.
  const whole = windowImpact(cell({...c, bench: {...c.bench, windows: []}}, {strengths: [.7, .7, .7, .7]}));
  expect(whole['window v3 loss']).toBe(0);
  expect(failurePoint(cell(c, {strengths: [.7, .7, .7, .7], complete: false}))).toEqual({kind: 'invalid', time: NaN, reached: 1});
});
