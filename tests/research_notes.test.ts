import {readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {expect, it} from 'vitest';

const NOTE_LIMIT = 1024 * 1024;

it('keeps research notes as text, with raw results out of the repository', () => {
  const files = readdirSync('docs/research', {recursive: true, withFileTypes: true}).filter(f => f.isFile());
  const unexpected = files.map(f => join(f.parentPath, f.name)).filter(path =>
    !/\.(md|png)$/.test(path) || statSync(path).size > NOTE_LIMIT);
  expect(unexpected).toEqual([]);
});
