import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';

const {cells} = JSON.parse(readFileSync('tools/parity/cells.json', 'utf8')) as {cells: Array<{id: string; seed: number; budget?: number; quality?: number}>};
const key = (c: typeof cells[number]) => `${c.id}#${c.seed}@${c.budget ?? 'standard'}`;

it('keeps each parity cell distinct, with a judged result at the standard allowance', () => {
  expect(new Set(cells.map(key)).size).toBe(cells.length);
  for (const cell of cells) expect(cell.budget === undefined).toBe(cell.quality !== undefined);
});

it('times real compiles by default: two songs at the standard allowance, with small-budget guards', () => {
  expect(cells.slice(3, 5).map(key)).toEqual(['canonical-music_luna_bala_44s-automatic#101@standard', 'canonical-music_tiki_tiki_48s-automatic#202@standard']);
  expect(cells.slice(9, 11).map(c => c.budget)).toEqual([150000, 750000]);
});
