/** Shared faithful music artifacts for fixed studies and editable compositions. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha,type Case} from '../../benchmark/v3/model.ts';
import {normalizeCompilerTimeline} from '../v0/optimizer/compiler_input.ts';
import {sliceTimeline,effectiveAxes,axesAtFrame} from '../v0/core/substrate.ts';
import {extractTrace} from '../v0/core/trace.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {arcMainSteps} from '../v0/optimizer/arc_geometry.ts';
import {guideFootprint} from '../v0/optimizer/arc_guide_choice.ts';
import {inspectRailContacts} from '../gallery/contacts.ts';
import {replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
import {verifyMainConstruction} from '../gallery/verify_construction.ts';
import {validRide} from '../v0/optimizer/ride_validity.ts';
import {applyJolt} from './seed.ts';
import {loadSelect} from './config.ts';
import {measure} from './measure.ts';
import {contactImpactGrade} from '../gallery/contact_impact_grade.ts';

export async function loadMusicCase(definition:any,jolt:number){
  const cfg=loadSelect(join('productions',definition.song)),module=await import(pathToFileURL(cfg.spec).href);
  const spec=normalizeCompilerTimeline(applyJolt(module.default,jolt));
  const durationFrames=Math.round(spec.duration*40),contacts=spec.contacts.map(c=>({frame:Math.round(c.t*40),impact:c.impact}));
  const gaps=sliceTimeline(contacts.map(c=>c.frame),durationFrames);
  const air=gaps.map(g=>({gap:g.index,target:effectiveAxes(g,spec).air}));
  assert.ok(air.every(a=>Number.isFinite(a.target)),'music review requires authored air throughout');
  const samples=Object.fromEntries((['speed','amplitude'] as const).filter(a=>spec.axes[a]).map(a=>[a,
    Array.from({length:durationFrames+1},(_,f)=>axesAtFrame(f,spec)[a]??null)]));
  const hash=(p:string)=>sha(readFileSync(p));
  const musicCase={...definition,id:definition.song,durationFrames,contacts,air,samples,phases:module.overlayMeta?.phases??[],
    source:relative(process.cwd(),cfg.spec),specSha256:hash(cfg.spec),audioPath:relative(process.cwd(),cfg.audio),audioSha256:hash(cfg.audio),
    analysisSha256:hash(join('productions',definition.song,'audio.json')),render:cfg.render,jitter:spec.jitter??0};
  return {spec,cfg,musicCase};
}
/** Keep the established cell/manifest contract shared by both native and production renderers. */
export function saveMusicCell(args:{out:string;planSha256:string;c:any;method:string;seed:number;budget:number;allowance:number;
 result:any;reference:any;referenceTrace:any;compileMs:number;physicalFrames:number;composition?:any;production?:any;budgetTelemetry?:any;
 styles?:any;phrases?:any[];geometry?:string;geometryStyle?:any;subdivisions?:number;faces?:number;profile?:string;strength?:number}){
 const {out,planSha256,c,method,seed,budget,allowance,result,reference,referenceTrace,compileMs,physicalFrames,composition,production,budgetTelemetry,
 styles={},phrases=[],geometry,geometryStyle={},subdivisions,faces,profile,strength}=args;
    const validationStarted=performance.now();
    const {grade:historicalGrade,trace,collisionIds,impactEvaluation}=replayGalleryTrack(result.track,c as unknown as Case,true,result.impactEvaluation?.contract);
    if(impactEvaluation)assert.deepEqual(impactEvaluation,result.impactEvaluation,'independent impact account differs');
    const grade=impactEvaluation?contactImpactGrade(historicalGrade,impactEvaluation):historicalGrade;
    const fragmentSections:number[]=production?.fragmentSections??composition?.fragmentSections??[],railLayout=fragmentSections.length?'mixed':'connected';
    const railGuides=production?.railGuides??composition?.railGuides;
    const groups=arcRailGroups(result.track.lines.filter((l:any)=>!fragmentSections.includes(Math.floor((l.id-1000)/10000))));
    const inspection=inspectRailContacts({method,railLayout,railGuides,track:result.track},collisionIds!);
    const usage=railLayout==='connected'?guideFootprint(result.track.lines):{supportSections:inspection.summary.supportSections!,guideSections:inspection.summary.guideSections,
      guideLength:result.track.lines.filter((l:any)=>inspection.guideIds.has(l.id)).reduce((sum:number,l:any)=>sum+Math.hypot(l.x2-l.x1,l.y2-l.y1),0)};
    const valid=validRide({report:result.report,impactEvaluation});
    assert.equal(valid,grade.score.valid,'compiler and independent judge disagree');
    const loss=impactEvaluation?result.impactTrajectoryLoss:result.trajectoryLoss;
    if(valid&&loss!==undefined)assert.ok(Math.abs(Math.sqrt(loss)-grade.score.weightedAxisRms!)<1e-10,'target adapter changed the objective');
    const geometryVerification=verifyMainConstruction(result.track,result.rows,{radius:24,channel:12,
      ...(method===geometry?geometryStyle:{}),sectionStyles:styles,fragmentSections},composition?.attempts?0:composition?.fragmentConstruction?Math.max(...fragmentSections)+1:composition?.changedSections?.[0]??0);
    const sections=result.rows.map((r:any,i:number)=>{
      const chains=groups.get(i)??[],fragmented=fragmentSections.includes(i),sectionLines=result.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===i);
      const normal=fragmented?sectionLines.filter((l:any)=>!inspection.guideIds.has(l.id)):chains[0]??[];
      const guides=fragmented?sectionLines.filter((l:any)=>inspection.guideIds.has(l.id)):chains[1]??[];
      const guideIds=new Set<number>(guides.map((l:any)=>l.id)),mainIds=new Set<number>(normal.map((l:any)=>l.id));
      const guideFrames=collisionIds!.flatMap((ids,f)=>ids.some(id=>guideIds.has(id))?[f]:[]);
      const mainFrames=collisionIds!.flatMap((ids,f)=>ids.some(id=>mainIds.has(id))?[f]:[]);
      const subdivision=styles[i]?.subdivisions??(method===geometry?(subdivisions??4):4);
      const faceCount=styles[i]?.faces??(method===geometry?faces:undefined);
      if(!fragmented&&styles[i]?.railLayout!=='transfer'&&i>=(composition?.attempts?0:composition?.fragmentConstruction?Math.max(...fragmentSections)+1:composition?.changedSections?.[0]??0))assert.equal(normal.length,1+arcMainSteps(r.control.support,subdivision,faceCount),'emitted shape differs from requested construction');
      if(styles[i]?.guides===false)assert.equal(guides.length,0,'forbidden guide emitted');
      return {section:i,start:r.frame/40,end:(result.rows[i+1]?.frame??c.durationFrames)/40,
        shape:fragmented?'fragments':styles[i]?.profile??(method===geometry?profile:undefined)??(faceCount!==undefined||subdivision===.5?'facets':'arcs'),
        profileStrength:styles[i]?.profileStrength??(method===geometry?strength:undefined)??1,
        layout:styles[i]?.railLayout??'paired',
        guidePermission:styles[i]?.guides===false?'forbidden':'allowed',
        mainSegments:normal.length,guideSegments:guides.length,mainContactFrames:mainFrames.length,guideContactFrames:guideFrames.length,
        firstGuideContact:guideFrames[0]===undefined?null:guideFrames[0]/40,lastGuideContact:guideFrames.length?guideFrames.at(-1)!/40:null};
    });
    let prefixFrames=0,changedMotionFrames=0;
    if(method!=='baseline'&&referenceTrace){
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
    if(impactEvaluation)save('contact-impacts.json',{evaluation:impactEvaluation,grade,historicalGrade});
    save('construction.json',{rows:result.rows,stats:result.stats,attempts:result.attempts,
      failure:result.failure,refinement:result.refinementStats,opposingEntryWork:result.opposingEntryWork,styles,fragmentSections,compositionStages:composition?.attempts,fragmentConstruction:composition?.fragmentConstruction,...(composition?{boundaryFrame:composition.boundaryFrame,prefixSha256:composition.prefixSha256,stateSha256:composition.stateSha256}:{})});
    save('budget-telemetry.json',budgetTelemetry??{schema:'line.musical-direction-budget.v1',budget:allowance,physicalFrames,
      preparationFrames:composition?.attempts?.reduce((n:number,a:any)=>n+a.preparationFrames,0)??composition?.preparationFrames??0,constructionFrames:composition?.attempts?.reduce((n:number,a:any)=>n+a.physicalFrames-a.preparationFrames,0)??result.stats.sim_frames,compositionStages:composition?.attempts,
      includes:production?'All automatic search and compiler replay work. An explicitly requested reference is accounted separately. Independent evaluation and rendering are separate.':
        'All search and cold replay work for this alternative, plus prefix preparation. Baseline creation is accounted once in the comparison set. Independent evaluation and rendering are separate.'});
    const cell={id,caseId:c.id,method,railLayout,railGuides,seed,jitter:c.jitter,budget,allowance,score:grade.score,
      ...(impactEvaluation?{impactContract:impactEvaluation.contract,impactEvaluation,historicalGrade}:{}),
      compileMs,physicalFrames,...(production?{production}:{}),validationMs:performance.now()-validationStarted,lines:result.track.lines.length,
      trackHash:sha(JSON.stringify(result.track)),observations:grade.observations,contacts:grade.contacts,offBeat:grade.offBeat,
      terminus:grade.terminus,failure:result.failure,valid,qualityRms:grade.score.weightedAxisRms,usage,sections,
      geometryVerification,contactSummary:inspection.summary,collisionSha256:sha(JSON.stringify(collisionIds)),metrics,
      construction:{styles,phrases,fragmentSections,fragmentConstruction:composition?.fragmentConstruction,boundaryFrame:composition?.boundaryFrame??null,stages:composition?.attempts,prefixFrames,changedMotionFrames,
        changedSections:composition?.changedSections??[],baseTrackHash:method==='baseline'||!reference?null:sha(JSON.stringify(reference.track))},
      trackPath:relative(out,join(dir,'track.json')),reportPath:relative(out,join(dir,'report.json')),
      moments:c.moments.map((m:any)=>({...m,observations:grade.observations.filter(o=>o.endFrame>=m.from*40&&o.startFrame<=m.to*40)}))};
    const path=id+'.json',digest=writeGalleryJson(out,path,{schema:'line.motion-gallery-cell.v1',planSha256,...cell,case:c,track:result.track,trace});
    const saved={...cell,path,sha256:digest};return {cell:saved,trace};
}
