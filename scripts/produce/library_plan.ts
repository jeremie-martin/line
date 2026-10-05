/** The collection declares the same authored inputs that each production cell
 * records. Resuming a batch cannot mix timing settings or authoring revisions. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export function musicSource(c: any) {
  return {specSha256: c.specSha256, audioSha256: c.audioSha256, analysisSha256: c.analysisSha256,
    resolvedSha256: createHash('sha256').update(JSON.stringify({duration: c.durationFrames, contacts: c.contacts,
      air: c.air, samples: c.samples, phases: c.phases, render: c.render})).digest('hex')};
}
export function assertLibraryEntry(collection: any, entry: any, manifest: any, plan: any) {
  assert.equal(collection.schema, 'line.production-library-plan.v2', 'collection needs an explicit input manifest');
  assert.deepEqual(manifest.plan, plan, 'manifest and plan differ');
  assert.equal(plan.jolt, collection.jolt, 'collection timing differs');
  assert.deepEqual(plan.compiler, collection.compiler, 'collection compiler differs');
  assert.deepEqual(plan.request, entry.request, 'collection request differs');
  assert.equal(plan.cases.length, 1);
  assert.deepEqual(musicSource(plan.cases[0]), collection.sources[entry.request.song], 'collection authoring differs');
  assert.equal(manifest.cells.length, 1);
  assert.equal(manifest.cells[0].method, 'production');
}
