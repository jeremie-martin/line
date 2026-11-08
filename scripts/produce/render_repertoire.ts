/** Reuse exact production media across workspace runs before invoking the existing
 * renderer. Reuse checks track/report bytes, inputs, metrics and pipeline hashes. */
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.argv.find(a=>a.startsWith('--study='))?.slice(8);
if(!root)throw new Error('--study required');
const out=resolve(root),read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const manifest=read(join(out,'manifest.json')),sources=new Set<string>();
const examples='motion-gallery/repertoire-examples.json';
if(existsSync(examples))for(const e of read(examples))sources.add(resolve(e.manifest.replace(/^\//,'').replace(/\/manifest\.json$/,'')));
const jobs='generated/repertoire-jobs';
if(existsSync(jobs))for(const id of readdirSync(jobs))if(/^[a-f0-9-]{36}$/.test(id))sources.add(resolve(jobs,id,'output'));
const library='motion-gallery/production-library.json';
if(existsSync(library))for(const e of read(library).entries)if(e.manifest)sources.add(resolve(e.manifest.replace(/^\//,'').replace(/\/manifest\.json$/,'')));
const pending=()=>manifest.cells.filter((c:any)=>c.valid&&!existsSync(join(out,c.id+'.video.json')));
for(const source of sources){
 if(source===out||!pending().length||!existsSync(join(source,'manifest.json')))continue;
 const previous=read(join(source,'manifest.json'));
 if(!pending().some((c:any)=>previous.cells.some((p:any)=>p.caseId===c.caseId&&p.method===c.method&&p.trackHash===c.trackHash&&existsSync(join(source,p.id+'.video.json')))))continue;
 execFileSync(process.execPath,['scripts/produce/reuse_musical_direction_videos.ts',`--study=${out}`,`--from=${source}`],{stdio:'inherit'});
}
// A study with no valid ride ('Incomplete' in the library index) has nothing to render; passing an empty --ids used to fail
// render_musical_direction's argument check and count the entry as a failed render job.
const valid=manifest.cells.filter((c:any)=>c.valid).map((c:any)=>c.id);
if(valid.length)execFileSync(process.execPath,['scripts/produce/render_musical_direction.ts',`--study=${out}`,`--ids=${valid.join(',')}`],{stdio:'inherit'});
else console.log('no valid rides to render');
