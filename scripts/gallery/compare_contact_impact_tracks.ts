/** Paired complete-song evidence under one fixed experimental ruler. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {CONTACT_IMPACT_CONTRACT} from '../lib/contact_impact.ts';
import {replayGalleryTrack,writeGalleryJson} from './artifacts.ts';
import {contactImpactGrade} from './contact_impact_grade.ts';
import {sha} from '../../benchmark/v3/model.ts';
const arg=(k:string,d?:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const input=resolve(arg('input')!),out=resolve(arg('out',input+'/comparison')!);mkdirSync(out,{recursive:true});
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim(),p);return JSON.parse(b.toString());};
const baselineDirectory=arg('baseline');
const baselineSources=baselineDirectory?readdirSync(resolve(baselineDirectory),{withFileTypes:true})
  .filter(d=>d.isDirectory()&&existsSync(join(resolve(baselineDirectory),d.name,'manifest.json'))).map(d=>{
    const directory=join(resolve(baselineDirectory),d.name),manifest=read(join(directory,'manifest.json'));
    const cell=manifest.cells.find((c:any)=>c.method==='production');assert.ok(cell,'automatic baseline required');
    return {song:cell.caseId,seed:cell.seed,path:join(directory,cell.path)};
  }):read('generated/beat-salience-20261001/audit.json').runs.filter((r:any)=>r.version==='current');
assert.equal(new Set(baselineSources.map((r:any)=>`${r.song}:${r.seed}`)).size,baselineSources.length,'duplicate baseline identity');
const files=readdirSync(input,{withFileTypes:true}).filter(d=>d.isDirectory()&&existsSync(join(input,d.name,'manifest.json'))).map(d=>join(input,d.name,'manifest.json'));
const summary=(r:any,impact:any,grade:any)=>{
  const {account:a,events,targets}=impact;
  const cohort=(predicate:(v:number)=>boolean)=>{
    const wanted=targets.map((t:any,i:number)=>({t,i})).filter(({t}:any)=>t.impact!==undefined&&predicate(t.impact));
    const matches=a.matches.filter((m:any)=>wanted.some(({i}:any)=>i===m.target));
    const intervals=wanted.map(({i}:any)=>[i?targets[i-1].frame:0,targets[i].frame]);
    const extras=a.unmatchedEvents.map((i:number)=>events[i]).filter((e:any)=>intervals.some(([s,t]:number[])=>e.onset>=s&&e.onset<t));
    return {targets:wanted.length,matched:matches.length,strengthMse:matches.reduce((n:number,m:any)=>n+m.strengthError**2,0)/Math.max(1,wanted.length),
      timingMse:matches.reduce((n:number,m:any)=>n+m.timingError**2,0)/Math.max(1,wanted.length),extraRawSquared:extras.reduce((n:number,e:any)=>n+(e.raw/CONTACT_IMPACT_CONTRACT.veryStrong)**2,0)};
  };
  const gains=impact.speedGains.map((g:any)=>({...g,excess:Math.max(0,g.strongest.gain-Math.max(.75,.1*g.strongest.speedBefore))}));
  return {trackHash:r.trackHash,valid:impact.valid,fulfilled:r.production.realization.fulfilled,score:grade.score,
    targets:targets.length,matched:a.matches.length,missing:a.missingTargets,events:events.length,
    strengthMse:a.strengthMse,timingMse:a.timingMse,extraMse:a.extraMse,loss:a.loss,
    extraAboveQuarterScale:a.unmatchedEvents.filter((i:number)=>events[i].strength>=.25).length,
    timingFrames:a.matches.map((m:any)=>m.offset),quiet:cohort(v=>v<=.1),strong:cohort(v=>v>=.65),
    gains:{count:gains.filter((g:any)=>g.excess>0).length,maxExcess:Math.max(0,...gains.map((g:any)=>g.excess)),
      excessSum:gains.reduce((n:number,g:any)=>n+g.excess,0),worst:gains.sort((a:any,b:any)=>b.excess-a.excess).slice(0,5)},
    physicalFrames:r.physicalFrames,compileMs:r.compileMs,motion:r.production.motion.full};
};
const pairs:any[]=[];
for(const file of files){
  const manifest=read(file),cell=manifest.cells.find((c:any)=>c.method==='production'),candidatePath=join(file,'..',cell.path),candidate=read(candidatePath);
  const baselineSource=baselineSources.find((r:any)=>r.song===candidate.caseId&&r.seed===candidate.seed);
  assert.ok(baselineSource,'comparison requires an explicit paired baseline');
  const baseline=read(baselineSource.path);
  assert.deepEqual(candidate.production.plan,baseline.production.plan,'seeded arrangement changed');
  for(const k of ['specSha256','audioSha256','analysisSha256'])assert.equal(candidate.case[k],baseline.case[k]);
  for(const k of ['contacts','air','samples','durationFrames'])assert.deepEqual(candidate.case[k],baseline.case[k],'compiled musical inputs changed');
  const replay=replayGalleryTrack(baseline.track,baseline.case,true,CONTACT_IMPACT_CONTRACT.id),impact=replay.impactEvaluation!;
  const grade=contactImpactGrade(replay.grade,impact);
  const pair={song:candidate.caseId,seed:candidate.seed,baselinePath:baselineSource.path,candidatePath,
    baseline:summary(baseline,impact,grade),candidate:summary(candidate,candidate.impactEvaluation,{score:candidate.score}),
    baselineEvaluation:impact,baselineGrade:grade,candidateEvaluation:candidate.impactEvaluation};
  pairs.push(pair);console.log(JSON.stringify({song:pair.song,seed:pair.seed,baselineScore:grade.score.score,candidateScore:candidate.score.score,
    impactLoss:[pair.baseline.loss,pair.candidate.loss],extra:[pair.baseline.extraAboveQuarterScale,pair.candidate.extraAboveQuarterScale],
    gainExcess:[pair.baseline.gains.excessSum,pair.candidate.gains.excessSum]}));
}
writeGalleryJson(out,'pairs.json',{schema:'line.contact-impact-paired-music.v1',contract:CONTACT_IMPACT_CONTRACT,
  contractSha256:sha(readFileSync('scripts/lib/contact_impact.ts')),harnessSha256:sha(readFileSync(import.meta.filename)),pairs});
