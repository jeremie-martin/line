import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';

export type ArcReviewIdentity = {
  song:string; seed:number; jolt:number; specSha256:string; audioSha256:string;
  render:unknown; options:unknown; implementation:Record<string,string>;
};

/** A review directory belongs to one authored input and rendering configuration.
 * Reject stale records before rendering or reusing their validation metrics. */
export function readArcReviewCompile(path:string,current:ArcReviewIdentity):any {
  const bytes=readFileSync(path),hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
  assert.equal(hash(bytes),readFileSync(path+'.sha256','utf8').trim(),'corrupt compile record');
  const record=JSON.parse(bytes.toString());
  assert.equal(record.schema,'line.arc-motion-production-review.v1','unsupported compile record');
  for(const key of ['song','seed','jolt','specSha256','audioSha256','render','options','implementation'] as const)
    assert.deepEqual(record[key],current[key],`saved review ${key} differs; use a new output directory`);
  for(const name of ['track.json','report.json','research.json','budget-telemetry.json'])
    assert.equal(hash(readFileSync(join(dirname(path),name))),record.outputs?.[name],`corrupt compiler output: ${name}`);
  return record;
}
