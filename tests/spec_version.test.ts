import {expect, it} from 'vitest';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {isVersion, specFiles, specSha256} from '../scripts/gallery/spec_api.ts';

it("gives a reading a version of its own files: another reading's change is not its change", () => {
  const root = mkdtempSync(join(tmpdir(), 'spec-version-')), song = join(root, 'productions/short_song');
  mkdirSync(join(song, 'variants'), {recursive: true});
  writeFileSync(join(song, 'music.ts'), 'export const beat = 1;\n');
  writeFileSync(join(song, 'spec.ts'), "import {beat} from './music.ts';\nexport default {beat};\n");
  writeFileSync(join(song, 'variants/drums.ts'), "import main from '../spec.ts';\nexport default {...main};\n");
  writeFileSync(join(song, 'variants/cycle.ts'), 'export default {};\n');
  writeFileSync(join(song, 'events.json'), '{}');
  writeFileSync(join(song, 'notes.json'), '{}');
  const main = join(song, 'spec.ts'), drums = join(song, 'variants/drums.ts'), cycle = join(song, 'variants/cycle.ts');
  try {
    expect(specFiles(main)).toEqual(['events.json', 'music.ts', 'spec.ts']);
    expect(specFiles(drums)).toEqual(['events.json', 'music.ts', 'spec.ts', 'variants/drums.ts']);
    expect(specFiles(cycle)).toEqual(['events.json', 'variants/cycle.ts']);
    const before = {main: specSha256(main), drums: specSha256(drums), cycle: specSha256(cycle)};
    // one reading changes: the others keep their version
    writeFileSync(cycle, 'export default {changed: true};\n');
    expect(specSha256(cycle)).not.toBe(before.cycle);
    expect([specSha256(main), specSha256(drums)]).toEqual([before.main, before.drums]);
    expect(isVersion(main, before.main)).toBe(true);
    // what a reading imports is part of it: the main reading's change is the drums reading's change too
    writeFileSync(main, "import {beat} from './music.ts';\nexport default {beat, more: true};\n");
    expect(isVersion(main, before.main)).toBe(false);
    expect(isVersion(drums, before.drums)).toBe(false);
    // his notes are no part of a version
    writeFileSync(join(song, 'notes.json'), '{"notes": []}');
    expect(isVersion(cycle, specSha256(cycle))).toBe(true);
  } finally {rmSync(root, {recursive: true, force: true});}
});
