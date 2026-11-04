import {expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fixturePath, verifyFingerprints, type EngineReference} from '../tools/parity/engine_fingerprints.ts';
const reference = () => JSON.parse(readFileSync(fixturePath, 'utf8')) as EngineReference;
it('matches the independently recorded states and ordered events over the complete corpus', () => {
  expect(verifyFingerprints(reference())).toEqual({cases: 65, frames: 68827, collisions: 432018});
});
it('fails closed on stale provenance, missing cases and altered physics evidence', () => {
  const stale = reference(); stale.oracleSha256 = 'candidate';
  expect(() => verifyFingerprints(stale)).toThrow('stale engine reference provenance');
  const missing = reference(); missing.cases.pop();
  expect(() => verifyFingerprints(missing)).toThrow('stale or incomplete engine corpus');
  const corrupt = reference(); corrupt.cases[0].blocks[0].sha256 = 'wrong';
  expect(() => verifyFingerprints(corrupt)).toThrow('frames 0..255: physics mismatch');
});
