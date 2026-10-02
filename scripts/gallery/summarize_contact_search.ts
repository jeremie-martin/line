/** Preserve every scheduled development outcome, including failed processes.
 * Aggregate over complete tracks; contacts are not independent trials. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {writeGalleryJson} from './artifacts.ts';
const arg=(k:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3);
const root=resolve(arg('study')!),out=resolve(arg('out')??root);mkdirSync(out,{recursive:true});
const checked=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const plan=JSON.parse(readFileSync(join(root,'plan.json'),'utf8')),rows:any[]=[];
for(const variant of Object.keys(plan.variants))for(const [song,seeds]of Object.entries(plan.seeds))for(const seed of seeds as number[]){
 const directory=join(root,variant,`${song}-${seed}`),path=join(directory,'manifest.json');
 if(!existsSync(path)){rows.push({variant,song,seed,valid:false,fulfilled:false,quality:0,missingArtifact:true});continue;}
 const manifest=checked(path),metadata=manifest.cells.find((c:any)=>c.method==='production'),r=checked(join(directory,metadata.path));
 const e=r.impactEvaluation,a=e.account,observed=a.matches.map((m:any)=>({...m,wanted:e.targets[m.target].impact,actual:e.events[m.event].strength}));
 const rms=(field:string,items=observed)=>Math.sqrt(items.reduce((s:number,m:any)=>s+m[field]**2,0)/Math.max(1,items.length));
 const gains=e.speedGains.map((g:any)=>Math.max(0,g.strongest.gain-Math.max(.75,.1*g.strongest.speedBefore)));
 const construction=checked(join(directory,r.id,'construction.json'));
 rows.push({variant,song,seed,recordPath:join(directory,metadata.path),recordSha256:metadata.sha256,
  compiler:manifest.plan.compiler.candidateFingerprint,valid:r.valid,fulfilled:r.production.realization.fulfilled,
  quality:r.valid&&r.production.realization.fulfilled?r.score.score:0,components:r.score.components,
  impactLoss:a.loss,strengthRms:rms('strengthError'),onsetRmsMs:25*rms('offset'),
  quietStrengthRms:rms('strengthError',observed.filter((m:any)=>m.wanted!==undefined&&m.wanted<=.1)),
  strongStrengthRms:rms('strengthError',observed.filter((m:any)=>m.wanted!==undefined&&m.wanted>=.65)),
  extrasAboveQuarterScale:a.unmatchedEvents.filter((i:number)=>e.events[i].strength>=.25).length,
  gainExcessSum:gains.reduce((n:number,g:number)=>n+g,0),gainExcessMax:Math.max(0,...gains),
  physicalFrames:r.physicalFrames,compileMs:r.compileMs,
  opposingReceivers:construction.rows.filter((r:any)=>r.control?.contactSide===-1||r.c?.contactSide===-1).length,
  opposingEntryWork:construction.opposingEntryWork});
}
const groups=Object.keys(plan.variants).map(variant=>{
 const trials=rows.filter(r=>r.variant===variant),valid=trials.filter(r=>r.valid&&r.fulfilled);
 const mean=(key:string)=>trials.reduce((n,r)=>n+(r[key]??0),0)/trials.length;
 return {variant,scheduled:trials.length,validFulfilled:valid.length,meanQuality:mean('quality'),minimumQuality:Math.min(...trials.map(r=>r.quality)),
  meanImpactLoss:mean('impactLoss'),meanStrengthRms:mean('strengthRms'),meanOnsetRmsMs:mean('onsetRmsMs'),
  meanQuietStrengthRms:mean('quietStrengthRms'),meanStrongStrengthRms:mean('strongStrengthRms'),
  totalExtrasAboveQuarterScale:trials.reduce((n,r)=>n+(r.extrasAboveQuarterScale??0),0),meanGainExcessSum:mean('gainExcessSum'),
  meanPhysicsFrames:mean('physicalFrames'),meanCompileMs:mean('compileMs'),totalOpposingReceivers:trials.reduce((n,r)=>n+(r.opposingReceivers??0),0)};
});
writeGalleryJson(out,'summary.json',{schema:'line.contact-search-study.v1',plan,planSha256:sha(readFileSync(join(root,'plan.json'))),
 harnessSha256:sha(readFileSync(import.meta.filename)),groups,rows});
console.log(JSON.stringify(groups,null,2));
