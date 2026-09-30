import {loadMusicCase,saveMusicCell} from './music_artifacts.ts';
/** Compile a small real-music comparison, preserving exact tracks for both the
 * native gallery and production renderer. All authored targets remain unchanged.
 * Example: LR_ENGINE=wasm node --import tsx scripts/produce/musical_direction.ts
 * --out=generated/musical-direction/RUN --seeds=301 --songs=luna_bala_44s */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha,type Case} from '../../benchmark/v3/model.ts';
import {verifyFrozen} from '../../benchmark/v4/contract.ts';
import {galleryCompilerIdentity,galleryHarnessIdentity,writeGalleryJson} from '../gallery/artifacts.ts';
import {resolveJoltMs} from './seed.ts';
import {loadSelect} from './config.ts';
import {galleryMethods,galleryArcOptions,type GalleryMethod} from '../gallery/methods.ts';
import {musicalDirectionCases,musicalDirectionMethods,repertoireConfirmationCase,repertoireContactReuseCase,repertoireFoldReuseCase} from './musical_direction_cases.ts';
import {stylesForPhrases,type ConstructionPhrase} from './musical_repertoire.ts';
import type {Spec} from '../v0/types.ts';
import type {ArcMotionOptions} from '../v0/optimizer/arc_motion.ts';

const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('out'),'--out required');
const out=resolve(arg('out')!),compilerRoot=resolve(arg('compiler-root')??'.');
const seeds=(arg('seeds')??'301').split(',').map(Number),budget=Number(arg('budget')??1000000);
const compositionBudget=Number(arg('composition-budget')??budget);
assert.ok(seeds.length&&seeds.every(Number.isSafeInteger)&&new Set(seeds).size===seeds.length);
assert.ok(Number.isSafeInteger(budget)&&budget>=20000);
assert.ok(Number.isSafeInteger(compositionBudget)&&compositionBudget>=20000&&compositionBudget<=budget);
const songs=(arg('songs')??musicalDirectionCases.map(c=>c.song).join(',')).split(',');
const allCases=[...musicalDirectionCases,arg('reuse-passages')==='fold'?repertoireFoldReuseCase:arg('reuse-passages')==='contacts'?repertoireContactReuseCase:repertoireConfirmationCase];
assert.ok(songs.every(s=>allCases.some(c=>c.song===s)));
const repertoire=arg('repertoire');
assert.ok(!repertoire||['serpentine','terraces','contacts','fold'].includes(repertoire),'unsupported repertoire candidate');
const definitions=allCases.filter(c=>songs.includes(c.song));
const geometry=(repertoire==='contacts'?'scallops':repertoire)??arg('geometry')??'facets';
assert.ok(['facets','serpentine','terraces','scallops','fold'].includes(geometry),'unsupported local geometry');
const {profile,subdivisions,faces:defaultFaces,profileStart:defaultProfileStart,foldAngle:defaultFoldAngle}=galleryArcOptions(geometry as GalleryMethod)!;
const strength=arg('strength')===undefined?undefined:Number(arg('strength'));
assert.ok(strength===undefined||(profile&&Number.isFinite(strength)&&strength>=0&&strength<=2),'strength requires a profile and must be in [0, 2]');
const geometryStyle={...(profile?{profile}:{}),...(subdivisions?{subdivisions}:{}),...(strength===undefined?{}:{profileStrength:strength})};
const profileStart=arg('profile-start')===undefined?defaultProfileStart:Number(arg('profile-start'));
const rippleCycles=arg('ripple-cycles')===undefined?undefined:Number(arg('ripple-cycles'));
const faces=arg('faces')===undefined?defaultFaces:Number(arg('faces'));
const foldAngle=arg('fold-angle')===undefined?defaultFoldAngle:Number(arg('fold-angle'));
Object.assign(geometryStyle,{...(profileStart===undefined?{}:{profileStart}),...(rippleCycles===undefined?{}:{rippleCycles}),
  ...(faces===undefined?{}:{faces}),...(foldAngle===undefined?{}:{foldAngle})});
const fragmentWidths=(arg('fragment-widths')??'.003').split(',').map(Number);
const geometryTitle=galleryMethods[geometry as GalleryMethod].title;
const methodDetails:Record<string,{title:string;description:string}>=repertoire==='fold'?{
  baseline:musicalDirectionMethods.baseline,
  ripple:{title:'Subtle ripple reference',description:'The preceding one-wave ripple at strength 0.6 in both phrases, with ordinary arcs elsewhere.'},
  candidate:{title:'Folded phrases',description:'Three connected faces with a deliberately angled middle face, searched against unchanged musical targets.'},
  mixed:{title:'Scattered → arcs → folded',description:'Scattered normal contacts in the first phrase, folded connected rails later, with a searched return to ordinary arcs.'},
}:repertoire==='contacts'?{
  baseline:musicalDirectionMethods.baseline,
  ripple:{title:'Broad ripple phrases',description:'Explicit ripple placement and wave count in both phrases, with ordinary arcs elsewhere.'},
  candidate:{title:'Scattered phrase',description:'Measured normal contact fragments in the first phrase; the return is searched from their actual exit state.'},
  mixed:{title:'Scattered → arcs → ripple',description:'Contact fragments in the first phrase, a shaped ripple later, and ordinary arcs between and afterwards.'},
}:repertoire?{
  baseline:musicalDirectionMethods.baseline,
  ripple:{title:'Ripple phrases',description:'Ripple rails in both selected phrases; ordinary arcs elsewhere.'},
  candidate:{title:geometryTitle+' phrases',description:geometryTitle+' in both selected phrases; ordinary arcs elsewhere.'},
  mixed:{title:geometryTitle+' + ripples',description:'The first phrase uses '+geometryTitle.toLowerCase()+', the later phrase uses ripples, with ordinary arcs between and afterwards.'},
}:{baseline:musicalDirectionMethods.baseline,guidance:musicalDirectionMethods.guidance,
  [geometry]:{title:geometryTitle+' throughout',description:'An independent complete ride searched with '+geometryTitle.toLowerCase()+'.'},
  mixed:{title:'Arcs → '+geometryTitle.toLowerCase()+' → arcs',description:'The selected phrase uses '+geometryTitle.toLowerCase()+', then returns to smooth construction. Earlier history is locked; the continuation is searched.'}};
const methods=arg('methods')?.split(',')??Object.keys(methodDetails);
assert.ok(methods[0]==='baseline'&&new Set(methods).size===methods.length&&methods.every(m=>methodDetails[m]),'methods must begin with baseline');
const {compileArcMotion}=await import(pathToFileURL(join(compilerRoot,'scripts/v0/optimizer/arc_motion.ts')).href);
const {connectedArcOptions}=await import(pathToFileURL(join(compilerRoot,'scripts/v0/optimizer/connected_arcs.ts')).href);
const {composeScatteredPhrase}=await import(pathToFileURL(join(compilerRoot,'scripts/v0/optimizer/contact_composition.ts')).href);
const {composeArcSections}=await import(pathToFileURL(join(compilerRoot,'scripts/v0/optimizer/arc_composition.ts')).href);
const jolt=resolveJoltMs(),specs=new Map<string,Spec>(),configs=new Map<string,ReturnType<typeof loadSelect>>();
const hash=(path:string)=>sha(readFileSync(path));
const cases=await Promise.all(definitions.map(async d=>{
  const definition={...d,...(repertoire==='fold'?{intent:'Compare ordinary arcs, subtle ripples and folded rails on shared phrases; combine scattered contacts in the first phrase with folded rails later.'}:
    repertoire&&repertoire!=='contacts'?{intent:`Compare arcs, ripples and ${geometryTitle.toLowerCase()} on the same two phrases; combine ${geometryTitle.toLowerCase()} in the first with ripples in the second.`}:{})};
  const {spec,cfg,musicCase}=await loadMusicCase(definition,jolt);specs.set(d.song,spec);configs.set(d.song,cfg);return musicCase;
}));
const compiler=galleryCompilerIdentity(compilerRoot),judge=verifyFrozen();
const harnessPaths=['scripts/produce/musical_direction.ts','scripts/produce/music_artifacts.ts','scripts/produce/musical_direction_cases.ts',
  'scripts/produce/musical_repertoire.ts','scripts/v0/optimizer/contact_composition.ts',
  'scripts/gallery/artifacts.ts','scripts/gallery/contacts.ts','scripts/gallery/methods.ts','scripts/gallery/verify_construction.ts','scripts/produce/seed.ts','scripts/produce/measure.ts'];
const harness=galleryHarnessIdentity(harnessPaths);
const plan={schema:'line.musical-direction-plan.v1',kind:'musical-direction',compilerRoot,compiler,judge,harness,
  cases,seeds,budgets:[budget],compositionBudget,methods,methodDetails,geometry,geometryStyle,fragmentWidths,jolt,repertoire:repertoire??null,
  note:'Real music, unchanged authored targets, normal lines only. Full tracks are compiled and independently validated. Local changes lock earlier geometry and rebuild the complete continuation. No aesthetic approval is implied. Each alternative has its own stated allowance; shared baseline work is counted once per comparison set.'};
mkdirSync(out,{recursive:true});
const write=(name:string,value:unknown)=>writeGalleryJson(out,name,value);
if(existsSync(join(out,'plan.json')))assert.deepEqual(JSON.parse(readFileSync(join(out,'plan.json'),'utf8')),plan,'output belongs to another input or compiler');
else write('plan.json',plan);
const planSha256=hash(join(out,'plan.json')),cells:any[]=[],sets:any[]=[];
for(const c of cases)for(const seed of seeds){
  const setPath=`${c.id}-${seed}.set.json`;
  if(existsSync(join(out,setPath))){
    const saved=JSON.parse(readFileSync(join(out,setPath),'utf8'));assert.equal(hash(join(out,setPath)),readFileSync(join(out,setPath+'.sha256'),'utf8').trim());
    assert.equal(saved.planSha256,planSha256);
    for(const cell of saved.cells){assert.equal(hash(join(out,cell.path)),cell.sha256);cells.push(cell);}
    sets.push(saved.accounting);continue;
  }
  const spec=specs.get(c.id)!,cfg=configs.get(c.id)!,byMethod=new Map<string,any>();
  let reference:any,referenceTrace:any,compileWork=0,totalMs=0;
  for(const method of methods){
    const began=performance.now();let composition:any=null;
    let styles:NonNullable<ArcMotionOptions['sectionStyles']>={};
    let phrases:ConstructionPhrase[]=[];
    if((repertoire==='contacts'||repertoire==='fold')&&method!=='baseline'){
      const shape=repertoire==='fold'&&method==='ripple'?{profile:'scallops' as const,profileStrength:.6,profileStart:0,rippleCycles:1}:geometryStyle;
      const first={title:c.moments[0].title,window:c.guidance,style:shape};
      const later={title:'Later phrase',window:c.mixed,style:shape};
      if(method==='ripple'||repertoire==='fold'&&method==='candidate'){
        phrases=[first,later];styles=stylesForPhrases(reference.rows,phrases);
        composition=composeArcSections(spec,seed,reference,styles,compositionBudget);
      }else{
        const selected=stylesForPhrases(reference.rows,[{...first,style:{}}]);
        styles=method==='mixed'?stylesForPhrases(reference.rows,[later]):{};
        composition=composeScatteredPhrase(spec,seed,reference,Object.keys(selected).map(Number),fragmentWidths,compositionBudget,styles);
        phrases=[{...first,style:{},construction:'fragments'} as any,...(method==='mixed'?[later]:[])];
      }
    }else if(repertoire&&method!=='baseline'){
      const ripple={profile:'scallops' as const};
      phrases=[{title:c.moments[0].title,window:c.guidance,style:method==='ripple'?ripple:geometryStyle},
        {title:c.moments[2].title,window:c.mixed,style:method==='candidate'?geometryStyle:ripple}];
      styles=stylesForPhrases(reference.rows,phrases);
      composition=composeArcSections(spec,seed,reference,styles,compositionBudget);
    }else if(!repertoire&&(method==='mixed'||method==='guidance')){
      const window=c[method],style=method==='mixed'?geometryStyle:{guides:false};
      phrases=[{title:methodDetails[method].title,window,style}];
      styles=stylesForPhrases(reference.rows,phrases);
      composition=composeArcSections(spec,seed,reference,styles,compositionBudget);
    }
    const result=composition?.result??compileArcMotion(spec,seed,{...connectedArcOptions(spec,budget),collectTrajectoryLoss:true,
      ...(method===geometry?geometryStyle:{})});
    const compileMs=performance.now()-began,physicalFrames=composition?.physicalFrames??result.stats.sim_frames;
    const allowance=composition?compositionBudget:budget;
    assert.ok(physicalFrames<=allowance);compileWork+=physicalFrames;totalMs+=compileMs;
    if(method==='baseline')reference=result;
    const {cell:saved,trace}=saveMusicCell({out,planSha256,c,method,seed,budget,allowance,result,reference,referenceTrace,
      compileMs,physicalFrames,composition,styles,phrases,geometry,geometryStyle,subdivisions,faces,profile,strength});
    if(method==='baseline')referenceTrace=trace;
    cells.push(saved);byMethod.set(method,saved);
    console.log(JSON.stringify({id:saved.id,valid:saved.valid,score:saved.score.score,rms:saved.qualityRms,physicalFrames,
      seconds:compileMs/1000,guided:saved.usage.guideSections,changedSections:saved.construction.changedSections,
      prefixFrames:saved.construction.prefixFrames,changedMotionFrames:saved.construction.changedMotionFrames}));
  }
  const accounting={caseId:c.id,seed,allowances:Object.fromEntries([...byMethod].map(([method,c])=>[method,c.allowance])),
    totalAllowance:[...byMethod.values()].reduce((sum,c)=>sum+c.allowance,0),physicalFrames:compileWork,compileMs:totalMs};
  assert.ok(compileWork<=accounting.totalAllowance);sets.push(accounting);
  write(setPath,{planSha256,cells:[...byMethod.values()],accounting});
}
assert.deepEqual(galleryCompilerIdentity(compilerRoot),compiler);assert.deepEqual(verifyFrozen(),judge);
assert.deepEqual(galleryHarnessIdentity(harnessPaths),harness);
const summary=methods.map(method=>{const rows=cells.filter(c=>c.method===method);return {method,budget,runs:rows.length,
  valid:rows.filter(c=>c.valid).length,meanScore:rows.reduce((s,r)=>s+r.score.score,0)/rows.length,
  totalPhysicalFrames:rows.reduce((s,r)=>s+r.physicalFrames,0),totalCompileMs:rows.reduce((s,r)=>s+r.compileMs,0)};});
write('manifest.json',{schema:'line.motion-gallery.v1',planSha256,plan,cells,sets,summary,
  processElapsedMs:process.uptime()*1000,elapsedNote:'Includes module loading, input identity checks, all compilation, independent validation and artifact writing; excludes rendering. Resumed runs cover only work performed by this process.'});
console.log(JSON.stringify({complete:true,out,tracks:cells.length}));
