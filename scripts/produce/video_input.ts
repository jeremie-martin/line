/** Verify a saved production before rendering it; never infer validity from a filename. */
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
export function readVerifiedJson(path: string): any {
  const bytes = readFileSync(path);
  assert.equal(sha(bytes), readFileSync(path + '.sha256', 'utf8').trim(), `Changed artifact: ${path}`);
  return JSON.parse(bytes.toString());
}
export function verifiedVideoCell(root: string, manifest: any, id: string) {
  const hash=(p:string)=>sha(readFileSync(p)), read=readVerifiedJson;
  const cell=manifest.cells.find((c:any)=>c.id===id);
  assert.ok(cell, 'Unknown video cell');
  const c=manifest.plan.cases.find((c:any)=>c.id===cell.caseId);
  assert.ok(c, 'Unknown music case');
  const bytes=readFileSync(join(root,cell.path));assert.equal(sha(bytes),cell.sha256);const record=JSON.parse(bytes.toString());
  assert.equal(record.planSha256,manifest.planSha256);assert.ok(record.valid,'failed rides are inspectable but cannot be rendered as completed production videos');
  assert.equal(hash(c.source),c.specSha256);assert.equal(hash(c.audioPath),c.audioSha256);
  assert.equal(hash(join('productions',c.id,'audio.json')),c.analysisSha256);
  const trackPath=join(root,cell.trackPath),reportPath=join(root,cell.reportPath);
  read(reportPath);
  assert.equal(sha(JSON.stringify(read(trackPath))),cell.trackHash);assert.deepEqual(read(trackPath),record.track);
  assert.ok(record.track.lines.every((l:any)=>l.type===0));
  const impactFile=join(root,id,'contact-impacts.json');
  const impactPath=existsSync(impactFile)?impactFile:undefined;
  if(impactPath){const saved=read(impactPath);assert.deepEqual(saved.evaluation,record.impactEvaluation);assert.deepEqual(saved.grade.score,record.score);}
  return {cell,c,record,trackPath,reportPath,impactPath};
}
