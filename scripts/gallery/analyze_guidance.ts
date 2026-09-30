/** Matched single/trimmed/full-guide study; raw tracks and replays stay local. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
const args=process.argv.slice(2),path=args.find(a=>!a.startsWith('--'));
const out=args.find(a=>a.startsWith('--out='))?.slice(6);
assert.ok(path&&out,'Supply MANIFEST --out=PATH');
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const checked=(path:string,digest?:string)=>{
 const bytes=readFileSync(path);assert.equal(sha(bytes),digest??readFileSync(path+'.sha256','utf8').trim());return JSON.parse(bytes.toString());
};
const manifest=checked(path),cells=manifest.cells as any[];
assert.deepEqual([...manifest.plan.methods].sort(),['arcs','paired','single']);
const rows=cells.filter(c=>c.method==='single').map(s=>{
 const match=(method:string)=>{const candidates=cells.filter(c=>c.method===method&&c.caseId===s.caseId&&c.budget===s.budget&&c.seed===s.seed);assert.equal(candidates.length,1);return candidates[0];};
 const a=match('arcs'),p=match('paired');
 const [single,arcs,paired]=[s,a,p].map(c=>checked(resolve(dirname(path),c.path),c.sha256));
 for(const r of [single,arcs,paired])assert.equal(r.planSha256,manifest.planSha256);
 const groups=arcRailGroups(single.track.lines);
 assert.ok(groups.size>0);assert.ok([...groups.values()].every(chains=>chains.length===1),'Single search emitted a guide');
 assert.equal(sha(JSON.stringify(single.track)),s.trackHash);
 for(const key of ['trace','score','observations','physicalFrames'])assert.deepEqual(arcs[key],paired[key],`${s.id}: ${key}`);
 const full=new Map(paired.track.lines.map((l:any)=>[l.id,l]));
 for(const l of arcs.track.lines)assert.deepEqual(l,full.get(l.id));
 const trimmedIds=new Set(arcs.track.lines.map((l:any)=>l.id));
 // Every main segment survives reduction; only guide geometry can disappear.
 for(const chains of arcRailGroups(paired.track.lines).values())for(const l of chains[0])assert.ok(trimmedIds.has(l.id));
 return {caseId:s.caseId,budget:s.budget,seed:s.seed,single:s.score.score,guided:a.score.score,delta:s.score.score-a.score.score,
  singleValid:s.score.valid,guidedValid:a.score.valid,singleMainSections:groups.size,
  removedGuideSegments:paired.track.lines.length-arcs.track.lines.length,
  artifacts:[s,a,p].map(c=>({id:c.id,sha256:c.sha256}))};
});
assert.equal(rows.length,manifest.plan.cases.length*manifest.plan.seeds.length*manifest.plan.budgets.length);
assert.equal(cells.length,rows.length*3);
const mean=(a:number[])=>a.reduce((s,n)=>s+n,0)/a.length;
const summarize=(selected:typeof rows)=>({pairs:selected.length,single:mean(selected.map(r=>r.single)),guided:mean(selected.map(r=>r.guided)),
 meanDelta:mean(selected.map(r=>r.delta)),singleWins:selected.filter(r=>r.delta>0).length,ties:selected.filter(r=>r.delta===0).length,
 singleValid:selected.filter(r=>r.singleValid).length,guidedValid:selected.filter(r=>r.guidedValid).length});
const budgets=manifest.plan.budgets.map((budget:number)=>({budget,...summarize(rows.filter(r=>r.budget===budget))}));
const cases=manifest.plan.cases.flatMap((c:any)=>manifest.plan.budgets.map((budget:number)=>({caseId:c.id,budget,...summarize(rows.filter(r=>r.caseId===c.id&&r.budget===budget))})));
const axisErrors=manifest.plan.cases.flatMap((c:any)=>manifest.plan.budgets.flatMap((budget:number)=>['single','arcs'].flatMap(method=>{
 const observations=cells.filter(r=>r.caseId===c.id&&r.budget===budget&&r.method===method).flatMap(r=>r.observations);
 return ['air','speed','amplitude','impact'].flatMap(axis=>[false,true].flatMap(tail=>{
  const selected=observations.filter(o=>o.axis===axis&&o.tail===tail);
  return selected.length?[{caseId:c.id,budget,method,axis,tail,intervals:selected.length,meanAbsoluteError:mean(selected.map(o=>Math.abs(o.error)))}]:[];
 }));
})));
const result={schema:'line.gallery-guidance-comparison.v1',manifest:{path,sha256:sha(readFileSync(path)),planSha256:manifest.planSha256},
 checks:{singleRunsWithoutGuides:rows.length,exactTrimmedVsFullTraceScoreObservationAndWorkMatches:rows.length,
  singleMainSections:rows.reduce((s,r)=>s+r.singleMainSections,0),removedGuideSegments:rows.reduce((s,r)=>s+r.removedGuideSegments,0)},
 budgets,cases,axisErrors,rows,
 interpretation:'Matched research-passage scores, not V4 headlines or capability ceilings. Seeds perturb targets; learned models remain shared with guided search. Differences reflect geometry and the current search together. Axis errors are unweighted descriptive interval means, not a reconstruction of the headline. See the accompanying report for development and evaluation input provenance.'};
mkdirSync(dirname(out),{recursive:true});const body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({checks:result.checks,budgets,cases}));
