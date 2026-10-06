/** Diagnostic timing, never an optimization objective. Same frozen physical ruler,
 * re-observed saved tracks; checks source targets and every rounded saved strength. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadRun} from '../../tools/eval/records.ts';
import {bootstrap,mean} from '../../tools/eval/summary.ts';
import {digest} from '../../tools/eval/inputs.ts';
const main='/home/wyss/line',dir=main+'/generated/report/quality-20261005';
const sources={Baseline:[main+'/generated/eval/quality-20261005-baseline',dir+'/baseline-physical.jsonl'],
 Q52:['/tmp/line-quality-cached-contacts-20261006/generated/eval/q52-cached-contacts',dir+'/q52-physical.jsonl'],
 Q55:['/tmp/line-quality-cached-arrivals-20261006/generated/eval/q55-cached-arrivals',dir+'/q55-physical.jsonl']};
const observed:any={};
for(const [name,[path,file]]of Object.entries(sources)){
 const run=loadRun(path),rows=readFileSync(file,'utf8').trim().split('\n').map(s=>JSON.parse(s));
 const ids=new Set<string>();
 for(const r of rows){const key=r.id+'~'+r.target;assert.ok(!ids.has(key));ids.add(key);
  const c=run.cells.get(r.id),hit=c.impact3.perBeat[r.target];assert.equal(c.case.targets[r.target].frame,r.frame);
  assert.equal(hit.requested,r.requested);assert.ok(Math.abs(hit.hit.strength-r.strength)<=.000051);}
 assert.equal(rows.length,[...run.cells.values()].reduce((n,c)=>n+c.impact3.perBeat.filter((b:any)=>b.hit).length,0));
 observed[name]={run,rows};
}
const metrics={onsetLagMs:(r:any)=>25*(r.onset-r.frame),responseWindowStartLagMs:(r:any)=>25*(r.strongestWindow-r.frame),
 absoluteResponseWindowStartLagMs:(r:any)=>25*Math.abs(r.strongestWindow-r.frame),responseWindowStartsAfter50ms:(r:any)=>Number(r.strongestWindow-r.frame>2),
 responseWindowStartsAfter100ms:(r:any)=>Number(r.strongestWindow-r.frame>4),spinFraction:(r:any)=>r.spin/r.totalImpulse};
const out:any={schema:'line.compiler-timing-audit.v1',description:'Matched hits only; strongestWindow is the START of the two-frame whole-body impulse window, not the single-frame force peak. Song-balanced means and paired bootstrap intervals; descriptive only, not perceptual validation.',
 sourceScriptSha256:digest(readFileSync(import.meta.filename,'utf8')),sources:Object.fromEntries(Object.entries(observed).map(([k,v]:any)=>[k,{planSha256:digest(v.run.run),compiler:v.run.run.identity,matched:v.rows.length}])),comparisons:{}};
for(const name of ['Q52','Q55']){
 const a=observed.Baseline,b=observed[name];assert.deepEqual(a.run.run.panel,b.run.run.panel);
 const result:any={};
 for(const perturbed of [false,true])for(const [band,filter]of Object.entries({all:(r:any)=>true,strong:(r:any)=>r.requested>=.6,quiet:(r:any)=>r.requested<.15})){
  const selected=(rows:any[])=>rows.filter(r=>!!r.perturbation===perturbed&&filter(r));
  const A=selected(a.rows),B=selected(b.rows),songs=[...new Set(A.map((r:any)=>r.song))];
  result[(perturbed?'perturbed':'authored')+':'+band]=Object.fromEntries(Object.entries(metrics).map(([metric,measure])=>{
   const avg=(rows:any[])=>new Map(songs.map(song=>[song,mean(rows.filter(r=>r.song===song).map(measure))]));
   const x=avg(A),y=avg(B),paired=new Map(songs.map(song=>[song,y.get(song)!-x.get(song)!]));
   return [metric,{baseline:bootstrap(x),candidate:bootstrap(y),paired:bootstrap(paired),perSong:Object.fromEntries(paired)}];
  }));
 }
 out.comparisons[name]=result;
}
writeFileSync(main+'/docs/research/quality-20261005-timing.json',JSON.stringify(out,null,2)+'\n');
for(const [name,rows]of Object.entries(out.comparisons) as any)for(const band of ['authored:strong','perturbed:strong'])console.log(name,band,JSON.stringify(rows[band]));
