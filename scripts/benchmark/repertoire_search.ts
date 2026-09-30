/** Matched-request, matched-ceiling search experiments for the production repertoire. */
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {compileArcMotion,type ArcMotionOptions} from '../v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../v0/optimizer/connected_arcs.ts';
import {planRepertoire,constructionStyle} from '../v0/optimizer/repertoire_policy.ts';
import {inspectRepertoire} from '../v0/optimizer/repertoire_realization.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {loadMusicCase} from '../produce/music_artifacts.ts';
import {galleryCompilerIdentity,replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
const variants:Record<string,Partial<ArcMotionOptions>>={
 base:{},
 scoped:{memoryScope:'construction'},
 scoped_broader:{memoryScope:'construction',samples:120,guidanceSamples:320,responseSamples:250,policySamples:16},
 scoped_deeper:{memoryScope:'construction',samples:120,guidanceSamples:320,responseSamples:250,policySamples:16,lookaheadDepth:3,lookaheadBranching:2,lookaheadWidth:4,lookaheadSamples:40,continuationGuidanceSamples:24},
 policy8:{policySamples:8},
 policy0:{policySamples:0},
 broad_objective:{samples:120,guidanceSamples:320,responseSamples:250,policySamples:16,timeObjective:true,terminalOptimization:true,valueGuidanceWeight:0,continuationValueWeight:0},
 broad_deeper:{samples:120,guidanceSamples:320,responseSamples:250,policySamples:16,lookaheadDepth:3,lookaheadBranching:2,lookaheadWidth:4,lookaheadSamples:40,continuationGuidanceSamples:24},
 objective:{timeObjective:true,terminalOptimization:true,valueGuidanceWeight:0,continuationValueWeight:0},
 no_priors:{arrivalWeight:0,headingWeight:0,valueGuidanceWeight:0,continuationValueWeight:0},
 deeper:{lookaheadDepth:3,lookaheadBranching:2,lookaheadWidth:4,lookaheadSamples:40,continuationGuidanceSamples:24},
 broader:{samples:120,guidanceSamples:320,responseSamples:250,policySamples:16},
 guide_extent:{guidance:'full'},
 newton:{solver:'newton'},
 future:{lookaheadWeight:2,lookaheadSamples:24,lookaheadWidth:6},
 arrival:{arrivalWeight:1.5,headingWeight:0},
};
const arg=(k:string,d:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const song=arg('song','luna_bala_44s'),variant=arg('variant','base'),seed=Number(arg('seed','101')),budget=Number(arg('budget','3000000'));
if(!variants[variant])throw new Error('unknown variant');
const out=resolve(arg('out','generated/production-repertoire/search-study'));mkdirSync(out,{recursive:true});
const compiler=galleryCompilerIdentity(process.cwd()),{spec,musicCase:c}=await loadMusicCase({song,title:song,moments:[]},-15);
const plan=planRepertoire(spec,seed),styles=Object.fromEntries(plan.requests.map(r=>[r.section,constructionStyle(r)]));
const options={...connectedArcOptions(spec,budget-Math.round(spec.duration*40)-21),policyPreview:false,initialRecoverySamples:160,
  sectionStyles:styles,constructionRequests:Object.fromEntries(plan.requests.map(r=>[r.section,r])),collectTrajectoryLoss:true,...variants[variant]};
const began=performance.now(),result=compileArcMotion(spec,seed,options),ms=performance.now()-began;
const replay=replayGalleryTrack(result.track,c as any,true),fragments=new Set(plan.requests.filter(r=>r.construction==='scattered').map(r=>r.section));
const roles:Record<number,number[]>={};for(const [i,chains]of arcRailGroups(result.track.lines.filter(l=>!fragments.has(Math.floor((l.id-1000)/10000)))))roles[i]=(chains[1]??[]).map(l=>l.id);
const realization=inspectRepertoire(plan,result.track.lines,roles,replay.collisionIds!);
const id=[song,variant,seed,budget].join('-'),record={id,compiler,variant,changes:variants[variant],song,seed,budget,ms,
  physicalFrames:result.stats.sim_frames,score:replay.grade.score,valid:replay.grade.score.valid,
  realization,plan,rows:result.rows,track:result.track,report:result.report,fragmentStats:result.fragmentStats,
  failure:result.failure,planning:result.planningDecisions,lookahead:result.lookaheadStats};
writeGalleryJson(out,id+'.json',record);
console.log(JSON.stringify({id,ms,frames:record.physicalFrames,valid:record.valid,score:record.score.score,fulfilled:realization.fulfilledSections,total:realization.requested,failure:result.failure}));
