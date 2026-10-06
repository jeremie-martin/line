/** Fresh-panel counterexamples and quiet relief, selected before looking at movies. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {loadRun,readTrack,assertPairedRuns} from '../../tools/eval/records.ts';
import {renderRides,cutClip,assertReviewSources} from '../../tools/measure/clip_render.ts';
const main='/home/wyss/line',out='generated/report/quality-20261005/q67/drag',rides='generated/report/quality-20261005/q67/rides';
process.chdir(main);
const root='/tmp/line-quality-passive-final-20261006/generated/eval/';
const runs={before:loadRun(root+'quality-passive-baseline-remeasured'),after:loadRun(root+'quality-passive-final')};
assertPairedRuns(runs.before,runs.after);
const raw=JSON.parse(readFileSync('docs/research/quality-20261005-fresh-drag-v-q31.json','utf8'));
const byLabel=(label:string)=>new Map<string,any>(raw.rows.filter((r:any)=>r.label===label&&!r.perturbation).map((r:any)=>[r.id,r]));
const A=byLabel('baseline'),B=byLabel('candidate');
const rank=(band:string)=>[...B].map(([id,b])=>({id,delta:b.counts[band].drag-A.get(id).counts[band].drag})).sort((a,b)=>b.delta-a.delta||a.id.localeCompare(b.id));
const selections=[{...rank('quiet')[0],band:'quiet',label:'Largest added quiet body-contact count',side:'after'},
 {...rank('strong')[0],band:'strong',label:'Largest added strong-context body-contact count',side:'after'},
 {...rank('quiet').at(-1)!,band:'quiet',label:'Largest reduction in quiet body-contact count',side:'before'}];
const picks=selections.map(p=>{const row=(p.side==='after'?B:A).get(p.id),range=row.ranges.filter((r:any)=>r.band===p.band).sort((a:any,b:any)=>b.seconds-a.seconds||a.start-b.start)[0];assert.ok(range);return {...p,frame:range.start,range};});
const tracks=new Map<string,{song:string;track:any}>();
for(const p of picks)for(const [side,run] of Object.entries(runs)){
 const c=run.cells.get(p.id);assert.equal(c.trackHash,(side==='before'?A:B).get(p.id).trackHash);assertReviewSources(c.case.song,c.case.input);
 tracks.set(`${side}~${p.id}`,{song:c.case.song,track:readTrack(run.dir,p.id)});
}
await renderRides(tracks,rides,2);mkdirSync(out,{recursive:true});
const pairs=picks.map((p,i)=>{const pair:any={...p,title:`${p.label} · ${p.id} · ${(p.frame/40).toFixed(3)} s · ${p.delta>0?'+':''}${p.delta} frames across this requested band`};
 for(const [side,run]of Object.entries(runs)){const movie=join(rides,`${side}~${p.id}.mp4`),file=join(out,`${i+1}-${side}.mp4`);cutClip(movie,p.frame,file);pair[side]={src:'/'+file,rideSrc:'/'+movie,trackHash:run.cells.get(p.id).trackHash};}
 return pair;
});
writeFileSync(join(out,'clips.json'),JSON.stringify({note:'Complete fresh48-panel selection using authored cases. Counts select passages but are not aesthetic judgments. Both sides show identical music time, centered on the selected sustained-contact run start rather than an impact peak.',pairs},null,2));
console.log('Three verified fresh-panel diagnostic pairs');
