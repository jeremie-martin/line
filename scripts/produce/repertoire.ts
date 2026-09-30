/** Compile an editable composition using the shared music artifact/render contract.
 * Usage: LR_ENGINE=wasm node --import tsx scripts/produce/repertoire.ts --request=FILE --out=DIR */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,renameSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
import {compileArcMotion} from '../v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../v0/optimizer/connected_arcs.ts';
import {composeRepertoire} from '../v0/optimizer/repertoire_composition.ts';
import {validateRepertoireRequest,repertoireSongs} from '../gallery/repertoire_catalog.ts';
import {galleryCompilerIdentity,galleryHarnessIdentity,writeGalleryJson} from '../gallery/artifacts.ts';
import {loadMusicCase,saveMusicCell} from './music_artifacts.ts';
import {resolveJoltMs} from './seed.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('request')&&arg('out'),'--request and --out required');
const request=validateRepertoireRequest(JSON.parse(readFileSync(resolve(arg('request')!),'utf8')));
const out=resolve(arg('out')!);mkdirSync(out,{recursive:true});
if(existsSync(join(out,'manifest.json')))throw new Error('preserve completed outputs; select a fresh output directory');
const {composition,seed,baselineBudget,compositionBudget}=request,song=repertoireSongs.find(s=>s.id===composition.song)!;
const compiler=galleryCompilerIdentity(process.cwd()),judge=verifyFrozen(),jolt=resolveJoltMs();
const harnessPaths=['scripts/produce/repertoire.ts','scripts/produce/music_artifacts.ts','scripts/gallery/repertoire_catalog.ts',
 'scripts/gallery/artifacts.ts','scripts/gallery/contacts.ts','scripts/gallery/verify_construction.ts','scripts/produce/seed.ts','scripts/produce/measure.ts'];
const harness=galleryHarnessIdentity(harnessPaths);
const {spec,musicCase:c}=await loadMusicCase({song:song.id,title:song.title,excerpt:[Math.max(0,(composition.phrases[0]?.start??0)-1),Math.min(song.duration,(composition.phrases.at(-1)?.end??song.duration)+2)],
 intent:composition.title,moments:composition.phrases.map(p=>({title:p.title,time:p.start,from:Math.max(0,p.start-.5),to:Math.min(song.duration,p.end+1)}))},jolt);
const methods=['baseline','composition'],methodDetails={baseline:{title:'Production baseline',description:'Ordinary production compilation.'},composition:{title:composition.title,description:'The saved phrase arrangement, searched with unchanged musical targets.'}};
const plan={schema:'line.repertoire-study.v1',kind:'musical-direction',compilerRoot:process.cwd(),compiler,judge,harness,jolt,cases:[c],seeds:[seed],budgets:[baselineBudget],compositionBudget,
 methods,methodDetails,composition,search:{initialRecoverySamples:80},request};
const planSha256=writeGalleryJson(out,'plan.json',plan);
// Only exact compiler, authored inputs and settings share a source. A cache hit
// retains its original cost and provenance; this request reports reuse separately.
const cacheRoot=resolve('generated/repertoire-source-cache');mkdirSync(cacheRoot,{recursive:true});
const sourceKey=sha(JSON.stringify({compiler,judge,jolt,spec:c.specSha256,analysis:c.analysisSha256,seed,baselineBudget}));
const cachePath=join(cacheRoot,sourceKey+'.json');let reference:any,cached=false,sourceCompileMs=0;
if(existsSync(cachePath)&&existsSync(cachePath+'.sha256')){
 const bytes=readFileSync(cachePath);assert.equal(sha(bytes),readFileSync(cachePath+'.sha256','utf8').trim());
 const saved=JSON.parse(bytes.toString());assert.equal(saved.sourceKey,sourceKey);reference=saved.result;sourceCompileMs=saved.compileMs;cached=true;
}else{
 const began=performance.now();reference=compileArcMotion(spec,seed,{...connectedArcOptions(spec,baselineBudget),collectTrajectoryLoss:true});sourceCompileMs=performance.now()-began;
 const temp=sourceKey+'-'+process.pid+'.json';writeGalleryJson(cacheRoot,temp,{sourceKey,result:reference,compileMs:sourceCompileMs});
 renameSync(join(cacheRoot,temp),cachePath);renameSync(join(cacheRoot,temp+'.sha256'),cachePath+'.sha256');
}
const baseline=saveMusicCell({out,planSha256,c,method:'baseline',seed,budget:baselineBudget,allowance:baselineBudget,result:reference,reference,referenceTrace:null,
 compileMs:sourceCompileMs,physicalFrames:reference.stats.sim_frames});
console.log(JSON.stringify({stage:'baseline',cached,valid:baseline.cell.valid,physicalFrames:reference.stats.sim_frames}));
if(!baseline.cell.valid)throw new Error('baseline is incomplete; inspect the preserved baseline record');
const began=performance.now(),composed=composeRepertoire(spec,seed,reference,composition,compositionBudget,plan.search),compileMs=performance.now()-began;
const alternative=saveMusicCell({out,planSha256,c,method:'composition',seed,budget:compositionBudget,allowance:compositionBudget,result:composed.result,reference,referenceTrace:baseline.trace,
 compileMs,physicalFrames:composed.physicalFrames,composition:composed,styles:composed.styles,
 phrases:composed.phrases.map(p=>({...p,window:[p.start,p.end],construction:p.recipe==='scattered'?'fragments':'connected'}))});
assert.deepEqual(galleryCompilerIdentity(process.cwd()),compiler,'compiler changed during compilation');assert.deepEqual(verifyFrozen(),judge);assert.deepEqual(galleryHarnessIdentity(harnessPaths),harness);
const cells=[baseline.cell,alternative.cell],accounting={sourceKey,sourceReused:cached,sourceOriginalFrames:reference.stats.sim_frames,
 actualCompilationFrames:(cached?0:reference.stats.sim_frames)+composed.physicalFrames,compositionFrames:composed.physicalFrames,compositionAllowance:compositionBudget,
 validation:'Independent cold evaluation and rendering are outside the compiler work allowance.'};
writeGalleryJson(out,'manifest.json',{schema:'line.motion-gallery.v1',planSha256,plan,cells,sets:[accounting],summary:cells.map(cell=>({method:cell.method,valid:Number(cell.valid),runs:1,meanScore:cell.score.score})),processElapsedMs:process.uptime()*1000});
console.log(JSON.stringify({complete:true,out,valid:alternative.cell.valid,rms:alternative.cell.qualityRms,seconds:compileMs/1000,accounting}));
