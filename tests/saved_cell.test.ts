import {expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {savedCell} from '../tools/eval/arms.ts';

it('reads saved, missing and stale cells synchronously without resolving unused inputs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'line-saved-cell-'));
  const arm = {dir, settings: {}} as any, c = {id: 'song~101', seed: 101} as any;
  const unused = () => {throw new Error('cached cells must not resolve inputs');};
  try {
    mkdirSync(join(dir, 'cells'));
    expect(savedCell(arm, c, 'current', unused)).toBeNull();
    const cell = {case: c, evaluator: 'current', score: 12};
    writeFileSync(join(dir, 'cells', c.id + '.json'), JSON.stringify(cell));
    expect(savedCell(arm, c, 'current', unused)).toEqual({cell});
    expect(savedCell(arm, {...c, seed: 202}, 'current', unused)).toEqual({stale: 'inputs changed (seed)'});
  } finally {rmSync(dir, {recursive: true, force: true});}
});
