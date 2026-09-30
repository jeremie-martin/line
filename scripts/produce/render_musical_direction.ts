/** Render preserved study rides through the existing production pipeline.
 * No compilation, style selection, geometry mutation or creative gate happens here. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {hostname} from 'node:os';
import {sha} from '../../benchmark/v3/model.ts';
import {writeGalleryJson,galleryHarnessIdentity} from '../gallery/artifacts.ts';
import {ensureMirror,ensureSpectrum,renderBundle} from './render.ts';

const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('study')&&arg('ids'),'--study and --ids required');
const root=resolve(arg('study')!),hash=(p:string)=>sha(readFileSync(p));
function read(path:string){assert.equal(hash(path),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(readFileSync(path,'utf8'));}
// A completed comparison set can be rendered while other sets are compiling.
// This does not publish an incomplete study manifest or claim panel completion.
const savedSet=arg('set')?read(join(root,arg('set')!)):null;
const manifest=savedSet?{plan:read(join(root,'plan.json')),planSha256:hash(join(root,'plan.json')),cells:savedSet.cells}:read(join(root,'manifest.json'));
if(savedSet)assert.equal(savedSet.planSha256,manifest.planSha256);
const ids=arg('ids')!.split(',');
assert.ok(ids.length&&ids.every(id=>manifest.cells.some((c:any)=>c.id===id)));
const paths=['scripts/produce/render_musical_direction.ts','scripts/produce/render.ts','scripts/export.ts','scripts/lib/export.ts',
  'scripts/make_overlay_data.ts','scripts/fx_recipe.ts',...execFileSync('git',['ls-files','remotion/src'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)];
const pipeline=galleryHarnessIdentity(paths),mirror=await ensureMirror();
const probe=(p:string)=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p],{encoding:'utf8'}));
function check(p:string){
  const info=probe(p),v=info.streams.find((s:any)=>s.codec_type==='video');
  assert.equal(v.width,1080);assert.equal(v.height,1920);assert.equal(v.avg_frame_rate,'60/1');
  assert.ok(info.streams.some((s:any)=>s.codec_type==='audio'));
  execFileSync('ffmpeg',['-v','error','-i',p,'-f','null','-'],{stdio:['ignore','ignore','pipe']});return info;
}
try{
  for(const id of ids){
    const cell=manifest.cells.find((c:any)=>c.id===id),c=manifest.plan.cases.find((c:any)=>c.id===cell.caseId);
    const bytes=readFileSync(join(root,cell.path));assert.equal(sha(bytes),cell.sha256);const record=JSON.parse(bytes.toString());
    assert.equal(record.planSha256,manifest.planSha256);assert.ok(record.valid,'failed rides are inspectable but cannot be rendered as completed production videos');
    assert.equal(hash(c.source),c.specSha256);assert.equal(hash(c.audioPath),c.audioSha256);
    assert.equal(hash(join('productions',c.id,'audio.json')),c.analysisSha256);
    const trackPath=join(root,cell.trackPath),reportPath=join(root,cell.reportPath);
    assert.equal(sha(JSON.stringify(read(trackPath))),cell.trackHash);assert.deepEqual(read(trackPath),record.track);
    assert.ok(record.track.lines.every((l:any)=>l.type===0));
    const identity={planSha256:manifest.planSha256,cellSha256:cell.sha256,trackSha256:hash(trackPath),
      reportSha256:hash(reportPath),specSha256:c.specSha256,audioSha256:c.audioSha256,jolt:manifest.plan.jolt,render:c.render,pipeline};
    const savedPath=join(root,id+'.video.json');
    if(existsSync(savedPath)){
      const saved=read(savedPath);assert.deepEqual(saved.identity,identity,'stale production render');
      assert.equal(hash(join(root,saved.full.path)),saved.full.sha256);assert.equal(hash(join(root,saved.excerpt.path)),saved.excerpt.sha256);
      console.log(`already verified ${id}`);continue;
    }
    const work=join(root,'render-work',id);mkdirSync(work,{recursive:true});
    const spectrumBase=await ensureSpectrum(resolve(c.audioPath),c.id,join(work,'spectrum.log'));
    const folder=await renderBundle({specPath:resolve(c.source),trackPath,reportPath,
      budgetTelemetryPath:join(root,id,'budget-telemetry.json'),audioPath:resolve(c.audioPath),spectrumBase,
      seed:cell.seed,song:id,project:'musical-direction-review',metrics:cell.metrics,render:c.render,budget:cell.budget,
      jolt:manifest.plan.jolt,outDir:join(root,'videos'),workDir:work,gitSha:manifest.plan.compiler.head,host:hostname()});
    const full=join(folder,'video.mp4'),fullProbe=check(full),excerpt=join(folder,'excerpt.mp4');
    execFileSync('ffmpeg',['-v','error','-y','-ss',String(c.excerpt[0]),'-i',full,'-t',String(c.excerpt[1]-c.excerpt[0]),
      '-map','0:v:0','-map','0:a:0','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',excerpt],{stdio:['ignore','ignore','pipe']});
    const excerptProbe=check(excerpt);
    assert.ok(Math.abs(Number(excerptProbe.format.duration)-(c.excerpt[1]-c.excerpt[0]))<.1);
    // The production path imports this exact track. Its camera and compositor
    // alter images only. Verify preserved physical artifacts after rendering too.
    assert.equal(hash(trackPath),identity.trackSha256);assert.equal(hash(reportPath),identity.reportSha256);
    assert.deepEqual(galleryHarnessIdentity(paths),pipeline);
    writeGalleryJson(root,id+'.video.json',{schema:'line.musical-direction-video.v1',id,identity,
      full:{path:relative(root,full),sha256:hash(full),probe:fullProbe},
      excerpt:{path:relative(root,excerpt),sha256:hash(excerpt),probe:excerptProbe,start:c.excerpt[0],end:c.excerpt[1]},
      normalLinesOnly:true,geometryUnchangedByProductionPipeline:true,decodedWithoutErrors:true,visualApproval:null});
    console.log(`complete ${id}`);
  }
}finally{mirror?.kill();}
