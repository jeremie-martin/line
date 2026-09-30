/** Development pilot; not a canonical result. Always retain every scheduled outcome. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {compileHandoff} from '../v0/optimizer/handoff.ts';
import {loadMusicCase} from '../produce/music_artifacts.ts';
import {planRepertoire,validateProductionPlan,type Construction} from '../v0/optimizer/repertoire_policy.ts';
import {replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
const arg=(k:string,d:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const song=arg('song','luna_bala_44s'),shape=arg('shape','auto'),budget=Number(arg('budget','1500000')),seed=Number(arg('seed','101'));
const out=resolve(arg('out','generated/production-repertoire/pilot'));mkdirSync(out,{recursive:true});
const id=[song,shape,seed,budget].join('-');
try{
  const {spec,musicCase}=await loadMusicCase({song,title:song,moments:[]},-15);
  const plan=planRepertoire(spec,seed);
  if(shape!=='auto'){
    const construction=(shape==='single'?'arcs':shape) as Construction,guidance=shape==='single'?'forbidden':shape==='scattered'?'optional':'required';
    // Fixed multi-support passage with ordinary reference surroundings; same window across constructions.
    for(const r of plan.requests)if(r.section>0){r.construction=r.section>=3&&r.section<=5?construction:'arcs';r.guidance=r.section>=3&&r.section<=5?guidance:'optional';}
    plan.phrases=plan.requests.slice(1).map(r=>({first:r.section,count:1,construction:r.construction,guidance:r.guidance}));
  }
  validateProductionPlan(spec,plan);
  const began=performance.now(),checkpoint=compileHandoff(spec,seed,{budget,constructionPlan:plan}),ms=performance.now()-began;
  const r=checkpoint.repertoire!,evaluation=replayGalleryTrack(checkpoint.track,musicCase as any,true);
  const record={id,song,shape,seed,budget,ms,score:evaluation.grade.score,physicalFrames:r.physicalFrames,
    valid:r.valid,qualified:r.qualified,work:r.work,realization:r.realization,constructionFailure:r.constructionFailure,
    plan,rows:r.result.rows,track:checkpoint.track,report:checkpoint.report,railGuides:r.railGuides,fragmentSections:r.fragmentSections};
  writeGalleryJson(out,id+'.json',record);
  console.log(JSON.stringify({id,ms,frames:r.physicalFrames,valid:r.valid,qualified:r.qualified,score:evaluation.grade.score,
    fulfilled:r.realization.fulfilledSections,total:r.realization.requested,
    requested:r.realization.sections.filter(s=>s.section>=3&&s.section<=5)}));
}catch(error){writeFileSync(join(out,id+'.error.json'),JSON.stringify({id,error:String(error),stack:error instanceof Error?error.stack:null})+'\n');console.error(error);process.exitCode=1;}
