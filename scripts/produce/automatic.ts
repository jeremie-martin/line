/** The ordinary and varied production profiles both enter through compileHandoff.
 * npm run produce:automatic -- --song=luna_bala_44s --seed=101 --out=DIR
 * A gallery job instead supplies --request=FILE. No manual windows or seed selection. */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha} from '../../benchmark/v3/model.ts';
import {verifyFrozen} from '../../benchmark/v6/contract.ts';
import {validateAutomaticProductionRequest,repertoireSongs} from '../gallery/repertoire_catalog.ts';
import {galleryCompilerIdentity,galleryHarnessIdentity,writeGalleryJson} from '../gallery/artifacts.ts';
import {loadMusicCase,saveMusicCell} from './music_artifacts.ts';
import {readRepertoireCache,publishRepertoireCache} from '../gallery/repertoire_cache.ts';
import {resolveJoltMs} from './seed.ts';
const arg=(key:string,d?:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3)??d;
if(!arg('out'))throw new Error('--out required; outputs are preserved rather than overwritten');
const request=validateAutomaticProductionRequest(arg('request')?JSON.parse(readFileSync(resolve(arg('request')!),'utf8')):
 {mode:'production',song:arg('song','luna_bala_44s'),seed:Number(arg('seed','101')),budget:Number(arg('budget','3000000')),
 referenceBudget:Number(arg('reference-budget','750000')),creative:arg('creative')?JSON.parse(arg('creative')!):{}});
const out=resolve(arg('out')!);mkdirSync(out,{recursive:true});
if(existsSync(join(out,'manifest.json')))throw new Error('completed output already exists; choose a fresh directory');
const {song,seed,budget,referenceBudget,creative}=request,title=repertoireSongs.find(s=>s.id===song)!.title;
const compilerRoot=resolve(arg('compiler-root','.')!);
const compiler=galleryCompilerIdentity(compilerRoot),judge=verifyFrozen(),jolt=resolveJoltMs();
const enginePath='engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm';
assert.equal(sha(readFileSync(join(compilerRoot,enginePath))),sha(readFileSync(enginePath)),'candidate physics differs from the frozen native engine');
const {compileHandoff}=await import(pathToFileURL(join(compilerRoot,'scripts/v0/optimizer/handoff.ts')).href);
const paths=['scripts/produce/automatic.ts','scripts/produce/music_artifacts.ts','scripts/gallery/repertoire_catalog.ts',
 'scripts/gallery/artifacts.ts','scripts/gallery/repertoire_cache.ts','scripts/gallery/contacts.ts','scripts/gallery/verify_construction.ts',
 'scripts/produce/seed.ts','scripts/produce/config.ts','scripts/produce/measure.ts',
 'scripts/v0/optimizer/arc_geometry.ts','scripts/v0/optimizer/motion_profiles.ts','scripts/v0/optimizer/arc_motion_control.ts'];
const harness=galleryHarnessIdentity(paths);
const {spec,musicCase:c}=await loadMusicCase({song,title,excerpt:[0,Math.min(16,repertoireSongs.find(s=>s.id===song)!.duration)],intent:'Seeded whole-track arrangement',moments:[]},jolt);
const methodDetails={baseline:{title:'Ordinary reference',description:'The ordinary public compiler profile.'},production:{title:'Automatic arrangement',description:'The same music with a seeded, repeated repertoire plan.'}};
const plan={schema:'line.automatic-production.v1',kind:'musical-direction',compilerRoot,compiler,judge,harness,jolt,
 cases:[c],seeds:[seed],budgets:[budget],methods:['baseline','production'],methodDetails,request};
const planSha256=writeGalleryJson(out,'plan.json',plan);
const cacheRoot=resolve('generated/production-reference-cache/v1');mkdirSync(cacheRoot,{recursive:true});
const sourceKey=sha(JSON.stringify({compiler:compiler.candidateFingerprint,harness,judge,jolt,spec:c.specSha256,analysis:c.analysisSha256,audio:c.audioSha256,seed,referenceBudget}));
const cached=readRepertoireCache(cacheRoot,sourceKey);let reference:any,referenceMs=0,referenceTelemetry:any;
if(cached){reference=cached.result;referenceMs=cached.compileMs;referenceTelemetry=(cached as any).budgetTelemetry;}
else{const began=performance.now(),checkpoint=compileHandoff(spec,seed,{budget:referenceBudget,budgetTelemetry:'summary'});referenceMs=performance.now()-began;
 if(!checkpoint.construction)throw new Error('ordinary reference did not enter the connected compiler');reference=checkpoint.construction;referenceTelemetry=checkpoint.budgetTelemetry;
 publishRepertoireCache(cacheRoot,sourceKey,{sourceKey,compiler,result:reference,compileMs:referenceMs,budgetTelemetry:referenceTelemetry});}
const baseline=saveMusicCell({out,planSha256,c,method:'baseline',seed,budget:referenceBudget,allowance:referenceBudget,result:reference,
 reference:null,referenceTrace:null,compileMs:referenceMs,physicalFrames:reference.stats.sim_frames,budgetTelemetry:referenceTelemetry});
console.log(JSON.stringify({stage:'reference',valid:baseline.cell.valid,reused:!!cached,physicalFrames:reference.stats.sim_frames}));
const began=performance.now(),checkpoint=compileHandoff(spec,seed,{budget,creative,budgetTelemetry:'summary',phraseBoundaries:c.phases.map((p:any)=>p.t0??p.t??p.start).filter((t:any)=>Number.isFinite(t))}),compileMs=performance.now()-began;
const repertoire=checkpoint.repertoire!;
const {result,...production}=repertoire;
const phrases=repertoire.plan.phrases.map(p=>{const requests=repertoire.plan.requests.slice(p.first,p.first+p.count);return {...p,title:p.construction,
 window:[requests[0].frame/40,Math.min(spec.duration,requests.at(-1)!.next/40)],sections:requests.map(r=>r.section)};});
const alternative=saveMusicCell({out,planSha256,c,method:'production',seed,budget,allowance:budget,result,reference,referenceTrace:baseline.trace,
 compileMs,physicalFrames:repertoire.physicalFrames,production,styles:repertoire.styles,phrases,budgetTelemetry:checkpoint.budgetTelemetry});
assert.deepEqual(galleryCompilerIdentity(compilerRoot),compiler,'compiler changed during generation');assert.deepEqual(verifyFrozen(),judge);assert.deepEqual(galleryHarnessIdentity(paths),harness);
const current=await loadMusicCase({song,title,moments:[]},jolt);for(const key of ['specSha256','audioSha256','analysisSha256'] as const)assert.equal(current.musicCase[key],c[key],'authored input changed during generation');
const cells=[baseline.cell,alternative.cell],accounting={referenceReused:!!cached,referenceOriginalFrames:reference.stats.sim_frames,
 actualCompilationFrames:(cached?0:reference.stats.sim_frames)+repertoire.physicalFrames,productionFrames:repertoire.physicalFrames,productionAllowance:budget,
 validation:'Independent judging and rendering are separate. The production allowance includes all construction, failed proposals, observation and compiler replay.'};
writeGalleryJson(out,'manifest.json',{schema:'line.motion-gallery.v1',planSha256,plan,cells,sets:[accounting],
 summary:cells.map(cell=>({method:cell.method,valid:Number(cell.valid),runs:1,meanScore:cell.score.score})),processElapsedMs:process.uptime()*1000});
console.log(JSON.stringify({complete:true,out,valid:alternative.cell.valid,qualified:repertoire.qualified,score:alternative.cell.score.score,seconds:compileMs/1000,accounting}));
