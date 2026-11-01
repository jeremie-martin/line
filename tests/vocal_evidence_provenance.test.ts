import {expect, it} from 'vitest';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validVocalEvidence} from '../scripts/gallery/spec_api.ts';

it('accepts matching evidence and rejects changed, missing, malformed and outside-root sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'vocal-evidence-'));
  const source = join(root, 'source'), evidence = join(root, 'evidence.json');
  const sha256 = createHash('sha256').update('original').digest('hex');
  const write = (path = 'source') => writeFileSync(evidence, JSON.stringify({schema: 'line.vocal-evidence.v1', inputs: [{path, sha256}]}));
  try {
    writeFileSync(source, 'original'); write();
    expect(validVocalEvidence(root, evidence, 'source')).toBe(true);
    expect(validVocalEvidence(root, evidence, 'different-audio')).toBe(false);
    writeFileSync(source, 'changed');
    expect(validVocalEvidence(root, evidence, 'source')).toBe(false);
    rmSync(source);
    expect(validVocalEvidence(root, evidence, 'source')).toBe(false);
    write('../outside');
    expect(validVocalEvidence(root, evidence, 'source')).toBe(false);
    writeFileSync(evidence, '{}');
    expect(validVocalEvidence(root, evidence, 'source')).toBe(false);
    writeFileSync(evidence, 'not json');
    expect(validVocalEvidence(root, evidence, 'source')).toBe(false);
  } finally { rmSync(root, {recursive: true, force: true}); }
});
