import {expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fixturePath, referenceWasm, referenceFingerprints, verifyFingerprints, type EngineReference} from '../tools/parity/engine_fingerprints.ts';
import {sha256} from '../tools/parity/engine_corpus.ts';
const reference = () => JSON.parse(readFileSync(fixturePath, 'utf8')) as EngineReference;
const coverage = {cases: 65, frames: 68827, collisions: 432018};

it('matches recorded physics independently of the historical build and source identities', () => {
  const saved = reference(), before = structuredClone(saved);
  expect(verifyFingerprints(saved)).toEqual(coverage);
  expect(saved).toEqual(before); // verifying does not relabel historical evidence
  for (const key of ['oracleSha256', 'generatorSha256', 'corpusSha256'] as const) saved.provenance[key] = '0'.repeat(64);
  expect(verifyFingerprints(saved)).toEqual(coverage);
});
it('generates identical physics with the current judge and records the bytes actually used', () => {
  const generated = referenceFingerprints(), saved = reference();
  expect(generated.cases).toEqual(saved.cases);
  expect(generated.provenance.oracleSha256).toBe(sha256(readFileSync(referenceWasm)));
  expect(generated.provenance.generatorSha256).toBe(sha256(readFileSync(new URL('../tools/parity/engine_fingerprints.ts', import.meta.url))));
  expect(generated.provenance.corpusSha256).toBe(sha256(readFileSync(new URL('../tools/parity/engine_corpus.ts', import.meta.url))));
  expect(verifyFingerprints(generated)).toEqual(coverage);
});
it.each([{schema: 'unknown'}, {blockFrames: 128}, {encoding: 'rounded decimal'}])('rejects incompatible encoding contracts: %j', change => {
  const saved = reference();
  // @ts-expect-error Malformed on-disk input must be rejected at runtime too.
  saved.format = {...saved.format, ...change};
  expect(() => verifyFingerprints(saved)).toThrow('unsupported engine reference format');
});
it('rejects changed inputs, missing or reordered cases and altered physics evidence', () => {
  const changed = reference(); changed.cases[0].inputSha256 = '0'.repeat(64);
  expect(() => verifyFingerprints(changed)).toThrow('stale or incomplete engine corpus');
  const missing = reference(); missing.cases.pop();
  expect(() => verifyFingerprints(missing)).toThrow('stale or incomplete engine corpus');
  const reordered = reference(); reordered.cases.reverse();
  expect(() => verifyFingerprints(reordered)).toThrow('stale or incomplete engine corpus');
  const corrupt = reference(); corrupt.cases[0].blocks[0].sha256 = '0'.repeat(64);
  expect(() => verifyFingerprints(corrupt)).toThrow('frames 0..255: physics mismatch');
});
