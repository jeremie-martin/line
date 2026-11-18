import {expect, it} from 'vitest';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {specSha256} from '../scripts/gallery/spec_api.ts';

const tool = resolve('tools/music/revision.ts');

it('records what changed in a reading, stamped with its version; again on the same version, it replaces the entry', () => {
  const root = mkdtempSync(join(tmpdir(), 'revision-'));
  mkdirSync(join(root, 'productions/short_song/variants'), {recursive: true});
  writeFileSync(join(root, 'productions/short_song/spec.ts'), 'export default {duration: 40};\n');
  writeFileSync(join(root, 'productions/short_song/variants/upper.ts'), 'export default {duration: 40};\n');
  const run = (body: unknown, ...args: string[]) => {
    writeFileSync(join(root, 'note.json'), JSON.stringify(body));
    return spawnSync(process.execPath, [tool, '--song=short_song', '--by=Codex', '--file=note.json', ...args], {cwd: root, encoding: 'utf8'});
  };
  const revisions = () => JSON.parse(readFileSync(join(root, 'productions/short_song/revisions.json'), 'utf8')).revisions;
  try {
    for (const bad of [{summary: ' '}, {summary: 'x'.repeat(1201)}, {summary: 'ok', points: [{from: 41, to: null, text: 'past the end'}]},
      {summary: 'ok', points: [{from: 5, to: 3, text: 'backwards'}]}, {summary: 'ok', points: [{from: 5, to: null, text: 'x'.repeat(401)}]}])
      expect(run(bad).status, JSON.stringify(bad).slice(0, 80)).toBe(1);

    expect(run({summary: ' The voice carried through the chorus. ', points: [{from: 12.3, to: 15.4, text: 'the chorus'}, {from: 20, to: null, text: 'the hit'}]}).status).toBe(0);
    const sha = specSha256(join(root, 'productions/short_song/spec.ts'));
    expect(revisions()).toEqual([{spec: 'productions/short_song/spec.ts', sha256: sha, at: expect.any(String), by: 'Codex',
      summary: 'The voice carried through the chorus.', points: [{from: 12.3, to: 15.4, text: 'the chorus'}, {from: 20, to: null, text: 'the hit'}]}]);
    expect(run({summary: 'Upper too.'}, '--variant=upper').status).toBe(0);
    expect(run({summary: 'Said better.'}).status).toBe(0);
    expect(revisions().map((r: any) => [r.spec, r.summary, 'points' in r])).toEqual([
      ['productions/short_song/spec.ts', 'Said better.', false], ['productions/short_song/variants/upper.ts', 'Upper too.', false]]);
    // a new version of the reading: a new entry
    writeFileSync(join(root, 'productions/short_song/spec.ts'), 'export default {duration: 40, changed: true};\n');
    expect(run({summary: 'Second revision.'}).status).toBe(0);
    expect(revisions().map((r: any) => r.summary)).toEqual(['Said better.', 'Upper too.', 'Second revision.']);
    // it is no part of the version
    expect(specSha256(join(root, 'productions/short_song/spec.ts'))).toBe(revisions()[2].sha256);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
