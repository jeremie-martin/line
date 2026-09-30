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
const pending=()=>manifest.cells.filter((c:any)=>c.valid&&!existsSync(join(out,c.id+'.video.json')));
for(const source of sources){
 if(source===out||!pending().length||!existsSync(join(source,'manifest.json')))continue;
 const previous=read(join(source,'manifest.json'));
 if(!pending().some((c:any)=>previous.cells.some((p:any)=>p.caseId===c.caseId&&p.method===c.method&&p.trackHash===c.trackHash&&existsSync(join(source,p.id+'.video.json')))))continue;
 execFileSync(process.execPath,['--import','tsx','scripts/produce/reuse_musical_direction_videos.ts',`--study=${out}`,`--from=${source}`],{stdio:'inherit'});
}
execFileSync(process.execPath,['--import','tsx','scripts/produce/render_musical_direction.ts',`--study=${out}`,
 `--ids=${manifest.cells.filter((c:any)=>c.valid).map((c:any)=>c.id).join(',')}`],{stdio:'inherit'});
