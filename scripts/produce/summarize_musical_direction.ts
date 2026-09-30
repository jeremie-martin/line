/** Verify the complete declared comparison and report local consequences.
 * No composite aesthetic objective or new benchmark headline is introduced. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {writeGalleryJson} from '../gallery/artifacts.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('study')&&arg('out'));const root=resolve(arg('study')!),out=resolve(arg('out')!);
const bytes=readFileSync(join(root,'manifest.json'));
assert.equal(sha(bytes),readFileSync(join(root,'manifest.json.sha256'),'utf8').trim());
const manifest=JSON.parse(bytes.toString()),{plan,cells}=manifest;
assert.equal(cells.length,plan.cases.length*plan.seeds.length*plan.methods.length);
const expected=new Set(plan.cases.flatMap((c:any)=>plan.seeds.flatMap((s:number)=>plan.methods.map((m:string)=>`${c.id}-${s}-${m}`))));
const records=new Map<string,any>();let prefixChecks=0,normalLines=0;
for(const cell of cells){
  assert.ok(expected.delete(cell.id),'unexpected or repeated cell');
  const raw=readFileSync(join(root,cell.path));assert.equal(sha(raw),cell.sha256);const r=JSON.parse(raw.toString());
  assert.equal(r.planSha256,manifest.planSha256);assert.equal(sha(JSON.stringify(r.track)),cell.trackHash);
  assert.ok(r.track.lines.every((l:any)=>l.type===0));normalLines+=r.track.lines.length;
  assert.ok(r.physicalFrames<=r.budget);records.set(r.id,r);
  const budget=JSON.parse(readFileSync(join(root,r.id,'budget-telemetry.json'),'utf8'));
  assert.equal(r.physicalFrames,budget.preparationFrames+budget.constructionFrames);
  assert.equal(r.valid,r.score.valid);
}
for(const r of records.values())if(r.construction.boundaryFrame!==null){
  const baseline=records.get(`${r.caseId}-${r.seed}-baseline`);assert.equal(r.construction.baseTrackHash,baseline.trackHash);
  const boundary=r.construction.boundaryFrame;
  assert.deepEqual(r.trace.frames.slice(0,boundary+1),baseline.trace.frames.slice(0,boundary+1));prefixChecks+=boundary+1;
  const section=r.construction.changedSections[0],prefix=(lines:any[])=>lines.filter(l=>Math.floor((l.id-1000)/10000)<section);
  assert.deepEqual(prefix(r.track.lines),prefix(baseline.track.lines));
  const construction=JSON.parse(readFileSync(join(root,r.id,'construction.json'),'utf8')),groups=arcRailGroups(r.track.lines);
  for(const row of r.sections){
    const subdivision=r.construction.styles[row.section]?.subdivisions??4;
    if(row.section>=section)assert.equal(groups.get(row.section)![0].length,1+Math.max(4,Math.ceil(construction.rows[row.section].control.support*subdivision)));
    if(r.construction.styles[row.section]?.guides===false)assert.equal(groups.get(row.section)!.length,1);
  }
}
for(const set of manifest.sets){
  const rows=cells.filter((c:any)=>c.caseId===set.caseId&&c.seed===set.seed);
  assert.equal(rows.length,plan.methods.length);assert.equal(set.physicalFrames,rows.reduce((n:number,c:any)=>n+c.physicalFrames,0));
  assert.ok(set.physicalFrames<=set.totalAllowance);
}
const mean=(values:number[])=>values.length&&values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0)/values.length:null;
const summary=plan.cases.flatMap((c:any)=>plan.methods.map((method:string)=>{
  const rows=cells.filter((r:any)=>r.caseId===c.id&&r.method===method);
  const local=c.moments.map((m:any)=>({title:m.title,from:m.from,to:m.to,
    axes:['air','speed','amplitude','impact'].flatMap(axis=>{
      const observations=rows.flatMap((r:any)=>r.observations.filter((o:any)=>o.axis===axis&&o.endFrame>=m.from*40&&o.startFrame<=m.to*40));
      return observations.length?[{axis,observations:observations.length,requestedMean:mean(observations.map((o:any)=>o.target)),
        achievedMean:mean(observations.map((o:any)=>o.achieved)),meanAbsoluteError:mean(observations.map((o:any)=>o.error)),
        largestAbsoluteError:Math.max(...observations.map((o:any)=>o.error))}]:[];
    })}));
  return {song:c.id,method,runs:rows.length,valid:rows.filter((r:any)=>r.valid).length,
    distinctTracks:new Set(rows.map((r:any)=>r.trackHash)).size,
    meanFrozenResearchAdherence:mean(rows.map((r:any)=>r.score.score)),meanProductionAdherence:mean(rows.map((r:any)=>r.metrics.score)),
    meanRms:mean(rows.map((r:any)=>r.qualityRms)),meanPhysicsFrames:mean(rows.map((r:any)=>r.physicalFrames)),
    meanCompileMs:mean(rows.map((r:any)=>r.compileMs)),local};
}));
mkdirSync(dirname(out),{recursive:true});
writeGalleryJson(dirname(out),out.split('/').at(-1)!,{schema:'line.musical-direction-evidence.v1',
  manifest:{path:relativePath(join(root,'manifest.json')),sha256:sha(bytes)},plan,
  checks:{tracks:cells.length,valid:cells.filter((r:any)=>r.valid).length,prefixFrameComparisons:prefixChecks,normalLines,
    completeDeclaredPanel:true,actualGeometryAndReturnVerified:true,allConstructionWorkAccounted:true},
  interpretation:'Two exposed production songs; the second was not used for mechanism development. Zero authored jitter can make seeds duplicate tracks. These are research adherence values, not a canonical headline or aesthetic rating. Local summaries include whole authored intervals overlapping the named moment; no per-moment score was optimized. Wall times share a host with other jobs. Owner visual preference remains pending.',
  summary,rows:cells.map((r:any)=>({...r,observations:undefined,moments:undefined,sections:undefined}))});
function relativePath(path:string){return path.startsWith(process.cwd()+'/')?path.slice(process.cwd().length+1):path;}
console.log(JSON.stringify({checks:cells.length,summary:summary.map(({local,...row}:any)=>row)}));
