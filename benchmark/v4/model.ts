import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sha,type Case} from '../v3/model.ts';
export {sha,caseSpec,caseGaps,targets,sampledCurve,type Case,type Axis,type SpanAxis} from '../v3/model.ts';
export function loadCases():Case[]{
  const bytes=readFileSync(new URL('./specifications.json.gz',import.meta.url));
  const lock=JSON.parse(readFileSync(new URL('./catalog.lock.json',import.meta.url),'utf8'));
  assert.equal(sha(bytes),lock.compressedSha256);
  const raw=gunzipSync(bytes);assert.equal(sha(raw),lock.specificationsSha256);
  return JSON.parse(raw.toString());
}
