import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {cellIndices, PERF_CELLS} from '../tools/measure/engine_decision.ts';

const {cells} = JSON.parse(readFileSync('tools/parity/cells.json', 'utf8')) as {cells: Array<{id: string; seed: number; budget?: number; quality?: number}>};
const key = (c: typeof cells[number]) => `${c.id}#${c.seed}@${c.budget ?? 'standard'}`;

it('keeps each parity cell distinct, with a judged result at the standard allowance', () => {
  expect(new Set(cells.map(key)).size).toBe(cells.length);
  for (const cell of cells) expect(cell.budget === undefined).toBe(cell.quality !== undefined);
});

it('times real compiles by default: named cells at the standard allowance', () => {
  expect(new Set(PERF_CELLS).size).toBe(2);
  for (const index of cellIndices(cells, PERF_CELLS)) expect(cells[index].budget).toBeUndefined();
  expect(() => cellIndices(cells, ['retired-cell#1'])).toThrow('unknown parity cell');
});
