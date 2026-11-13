/** V7's integrity points (docs/benchmark.md): the frozen suite is exactly its
 * file; one headline definition, explicit requests apart; a compile-adapter
 * change is a different arm; the seed-block statistic against known values. */
import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {panelCases, V7_SUITE, V71_SUITE, V8_SUITE, HELDOUT} from '../tools/eval/inputs.ts';
import {readFileSync} from 'node:fs';
import {headline} from '../tools/eval/summary.ts';
import {armKey} from '../tools/eval/arms.ts';
import {seedBlocks, studentTQuantile} from '../tools/eval/uncertainty.ts';

const dirs: string[] = [];
afterEach(() => {for (const d of dirs.splice(0)) rmSync(d, {recursive: true, force: true});});
const variant = (stratum: string) => `export const bench = ${JSON.stringify({stratum, pattern: 'p', windows: [[1, 2]]})};\nexport default {duration: 40, contacts: []};\n`;

it('resolves V7 from its suite file only, with a stable seed sequence', async () => {
  const root = mkdtempSync(join(tmpdir(), 'line-v7-')); dirs.push(root);
  for (const [song, name, stratum] of [['tiki_tiki_48s', 'bench-pairs', 'P1'], ['tiki_tiki_48s', 'v7-rideout', 'P7'], ['luna_bala_44s', 'v7-extra', 'P7']]) {
    mkdirSync(join(root, 'productions', song, 'variants'), {recursive: true});
    writeFileSync(join(root, 'productions', song, 'variants', name + '.ts'), variant(stratum));
  }
  mkdirSync(join(root, 'tools/eval/suites'), {recursive: true});
  writeFileSync(join(root, V7_SUITE), JSON.stringify({specs: [{song: 'luna_bala_44s', variant: null, stratum: 'G'},
    {song: 'tiki_tiki_48s', variant: 'bench-pairs', stratum: 'P1'}, {song: 'tiki_tiki_48s', variant: 'v7-rideout', stratum: 'P7'}]}));
  const four = await panelCases('v7', root), eight = await panelCases('v7', root, 8);
  // v7-extra matches the file pattern but is not in the suite.
  expect(new Set(four.map(c => `${c.song}~${c.variant}`))).toEqual(new Set(['luna_bala_44s~null', 'tiki_tiki_48s~bench-pairs', 'tiki_tiki_48s~v7-rideout']));
  expect([...new Set(four.map(c => c.seed))]).toEqual([101, 202, 303, 404]);
  expect([...new Set(eight.map(c => c.seed))]).toEqual([101, 202, 303, 404, 505, 606, 707, 808]);
  expect(eight.slice(0, 4).map(c => c.id)).toEqual(four.slice(0, 4).map(c => c.id));
  writeFileSync(join(root, V7_SUITE), JSON.stringify({specs: [{song: 'tiki_tiki_48s', variant: 'v7-rideout', stratum: 'P5'}]}));
  await expect(panelCases('v7', root)).rejects.toThrow(/stratum P7 in its file/);
});

it('has one headline: categories equal, specs equal within, explicit requests apart', () => {
  const cell = (id: string, score: number, stratum: string, song: string, variant: string) =>
    ({c: {id, song, variant, seed: Number(id.split('~')[2]), bench: {stratum}}, cell: {complete: true, score: {valid: true, score}}});
  const rows = [cell('a~v1~101', 700, 'P1', 'a', 'v1'), cell('a~v1~202', 720, 'P1', 'a', 'v1'), cell('b~v2~101', 800, 'P1', 'b', 'v2'),
    cell('c~v3~101', 600, 'P2', 'c', 'v3'), cell('d~e~101', 100, 'E', 'd', 'e')];
  const run = {dir: '', run: {panel: rows.map(r => r.c)} as any, cells: new Map(rows.map(r => [r.c.id, r.cell]))};
  const h = headline(run, ['P1', 'P2', 'E']);
  expect(h.perStratum.P1).toBe(755);        // specs equal: (710 + 800) / 2
  expect(h.strata).toBe(677.5);             // (755 + 600) / 2; E is not counted
  expect(h.explicit).toBe(100);
  expect(h.counted).toEqual(['P1', 'P2']);
});

it('makes a change to the compile adapter a different arm', () => {
  const settings = {budget: 'standard'};
  expect(armKey('content', settings, 'adapter-a')).not.toBe(armKey('content', settings, 'adapter-b'));
  expect(armKey('content', settings, 'adapter-a')).toBe(armKey('content', settings, 'adapter-a'));
});

it('computes seed-block uncertainty as a t interval and directional support', () => {
  expect(studentTQuantile(.975, 2)).toBeCloseTo(4.303, 3);
  expect(studentTQuantile(.975, 3)).toBeCloseTo(3.182, 3);
  const u = seedBlocks([1, 2, 3]) as any;
  expect(u.mean).toBe(2); expect(u.sd).toBe(1); expect(u.df).toBe(2);
  expect(u.interval[0]).toBeCloseTo(2 - 4.303 / Math.sqrt(3), 3);
  expect(u.support).toBeCloseTo(0.9629, 4);   // P(t₂ < 2√3)
  expect('unavailable' in seedBlocks([1, 2])).toBe(true);
});

// A song is the same song at any tempo or length: its production directory less
// the version suffixes (luna_bala_44s, luna_bala_slowed_selection -> luna_bala).
const songOf = (dir: string) => dir.replace(/_selection$/, '').replace(/_(original|extended|slowed|super_slowed|ultra_slowed)$/, '').replace(/_\d+s$/, '');
it('V7.1 extends V7.0 exactly, and no held-out song is a development song', () => {
  const v70 = JSON.parse(readFileSync(V7_SUITE, 'utf8')).specs, v71 = JSON.parse(readFileSync(V71_SUITE, 'utf8')).specs;
  expect(v71.slice(0, v70.length)).toEqual(v70);
  const development = new Set(v71.map((s: {song: string}) => songOf(s.song)));
  expect(HELDOUT.map(h => songOf(h.song)).filter(song => development.has(song))).toEqual([]);
  expect(songOf('luna_bala_slowed_selection')).toBe(songOf('luna_bala_44s'));
});

it('V8 hardens every V7.1 spec and the joining ones, and keeps the held-out songs out', async () => {
  const v71 = JSON.parse(readFileSync(V71_SUITE, 'utf8')).specs, v8 = JSON.parse(readFileSync(V8_SUITE, 'utf8')).specs;
  const {JOINING} = await import('../tools/eval/harden.ts');
  const source = (s: {song: string; variant: string | null}) => `${s.song}/${s.variant ? `variants/${s.variant}` : 'spec'}.ts`;
  expect(v8.map((s: any) => s.source)).toEqual([...v71, ...JOINING].map(source));
  expect(v8.map((s: any) => s.stratum)).toEqual([...v71, ...JOINING].map((s: any) => s.stratum));
  const development = new Set(v8.map((s: {song: string}) => songOf(s.song)));
  expect(HELDOUT.map(h => songOf(h.song)).filter(song => development.has(song))).toEqual([]);
  const cases = await panelCases('v8');
  expect(cases).toHaveLength(v8.length * 4);
  expect(cases.every(c => c.variant!.startsWith('v8-'))).toBe(true);
});

it('V8 warps time on the beats: gaps x0.85, none below 6 frames or its own length', async () => {
  const {timeWarp, contrast} = await import('../tools/eval/harden.ts');
  const w = timeWarp([20, 24, 64], 104);   // gaps 20, 4, 40, then 40 to the end
  expect(w.beats).toEqual([17, 21, 55]);   // 17 (0.85 x 20), 4 kept, 34
  expect(w.duration).toBe(89);
  expect(w.map(0.5)).toBeCloseTo(17 / 40, 12);
  expect(w.map(1.1)).toBeCloseTo(38 / 40, 12);  // halfway between 24 and 64 -> halfway between 21 and 55
  expect(w.inverse(w.map(1.3))).toBeCloseTo(1.3, 12);
  expect([0, .1, .5, .8, .9, 1].map(contrast)).toEqual([0, 0, .5, .875, 1, 1]);
});
