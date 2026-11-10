/** The collection declares the same authored inputs that each production cell
 * records. Resuming a batch cannot mix timing settings or authoring revisions. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export function musicSource(c: any) {
  return {specSha256: c.specSha256, audioSha256: c.audioSha256, analysisSha256: c.analysisSha256,
    resolvedSha256: createHash('sha256').update(JSON.stringify({duration: c.durationFrames, contacts: c.contacts,
      air: c.air, samples: c.samples, phases: c.phases})).digest('hex')};
}
/** v3: contacts compiled at their authored times. A v2 collection moved them first (15 ms later by default). */
export const LIBRARY_SCHEMA = 'line.production-library-plan.v3';
export function assertLibrarySchema(collection: any) {
  assert.notEqual(collection.schema, 'line.production-library-plan.v2', 'this collection was compiled under the contact shift retired on ' +
    '2026-11-11 (contacts moved before compiling, 15 ms later by default): a different setting, compile a fresh collection');
  assert.equal(collection.schema, LIBRARY_SCHEMA, 'collection needs an explicit input manifest');
}
export function assertLibraryEntry(collection: any, entry: any, manifest: any, plan: any) {
  assertLibrarySchema(collection);
  assert.deepEqual(manifest.plan, plan, 'manifest and plan differ');
  assert.equal(plan.schema, 'line.automatic-production.v2', 'collection entry compiled under another timing setting');
  assert.deepEqual(plan.compiler, collection.compiler, 'collection compiler differs');
  assert.deepEqual(plan.request, entry.request, 'collection request differs');
  assert.equal(plan.cases.length, 1);
  assert.deepEqual(musicSource(plan.cases[0]), collection.sources[entry.request.song], 'collection authoring differs');
  assert.equal(manifest.cells.length, 1);
  assert.equal(manifest.cells[0].method, 'production');
}
