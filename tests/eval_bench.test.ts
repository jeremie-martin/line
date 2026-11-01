/** Stratified benchmark tooling: panel discovery from variant files, the sealed
 * and held-out guards, and the stratified report arithmetic on synthetic runs. */
import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {panelCases, SONGS} from '../tools/eval/inputs.ts';
import {stratify, windowImpact, failurePoint, geometryOfCell, geometryStrata} from '../tools/eval/summary.ts';
import {validateRunOptions, stratifiedReport, geometryReport} from '../tools/eval/eval.ts';
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
  expect(heldout).toHaveLength(20);
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

// ---- geometry facts (section 4) ----
const sec = (family: string, guidance: string, frames: number, o: {rail?: string | null; guideFrames?: number; reasons?: string[]; reversals?: number} = {}) =>
  ({family, guidance, rail: o.rail === undefined ? (guidance === 'required' ? 'paired' : null) : o.rail, frames,
    fulfilled: !(o.reasons ?? []).length, reasons: o.reasons ?? [], guideFrames: o.guideFrames ?? 3, reversals: o.reversals ?? 0});
const withGeometry = (x: any, sections: any[]) => ({...x, geometry: {shapedMinFrames: 9, sections}});

it('computes one ride\'s geometry shares and realized facts', () => {
  const c = planned('luna_bala_44s', null, 101, 'G', [], [1, 2, 3]);
  const g = geometryOfCell(withGeometry(cell(c), [
    sec('arcs', 'optional', 10), sec('fold', 'required', 20, {reversals: 2}),
    sec('arcs', 'required', 8, {rail: 'transfer', guideFrames: 0, reasons: ['unused-or-missing-guide']}),
    sec('serpentine', 'required', 6, {reasons: ['missing-shaped-reversals'], reversals: 1}), sec('scattered', 'optional', 16)]))!;
  // 60 frames over 5 sections.
  expect(g.time['arcs/optional']).toBeCloseTo(10 / 60);
  expect(g.time['fold/required']).toBeCloseTo(20 / 60);
  expect(g.sections['arcs/required']).toBeCloseTo(1 / 5);
  expect(Object.values(g.time).reduce((n, x) => n + x, 0)).toBeCloseTo(1);
  // Guided = connected sections with a guide rail, offered ('optional') or required: 10 + 20 + 8 + 6 frames.
  expect(g.plan['transfer, share of guided time']).toBeCloseTo(8 / 44);
  expect(g.plan['transfer, share of guided sections']).toBeCloseTo(1 / 4);
  expect(g.plan['distinct families per ride']).toBe(4);
  // Short = under 9 frames: the 8-frame guided arcs and the 6-frame (unfitted) serpentine.
  expect(g.plan['short sections per ride']).toBe(2);
  expect(g.plan['short, planned shaped per ride']).toBe(1);
  expect(g.plan['short, planned guided arcs per ride']).toBe(1);
  expect(g.plan['short guided arcs, share of sections']).toBeCloseTo(1 / 5);
  expect(g.realized['sections fulfilled, share']).toBeCloseTo(3 / 5);
  expect(g.realized['guided, guide never touched per ride']).toBe(1);
  expect(g.realized['guided, guide never touched, share']).toBeCloseTo(1 / 4);
  expect(g.realized['shaped, turns realized, share']).toBeCloseTo(1 / 2);
  expect(g.realized['shaped, turn reversals per section']).toBeCloseTo(3 / 2);
  expect(geometryOfCell(cell(c))).toBeNull();
});

it('weighs geometry like the stratified report and says when a run predates it', () => {
  const T = [1, 2, 3];
  const g = [101, 202].map(s => planned('luna_bala_44s', null, s, 'G', [], T));
  const p = [planned('tiki_tiki_48s', 'bench-pairs', 101, 'P1', [[1, 2]], T), planned('amour_de_ma_vie_44s', 'bench-pairs', 101, 'P1', [[1, 2]], T)];
  const panel = [...g, ...p];
  const arcs = (n: number, untouched = 0) => [sec('arcs', 'forbidden', n), sec('arcs', 'required', n, {guideFrames: untouched ? 0 : 3})];
  // G: seeds 101 (all forbidden) and 202 (half the time guided) average per spec: guided time 1/4.
  // P1: tiki is fold (one 6-frame section, fitted to guided arcs in B), amour half guided arcs; specs weigh equally.
  const A = run(panel, [withGeometry(cell(g[0]), [sec('arcs', 'forbidden', 40)]), withGeometry(cell(g[1]), arcs(20)),
    withGeometry(cell(p[0]), [sec('fold', 'required', 30), sec('fold', 'required', 6)]),
    withGeometry(cell(p[1], {complete: false}), arcs(10, 1))]);
  const B = run(panel, [withGeometry(cell(g[0]), [sec('arcs', 'forbidden', 40)]), withGeometry(cell(g[1]), arcs(20)),
    withGeometry(cell(p[0]), [sec('fold', 'required', 30), sec('arcs', 'required', 6)]), withGeometry(cell(p[1]), arcs(10, 1))]);
  const r = geometryStrata(A, B);
  expect(r.strata).toEqual(['G', 'P1']);
  expect(r.groups.find(x => x.group === 'time')!.rows).toEqual(['arcs/forbidden', 'arcs/required', 'fold/required']);
  const guided = r.values.time['arcs/required'];
  expect(guided.strata[0]).toMatchObject({a: .25, b: .25, diff: 0});
  // P1: tiki has none in A (0, not missing); amour 1/2.
  expect(guided.strata[1].a).toBeCloseTo(.25);
  expect(guided.strata[1].b).toBeCloseTo((6 / 36 + .5) / 2);
  expect(guided.overall.diff).toBeCloseTo((.25 - (6 / 36 + .5) / 2) / 2);
  expect(r.values.plan['short, planned shaped per ride'].strata[1]).toMatchObject({a: .5, b: 0, diff: .5});
  // Realized facts only on cells complete in both arms: amour (incomplete in A) drops out.
  expect(r.realizedCells).toEqual([2, 1]);
  expect(r.values.realized['guided, guide never touched per ride'].strata[1]).toMatchObject({a: 0, b: 0});
  const text = geometryReport(A, B).join('\n');
  expect(text).toMatch(/^4\. Geometry/);
  expect(text).toMatch(/arcs\/required\s+25→25\s+25→33\s+25\.0\s+29\.2\s+-4\.2/);
  expect(text).not.toMatch(/better|worse/i);
  expect(stratifiedReport(A, B, 'cand', 'ref').join('\n')).toContain('4. Geometry');
  // A run compiled before geometry facts: not recorded, the other arm still shown.
  const old = run(panel, panel.map(c => cell(c)));
  const half = geometryReport(A, old).join('\n');
  expect(half).toContain('not recorded for B');
  expect(half).toMatch(/arcs\/required\s+25→—/);
  expect(geometryReport(old).join('\n')).toMatch(/not recorded: this run predates geometry facts/);
  expect(geometryStrata(old).values.time).toEqual({});
});
