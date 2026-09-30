/** Read-only guide-removal counterfactuals. Diagnostic evidence, never an extra
 * production qualification rule or a claim that every guide is indispensable. */
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
const arg=(k:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
if(!arg('study')||!arg('out'))throw new Error('--study and --out required');
const root=resolve(arg('study')!),out=resolve(arg('out')!);mkdirSync(out,{recursive:true});
function read(path:string){const bytes=readFileSync(path);if(sha(bytes)!==readFileSync(path+'.sha256','utf8').trim())throw new Error('artifact checksum mismatch');return JSON.parse(bytes.toString());}
const manifest=read(join(root,'manifest.json')),cell=manifest.cells.find((c:any)=>c.method==='production'),record=read(join(root,cell.path));
const selected=new Map<string,any>();for(const request of record.production.plan.requests)if(request.guidance==='required'&&record.production.railGuides[request.section]?.length&&!selected.has(request.construction))selected.set(request.construction,request);
const rows=[];
for(const request of selected.values()){
 const removed=new Set(record.production.railGuides[request.section]),track={...record.track,lines:record.track.lines.filter((l:any)=>!removed.has(l.id))};
 const replay=replayGalleryTrack(track,record.case,true),frames=Math.min(record.trace.frames.length,replay.trace.frames.length);
 let changed=0,firstChanged:number|null=null,maxDisplacement=0;
 for(let f=0;f<frames;f++){let displacement=0;for(let i=0;i<record.trace.frames[f].length;i+=2)displacement=Math.max(displacement,Math.hypot(record.trace.frames[f][i]-replay.trace.frames[f][i],record.trace.frames[f][i+1]-replay.trace.frames[f][i+1]));maxDisplacement=Math.max(maxDisplacement,displacement);if(displacement>1e-8){changed++;firstChanged??=f;}}
 rows.push({construction:request.construction,section:request.section,frame:request.frame,removedSegments:removed.size,
 originalScore:record.score.score,scoreWithoutGuide:replay.grade.score.score,validWithoutGuide:replay.grade.score.valid,
 firstChanged,changedFrames:changed,maxDisplacement,terminus:replay.grade.terminus});
}
writeGalleryJson(out,'guide-removal.json',{schema:'line.repertoire-guide-counterfactual.v1',source:root,cellSha256:cell.sha256,
 note:'Removing one retained guide while keeping all other lines fixed. This establishes its physical effect, not that no alternative unguided construction could work.',rows});console.log(JSON.stringify(rows));
