/** Reuse a rendered video only for byte-identical physical tracks and reports,
 * with identical authored input, camera, jolt and production metrics. Seed labels
 * are artifact metadata; this production compositor does not draw them. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {writeGalleryJson} from '../gallery/artifacts.ts';
const root=resolve(process.argv.find(a=>a.startsWith('--study='))?.slice(8)??'');
const hash=(path:string)=>sha(readFileSync(path));
function read(path:string){assert.equal(hash(path),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(readFileSync(path,'utf8'));}
const m=read(join(root,'manifest.json')),saved=new Map<string,any>();
for(const cell of m.cells)if(existsSync(join(root,cell.id+'.video.json'))){
  const r=read(join(root,cell.id+'.video.json'));assert.equal(r.identity.cellSha256,cell.sha256);
  assert.equal(r.identity.planSha256,m.planSha256);
  for(const v of [r.full,r.excerpt])assert.equal(hash(join(root,v.path)),v.sha256);
  saved.set(cell.id,r);
}
let reused=0;
for(const cell of m.cells){
  if(saved.has(cell.id))continue;
  const source=m.cells.find((s:any)=>s.caseId===cell.caseId&&s.method===cell.method&&s.trackHash===cell.trackHash&&saved.has(s.id));
  if(!source)continue;
  const original=saved.get(source.id);
  const trackSha256=hash(join(root,cell.trackPath)),reportSha256=hash(join(root,cell.reportPath));
  assert.equal(trackSha256,original.identity.trackSha256);assert.equal(reportSha256,original.identity.reportSha256);
  const {seed:_sourceSeed,...sourceMetrics}=source.metrics,{seed:_targetSeed,...targetMetrics}=cell.metrics;
  assert.deepEqual(sourceMetrics,targetMetrics);
  const c=m.plan.cases.find((c:any)=>c.id===cell.caseId);
  assert.equal(c.specSha256,original.identity.specSha256);assert.equal(c.audioSha256,original.identity.audioSha256);
  assert.deepEqual(c.render,original.identity.render);assert.equal(m.plan.jolt,original.identity.jolt);
  const record={...original,id:cell.id,identity:{...original.identity,cellSha256:cell.sha256},reusedFrom:source.id,
    reuse:{trackBytesIdentical:true,reportBytesIdentical:true,productionMetricsIdenticalExceptSeed:true,
      authoredInputsCameraAndJoltIdentical:true,toolSha256:hash(import.meta.filename)}};
  writeGalleryJson(root,cell.id+'.video.json',record);saved.set(cell.id,record);reused++;
}
console.log(JSON.stringify({renderRecords:saved.size,totalTracks:m.cells.length,reused,unrendered:m.cells.filter((c:any)=>!saved.has(c.id)).map((c:any)=>c.id)}));
