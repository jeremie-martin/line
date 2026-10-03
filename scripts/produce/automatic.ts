/** Automatic production enters through compileHandoff.
 * npm run produce:automatic -- --song=luna_bala_44s --seed=101 --out=DIR
 * A gallery job instead supplies --request=FILE. No manual windows or seed selection. */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha} from '../../benchmark/v3/model.ts';
import {judgeIdentity} from '../../benchmark/v6/contract.ts';
import {validateAutomaticProductionRequest,repertoireSongs} from '../gallery/repertoire_catalog.ts';
import {galleryCompilerIdentity,galleryHarnessIdentity,writeGalleryJson} from '../gallery/artifacts.ts';
import {loadMusicCase,saveMusicCell} from './music_artifacts.ts';
import {resolveJoltMs} from './jolt.ts';
import {IMPACT_ACCOUNT_IDS,DEFAULT_IMPACT_ACCOUNT,type ImpactAccountId} from '../v0/optimizer/impact_accounts.ts';
const arg=(key:string,d?:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3)??d;
// The product optimizes the strike account; 'landing' requests the previous landing
// objective (frozen V6 ruler), kept temporarily for side-by-side review.
const requestedContract=arg('impact-contract',DEFAULT_IMPACT_ACCOUNT)!;
if(requestedContract!=='landing'&&!IMPACT_ACCOUNT_IDS.includes(requestedContract))throw new Error(`unknown impact contract; known: ${IMPACT_ACCOUNT_IDS.join(', ')}, landing`);
const impactContract=requestedContract==='landing'?undefined:requestedContract as ImpactAccountId;
if(!arg('out'))throw new Error('--out required; outputs are preserved rather than overwritten');
const request=validateAutomaticProductionRequest(arg('request')?JSON.parse(readFileSync(resolve(arg('request')!),'utf8')):
 {mode:'production',song:arg('song','luna_bala_44s'),seed:Number(arg('seed','101')),budget:Number(arg('budget','3000000')),
 referenceBudget:Number(arg('reference-budget','0')),creative:arg('creative')?JSON.parse(arg('creative')!):{}});
const out=resolve(arg('out')!);mkdirSync(out,{recursive:true});
if(existsSync(join(out,'manifest.json')))throw new Error('completed output already exists; choose a fresh directory');
const {song,seed,budget,referenceBudget,creative}=request,title=repertoireSongs.find(s=>s.id===song)!.title;
const compilerRoot=resolve(arg('compiler-root','.')!);
const compiler=galleryCompilerIdentity(compilerRoot),judge=judgeIdentity(),jolt=resolveJoltMs();
const enginePath='engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm';
assert.equal(sha(readFileSync(join(compilerRoot,enginePath))),sha(readFileSync(enginePath)),'candidate physics differs from the frozen native engine');
const {compileHandoff}:typeof import('../v0/optimizer/handoff.ts')=await import(pathToFileURL(join(compilerRoot,'scripts/v0/optimizer/handoff.ts')).href);
const paths=['scripts/produce/automatic.ts','scripts/produce/music_artifacts.ts','scripts/gallery/repertoire_catalog.ts',
 'scripts/gallery/artifacts.ts','scripts/gallery/contact_impact_grade.ts','scripts/lib/contact_impact.ts','scripts/v0/optimizer/impact_search.ts','scripts/gallery/contacts.ts','scripts/gallery/verify_construction.ts',
 'scripts/produce/jolt.ts','scripts/produce/config.ts','scripts/produce/measure.ts',
 'scripts/v0/optimizer/arc_geometry.ts','scripts/v0/optimizer/motion_profiles.ts','scripts/v0/optimizer/arc_motion_control.ts'];
const harness=galleryHarnessIdentity(paths);
const {spec,musicCase:c}=await loadMusicCase({song,title,excerpt:[0,Math.min(16,repertoireSongs.find(s=>s.id===song)!.duration)],intent:'Seeded whole-track arrangement',moments:[]},jolt);
const methodDetails={production:{title:'Automatic arrangement',description:'The same music with a seeded, repeated repertoire plan.'}};
const plan={schema:'line.automatic-production.v1',kind:'musical-direction',compilerRoot,compiler,judge,harness,jolt,impactContract,
 cases:[c],seeds:[seed],budgets:[budget],methods:['production'],methodDetails,request};
const planSha256=writeGalleryJson(out,'plan.json',plan);
if(referenceBudget)throw new Error('the ordinary reference compiler is retired; omit --reference-budget');
const began=performance.now(),checkpoint=compileHandoff(spec,seed,{budget,creative,impactContract,phraseBoundaries:c.phases.map((p:any)=>p.t0??p.t??p.start).filter((t:any)=>Number.isFinite(t))}),compileMs=performance.now()-began;
const repertoire=checkpoint.repertoire!;
const {result,...production}=repertoire;
const phrases=repertoire.plan.phrases.map(p=>{const requests=repertoire.plan.requests.slice(p.first,p.first+p.count);return {...p,title:p.construction,
 window:[requests[0].frame/40,Math.min(spec.duration,requests.at(-1)!.next/40)],sections:requests.map(r=>r.section)};});
const alternative=saveMusicCell({out,planSha256,c,method:'production',seed,budget,allowance:budget,result,reference:null,referenceTrace:null,
 compileMs,physicalFrames:repertoire.physicalFrames,production,styles:repertoire.styles,phrases,work:checkpoint.work});
assert.deepEqual(galleryCompilerIdentity(compilerRoot),compiler,'compiler changed during generation');assert.deepEqual(judgeIdentity(),judge);assert.deepEqual(galleryHarnessIdentity(paths),harness);
const current=await loadMusicCase({song,title,moments:[]},jolt);for(const key of ['specSha256','audioSha256','analysisSha256'] as const)assert.equal(current.musicCase[key],c[key],'authored input changed during generation');
const cells=[alternative.cell],accounting={actualCompilationFrames:repertoire.physicalFrames,productionFrames:repertoire.physicalFrames,productionAllowance:budget,
 validation:'Independent judging and rendering are separate. The production allowance includes all construction, failed proposals, observation and compiler replay.'};
writeGalleryJson(out,'manifest.json',{schema:'line.motion-gallery.v1',planSha256,plan,cells,sets:[accounting],
 summary:cells.map(cell=>({method:cell.method,valid:Number(cell.valid),runs:1,meanScore:cell.score.score})),processElapsedMs:process.uptime()*1000});
console.log(JSON.stringify({complete:true,out,valid:alternative.cell.valid,qualified:repertoire.qualified,score:alternative.cell.score.score,seconds:compileMs/1000,accounting}));
