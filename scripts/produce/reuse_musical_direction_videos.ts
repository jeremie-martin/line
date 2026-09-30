/** Reuse production media only for identical physical/input/render content.
 * --from=STUDY optionally reuses an earlier study's verified renders. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve,relative} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {writeGalleryJson} from '../gallery/artifacts.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('study'),'--study required');
const root=resolve(arg('study')!),cache=new Map<string,string>();
function hash(path:string){path=resolve(path);if(!cache.has(path))cache.set(path,sha(readFileSync(path)));return cache.get(path)!;}
function read(path:string){assert.equal(hash(path),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(readFileSync(path,'utf8'));}
const manifest=read(join(root,'manifest.json')),sources:any[]=[],saved=new Set<string>();
for(const sourceRoot of new Set([root,...(arg('from')?[resolve(arg('from')!)]:[])])){
  const m=read(join(sourceRoot,'manifest.json'));
  for(const cell of m.cells)if(existsSync(join(sourceRoot,cell.id+'.video.json'))){
    const record=read(join(sourceRoot,cell.id+'.video.json'));
    assert.equal(record.identity.cellSha256,cell.sha256);assert.equal(record.identity.planSha256,m.planSha256);
    for(const v of [record.full,record.excerpt])assert.equal(hash(join(sourceRoot,v.path)),v.sha256);
    for(const [path,digest]of Object.entries(record.identity.pipeline))assert.equal(hash(path),digest,'render pipeline changed');
    sources.push({sourceRoot,cell,record,plan:m.plan});if(sourceRoot===root)saved.add(cell.id);
  }
}
let reused=0;
for(const cell of manifest.cells){
  if(saved.has(cell.id))continue;
  const source=sources.find(s=>s.cell.caseId===cell.caseId&&s.cell.method===cell.method&&s.cell.trackHash===cell.trackHash);
  if(!source)continue;
  const {record:original,cell:sourceCell,sourceRoot}=source;
  const trackSha256=hash(join(root,cell.trackPath)),reportSha256=hash(join(root,cell.reportPath));
  assert.equal(trackSha256,original.identity.trackSha256);assert.equal(reportSha256,original.identity.reportSha256);
  const {seed:_sourceSeed,...sourceMetrics}=sourceCell.metrics,{seed:_targetSeed,...targetMetrics}=cell.metrics;
  assert.deepEqual(sourceMetrics,targetMetrics);
  const c=manifest.plan.cases.find((c:any)=>c.id===cell.caseId),s=source.plan.cases.find((c:any)=>c.id===cell.caseId);
  assert.equal(c.specSha256,original.identity.specSha256);assert.equal(c.audioSha256,original.identity.audioSha256);
  assert.equal(c.analysisSha256,s.analysisSha256);assert.deepEqual(c.render,original.identity.render);assert.equal(manifest.plan.jolt,original.identity.jolt);
  const media=(v:any)=>({...v,path:relative(root,resolve(sourceRoot,v.path))});
  let excerpt=media(original.excerpt);const excerptRetimed=JSON.stringify(c.excerpt)!==JSON.stringify(s.excerpt);
  if(excerptRetimed){
    const directory=join(root,'reused-excerpts');mkdirSync(directory,{recursive:true});
    const path=join(directory,cell.id+'.mp4');
    execFileSync('ffmpeg',['-v','error','-y','-ss',String(c.excerpt[0]),'-i',resolve(sourceRoot,original.full.path),'-t',String(c.excerpt[1]-c.excerpt[0]),
      '-map','0:v:0','-map','0:a:0','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',path],{stdio:['ignore','ignore','pipe']});
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'}));
    const video=probe.streams.find((stream:any)=>stream.codec_type==='video');
    assert.equal(video.width,1080);assert.equal(video.height,1920);assert.equal(video.avg_frame_rate,'60/1');
    assert.ok(probe.streams.some((stream:any)=>stream.codec_type==='audio'));
    execFileSync('ffmpeg',['-v','error','-i',path,'-f','null','-'],{stdio:['ignore','ignore','pipe']});
    excerpt={path:relative(root,path),sha256:sha(readFileSync(path)),probe};
  }
  const record={...original,id:cell.id,full:media(original.full),excerpt,
    identity:{...original.identity,planSha256:manifest.planSha256,cellSha256:cell.sha256},
    reusedFrom:sourceRoot===root?sourceCell.id:relative(process.cwd(),join(sourceRoot,sourceCell.id)),
    reuse:{trackBytesIdentical:true,reportBytesIdentical:true,productionMetricsIdenticalExceptSeed:true,
      authoredInputsCameraAndJoltIdentical:true,pipelineUnchanged:true,excerptRetimed,excerptWindow:c.excerpt,toolSha256:hash(import.meta.filename)}};
  writeGalleryJson(root,cell.id+'.video.json',record);saved.add(cell.id);reused++;
}
console.log(JSON.stringify({renderRecords:saved.size,totalTracks:manifest.cells.length,reused,
  unrendered:manifest.cells.filter((c:any)=>!saved.has(c.id)).map((c:any)=>c.id)}));
