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
import {normalizeCompilerTimeline} from '../v0/optimizer/compiler_input.ts';
import {sliceTimeline,effectiveAxes,axesAtFrame} from '../v0/core/substrate.ts';
import {extractTrace} from '../v0/core/trace.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {guideFootprint} from '../v0/optimizer/arc_guide_choice.ts';
import {inspectRailContacts} from '../gallery/contacts.ts';
import {galleryCompilerIdentity,galleryHarnessIdentity,replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
import {applyJolt,resolveJoltMs} from './seed.ts';
import {loadSelect} from './config.ts';
import {measure} from './measure.ts';
import {galleryMethods,galleryArcOptions,type GalleryMethod} from '../gallery/methods.ts';
import {verifyMainConstruction} from '../gallery/verify_construction.ts';
import {musicalDirectionCases,musicalDirectionMethods,repertoireConfirmationCase,repertoireContactReuseCase} from './musical_direction_cases.ts';
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
const allCases=[...musicalDirectionCases,arg('reuse-passages')==='contacts'?repertoireContactReuseCase:repertoireConfirmationCase];
assert.ok(songs.every(s=>allCases.some(c=>c.song===s)));
const repertoire=arg('repertoire');
assert.ok(!repertoire||['serpentine','terraces','contacts'].includes(repertoire),'unsupported repertoire candidate');
const definitions=allCases.filter(c=>songs.includes(c.song));
const geometry=(repertoire==='contacts'?'scallops':repertoire)??arg('geometry')??'facets';
assert.ok(['facets','serpentine','terraces','scallops'].includes(geometry),'unsupported local geometry');
const {profile,subdivisions}=galleryArcOptions(geometry as GalleryMethod)!;
const strength=arg('strength')===undefined?undefined:Number(arg('strength'));
assert.ok(strength===undefined||(profile&&Number.isFinite(strength)&&strength>=0&&strength<=2),'strength requires a profile and must be in [0, 2]');
const geometryStyle={...(profile?{profile}:{}),...(subdivisions?{subdivisions}:{}),...(strength===undefined?{}:{profileStrength:strength})};
const profileStart=arg('profile-start')===undefined?undefined:Number(arg('profile-start'));
const rippleCycles=arg('ripple-cycles')===undefined?undefined:Number(arg('ripple-cycles'));
Object.assign(geometryStyle,{...(profileStart===undefined?{}:{profileStart}),...(rippleCycles===undefined?{}:{rippleCycles})});
const fragmentWidths=(arg('fragment-widths')??'.003').split(',').map(Number);
const geometryTitle=galleryMethods[geometry as GalleryMethod].title;
const methodDetails:Record<string,{title:string;description:string}>=repertoire==='contacts'?{
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
  const cfg=loadSelect(join('productions',d.song)),module=await import(pathToFileURL(cfg.spec).href);
  const spec=normalizeCompilerTimeline(applyJolt(module.default,jolt));specs.set(d.song,spec);configs.set(d.song,cfg);
  const durationFrames=Math.round(spec.duration*40),contacts=spec.contacts.map(c=>({frame:Math.round(c.t*40),impact:c.impact}));
  const gaps=sliceTimeline(contacts.map(c=>c.frame),durationFrames);
  // Only the frozen evaluator's input fields are needed here. This is a sampled
  // production request, not a benchmark catalog Case: do not quantize/repair air.
  const air=gaps.map(g=>({gap:g.index,target:effectiveAxes(g,spec).air}));
  assert.ok(air.every(a=>Number.isFinite(a.target)),'musical study requires authored air throughout');
  const samples=Object.fromEntries((['speed','amplitude'] as const).filter(a=>spec.axes[a]).map(a=>[a,
    Array.from({length:durationFrames+1},(_,f)=>axesAtFrame(f,spec)[a]??null)]));
  return {...d,...(repertoire&&repertoire!=='contacts'?{intent:`Compare arcs, ripples and ${geometryTitle.toLowerCase()} on the same two phrases; combine ${geometryTitle.toLowerCase()} in the first with ripples in the second.`}:{}),id:d.song,durationFrames,contacts,air,samples,phases:module.overlayMeta?.phases??[],
    source:relative(process.cwd(),cfg.spec),specSha256:hash(cfg.spec),audioPath:relative(process.cwd(),cfg.audio),audioSha256:hash(cfg.audio),
    analysisSha256:hash(join('productions',d.song,'audio.json')),render:cfg.render,jitter:spec.jitter??0};
}));
const compiler=galleryCompilerIdentity(compilerRoot),judge=verifyFrozen();
const harnessPaths=['scripts/produce/musical_direction.ts','scripts/produce/musical_direction_cases.ts',
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
    if(repertoire==='contacts'&&method!=='baseline'){
      const first={title:c.moments[0].title,window:c.guidance,style:geometryStyle};
      const later={title:'Later phrase',window:c.mixed,style:geometryStyle};
      if(method==='ripple'){
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
    const validationStarted=performance.now();
    const {grade,trace,collisionIds}=replayGalleryTrack(result.track,c as unknown as Case,true);
    const fragmentSections:number[]=composition?.fragmentSections??[],railLayout=fragmentSections.length?'mixed':'connected';
    const railGuides=composition?.railGuides;
    const groups=arcRailGroups(result.track.lines.filter((l:any)=>!fragmentSections.includes(Math.floor((l.id-1000)/10000))));
    const inspection=inspectRailContacts({method,railLayout,railGuides,track:result.track},collisionIds!);
    const usage=railLayout==='connected'?guideFootprint(result.track.lines):{supportSections:inspection.summary.supportSections!,guideSections:inspection.summary.guideSections,
      guideLength:result.track.lines.filter((l:any)=>inspection.guideIds.has(l.id)).reduce((sum:number,l:any)=>sum+Math.hypot(l.x2-l.x1,l.y2-l.y1),0)};
    const valid=result.report.terminus.reason==='endOfSpec'&&!result.report.off_beat_landings.length&&result.report.contacts.every((x:any)=>x.status==='hit');
    assert.equal(valid,grade.score.valid,'compiler and frozen judge disagree');
    if(valid)assert.ok(Math.abs(Math.sqrt(result.trajectoryLoss)-grade.score.weightedAxisRms!)<1e-10,'target adapter changed the objective');
    const geometryVerification=verifyMainConstruction(result.track,result.rows,{radius:24,channel:12,
      ...(method===geometry?geometryStyle:{}),sectionStyles:styles,fragmentSections},composition?.fragmentConstruction?Math.max(...fragmentSections)+1:composition?.changedSections[0]??0);
    const sections=result.rows.map((r:any,i:number)=>{
      const chains=groups.get(i)??[],fragmented=fragmentSections.includes(i),sectionLines=result.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===i);
      const normal=fragmented?sectionLines.filter((l:any)=>!inspection.guideIds.has(l.id)):chains[0]??[];
      const guides=fragmented?sectionLines.filter((l:any)=>inspection.guideIds.has(l.id)):chains[1]??[];
      const guideIds=new Set<number>(guides.map((l:any)=>l.id)),mainIds=new Set<number>(normal.map((l:any)=>l.id));
      const guideFrames=collisionIds!.flatMap((ids,f)=>ids.some(id=>guideIds.has(id))?[f]:[]);
      const mainFrames=collisionIds!.flatMap((ids,f)=>ids.some(id=>mainIds.has(id))?[f]:[]);
      const subdivision=styles[i]?.subdivisions??(method===geometry?(subdivisions??4):4);
      if(!fragmented&&i>=(composition?.fragmentConstruction?Math.max(...fragmentSections)+1:composition?.changedSections[0]??0))assert.equal(normal.length,1+Math.max(4,Math.ceil(r.control.support*subdivision)),'emitted shape differs from requested construction');
      if(styles[i]?.guides===false)assert.equal(guides.length,0,'forbidden guide emitted');
      return {section:i,start:r.frame/40,end:(result.rows[i+1]?.frame??c.durationFrames)/40,
        shape:fragmented?'fragments':styles[i]?.profile??(method===geometry?profile:undefined)??(subdivision===.5?'facets':'arcs'),
        profileStrength:styles[i]?.profileStrength??(method===geometry?strength:undefined)??1,
        guidePermission:styles[i]?.guides===false?'forbidden':'allowed',
        mainSegments:normal.length,guideSegments:guides.length,mainContactFrames:mainFrames.length,guideContactFrames:guideFrames.length,
        firstGuideContact:guideFrames[0]===undefined?null:guideFrames[0]/40,lastGuideContact:guideFrames.length?guideFrames.at(-1)!/40:null};
    });
    let prefixFrames=0,changedMotionFrames=0;
    if(method==='baseline')referenceTrace=trace;
    else{
      for(let f=0;f<Math.min(trace.frames.length,referenceTrace.frames.length);f++){
        const same=JSON.stringify(trace.frames[f])===JSON.stringify(referenceTrace.frames[f]);
        if(composition&&f<=composition.boundaryFrame){assert.ok(same,'earlier native rider history changed');prefixFrames++;}
        if(!same)changedMotionFrames++;
      }
    }
    const metrics=measure(seed,result.track,result.report,extractTrace(result.track));
    const id=`${c.id}-${seed}-${method}`,dir=join(out,id);mkdirSync(dir,{recursive:true});
    const save=(name:string,value:unknown)=>writeGalleryJson(dir,name,value);
    save('track.json',result.track);save('report.json',result.report);
    save('construction.json',{rows:result.rows,stats:result.stats,attempts:result.attempts,proposalDecision:result.proposalDecision,
      failure:result.failure,styles,fragmentSections,fragmentConstruction:composition?.fragmentConstruction,...(composition?{boundaryFrame:composition.boundaryFrame,prefixSha256:composition.prefixSha256,stateSha256:composition.stateSha256}:{})});
    save('budget-telemetry.json',{schema:'line.musical-direction-budget.v1',budget:allowance,physicalFrames,
      preparationFrames:composition?.preparationFrames??0,constructionFrames:result.stats.sim_frames,
      includes:'All search and cold replay work for this alternative, plus prefix preparation. Baseline creation is accounted once in the comparison set. Independent evaluation and rendering are separate.'});
    const cell={id,caseId:c.id,method,railLayout,railGuides,seed,jitter:c.jitter,budget,allowance,score:grade.score,
      compileMs,physicalFrames,validationMs:performance.now()-validationStarted,lines:result.track.lines.length,
      trackHash:sha(JSON.stringify(result.track)),observations:grade.observations,contacts:grade.contacts,offBeat:grade.offBeat,
      terminus:grade.terminus,failure:result.failure,valid,qualityRms:grade.score.weightedAxisRms,usage,sections,
      geometryVerification,contactSummary:inspection.summary,collisionSha256:sha(JSON.stringify(collisionIds)),metrics,
      construction:{styles,phrases,fragmentSections,fragmentConstruction:composition?.fragmentConstruction,boundaryFrame:composition?.boundaryFrame??null,prefixFrames,changedMotionFrames,
        changedSections:composition?.changedSections??[],baseTrackHash:method==='baseline'?null:sha(JSON.stringify(reference.track))},
      trackPath:relative(out,join(dir,'track.json')),reportPath:relative(out,join(dir,'report.json')),
      moments:c.moments.map(m=>({...m,observations:grade.observations.filter(o=>o.endFrame>=m.from*40&&o.startFrame<=m.to*40)}))};
    const path=id+'.json',digest=write(path,{schema:'line.motion-gallery-cell.v1',planSha256,...cell,case:c,track:result.track,trace});
    const saved={...cell,path,sha256:digest};cells.push(saved);byMethod.set(method,saved);
    console.log(JSON.stringify({id,valid,score:grade.score.score,rms:cell.qualityRms,physicalFrames,seconds:compileMs/1000,
      guided:usage.guideSections,changedSections:cell.construction.changedSections,prefixFrames,changedMotionFrames}));
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
