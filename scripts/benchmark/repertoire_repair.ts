/** Research local repair of an already completed automatic track, with one total
 * allowance. Prefixes are physically verified, incumbent controls remain proposals,
 * and unsuccessful/worse suffixes cannot displace the complete incumbent. */
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {compileArcMotion} from '../v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../v0/optimizer/connected_arcs.ts';
import {captureArcFork} from '../v0/optimizer/arc_guide_study.ts';
import {planRepertoire,constructionStyle} from '../v0/optimizer/repertoire_policy.ts';
import {loadMusicCase} from '../produce/music_artifacts.ts';
import {galleryCompilerIdentity,replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
const arg=(k:string,d:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const song=arg('song','luna_bala_44s'),seed=Number(arg('seed','101')),budget=Number(arg('budget','3000000')),mode=arg('mode','tail');
const out=resolve(arg('out','generated/production-repertoire/repair-study'));mkdirSync(out,{recursive:true});
const {spec,musicCase:c}=await loadMusicCase({song,title:song,moments:[]},-15),plan=planRepertoire(spec,seed),end=Math.round(spec.duration*40)+20;
const styles=Object.fromEntries(plan.requests.map(r=>[r.section,constructionStyle(r)])),requests=Object.fromEntries(plan.requests.map(r=>[r.section,r]));
const compiler=galleryCompilerIdentity(process.cwd()),began=performance.now();
let result=compileArcMotion(spec,seed,{...connectedArcOptions(spec,budget-end-1),policyPreview:false,initialRecoverySamples:160,memoryScope:'construction',sectionStyles:styles,constructionRequests:requests,collectTrajectoryLoss:true});
let spent=result.stats.sim_frames;const stages:any[]=[{phase:'initial',physicalFrames:spent,loss:result.trajectoryLoss}];
const complete=(r:any)=>r.report.terminus.reason==='endOfSpec'&&!r.report.off_beat_landings.length&&r.report.contacts.every((x:any)=>x.status==='hit');
const visited=new Set<number>();
for(let attempt=0;attempt<3&&complete(result);attempt++){
 const remaining=budget-end-1-spent,rate=Math.max(100,result.stats.sim_frames/end);
 const ranked=result.rows.slice(1).flatMap((r:any,offset:number)=>{
  const i=offset+1,tailFrames=end-r.frame;
  if(visited.has(i)||tailFrames*rate*.6+4*(end+1)>remaining)return [];
  const gaps=result.report.gaps.slice(Math.max(0,i-2),i+2),loss=gaps.reduce((n:number,g:any)=>n+Object.values(g.axes).reduce((s:number,a:any)=>s+(a?.error??0)**2,0),0);
  return [{i,priority:loss/Math.sqrt(Math.max(1,tailFrames)),frame:r.frame}];
 }).sort((a,b)=>b.priority-a.priority);
 if(!ranked.length)break;const section=ranked[0].i;visited.add(section);
 const captured=captureArcFork(result,section);spent+=captured.physicsFrames;
 const allowance=budget-end-1-spent;if(allowance<4*(end+1))break;
 const suffixStyles=Object.fromEntries(Object.entries(styles).filter(([i])=>Number(i)>=section));
 const fragmentSections=plan.requests.filter(r=>r.section<section&&r.construction==='scattered').map(r=>r.section);
 const fork={...captured.fork,guides:styles[section].guides!==false,fragmentSections,
  continuation:result.rows.slice(section).map((r:any)=>({control:r.control,incoming:r.incoming,span:r.span}))};
 const alternative=compileArcMotion(spec,seed,{...connectedArcOptions(spec,allowance),policyPreview:false,initialRecoverySamples:160,memoryScope:'construction',
  sectionStyles:suffixStyles,constructionRequests:requests,collectTrajectoryLoss:true,fork,...(mode==='policy8'?{policySamples:8}:mode==='objective'?{timeObjective:true,valueGuidanceWeight:0,continuationValueWeight:0}:{})});
 spent+=alternative.stats.sim_frames;const accepted=complete(alternative)&&alternative.trajectoryLoss!<result.trajectoryLoss!;
 stages.push({phase:'repair',section,preparationFrames:captured.physicsFrames,physicalFrames:alternative.stats.sim_frames,complete:complete(alternative),loss:alternative.trajectoryLoss,accepted});if(accepted)result=alternative;
}
const evaluation=replayGalleryTrack(result.track,c as any,true),id=[song,mode,seed,budget].join('-');
writeGalleryJson(out,id+'.json',{id,compiler,song,seed,budget,mode,ms:performance.now()-began,physicalFrames:spent,score:evaluation.grade.score,stages,track:result.track,rows:result.rows});
console.log(JSON.stringify({id,score:evaluation.grade.score.score,spent,stages}));
