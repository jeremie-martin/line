/** V7's integrity points (docs/benchmark.md): the frozen suite is exactly its
 * file; one headline definition, explicit requests apart; a compile-adapter
 * change is a different arm; the seed-block statistic against known values. */
import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {panelCases, V7_SUITE} from '../tools/eval/inputs.ts';
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
  expect(armKey('content', settings, -15, 'adapter-a')).not.toBe(armKey('content', settings, -15, 'adapter-b'));
  expect(armKey('content', settings, -15, 'adapter-a')).toBe(armKey('content', settings, -15, 'adapter-a'));
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
