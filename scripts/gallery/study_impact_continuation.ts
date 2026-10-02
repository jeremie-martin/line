/** Same-state construction experiments with coordinated full continuation.
 * The original seeded plan is fixed. These are controlled research branches,
 * not hand-selected production tracks or evidence of general capability. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CONTACT_IMPACT_CONTRACT} from '../lib/contact_impact.ts';
import {loadMusicCase} from '../produce/music_artifacts.ts';
import {galleryCompilerIdentity,writeGalleryJson,replayGalleryTrack} from './artifacts.ts';
import {contactImpactGrade} from './contact_impact_grade.ts';
import {sha} from '../../benchmark/v3/model.ts';
const arg=(k:string,d?:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const out=resolve(arg('out','generated/general-impact-20261002/continuation-assays')!),root=resolve(arg('compiler-root','/tmp/line-general-impact-pilot1')!);
mkdirSync(out,{recursive:true});
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const sources=read('generated/general-impact-20261002/construction-assays/plan.json').sources;
const variants={legacy:{},shared:{impactContract:CONTACT_IMPACT_CONTRACT.id},'shared-gain':{impactContract:CONTACT_IMPACT_CONTRACT.id,impactSearch:{engagementGainWeight:.04}}};
const plan={schema:'line.impact-continuation-plan.v1',compilerRoot:root,compiler:galleryCompilerIdentity(root),sources,variants,
  allowance:3000000,contract:CONTACT_IMPACT_CONTRACT,harnessSha256:sha(readFileSync(import.meta.filename)),
  note:'Fixed incoming state and seeded construction plan. Each variant reconstructs the entire remaining ride; prior source strikes are preserved, including their errors. All failed continuations are retained. Prefix preparation and compiler work are separately counted.'};
const planPath=join(out,'plan.json');
if(existsSync(planPath))assert.deepEqual(read(planPath),plan);else writeGalleryJson(out,'plan.json',plan);
if(arg('declare')==='true'){console.log(JSON.stringify({out,sources:sources.length,variants:Object.keys(variants)}));process.exit(0);}
const source=sources.find((s:any)=>s.id===arg('source')),variant=arg('variant')!;
assert.ok(source&&variant in variants,'declared source and variant required');
const record=read(source.path),savedPlan=read(join(dirname(source.path),'plan.json'));
const construction=read(join(dirname(source.path),dirname(record.trackPath),'construction.json'));
const {spec,musicCase}=await loadMusicCase({song:record.caseId,title:record.case.title,moments:[]},savedPlan.jolt);
for(const key of ['specSha256','audioSha256','analysisSha256'])assert.equal(musicCase[key],record.case[key]);
const load=(path:string)=>import(pathToFileURL(join(root,path)).href);
const {captureArcFork}=await load('scripts/v0/optimizer/arc_guide_study.ts');
const {compileArcMotion}=await load('scripts/v0/optimizer/arc_motion.ts');
const {repertoireSearchOptions}=await load('scripts/v0/optimizer/repertoire_search.ts');
const {resetFrameCount,setPhysicsFrameLimit}=await load('scripts/lib/detector.ts');
const {inspectRepertoireLayout}=await load('scripts/v0/optimizer/repertoire_layout.ts');
const {arcRailGroups}=await load('scripts/v0/optimizer/arc_guidance.ts');
resetFrameCount();setPhysicsFrameLimit(null);
const captured=captureArcFork({track:record.track,rows:construction.rows},source.section);
const fragments=record.production.fragmentSections.filter((i:number)=>i<source.section);
const fork={...captured.fork,guides:record.production.plan.requests[source.section].guidance!=='forbidden',fragmentSections:fragments,continuation:construction.rows.slice(source.section).map((r:any)=>({control:r.control,incoming:r.incoming,span:r.span}))};
const options={...repertoireSearchOptions(spec,record.production.plan,plan.allowance-captured.physicsFrames),
  ...variants[variant as keyof typeof variants],fork,refineAttempts:0};
options.sectionStyles=Object.fromEntries(Object.entries(options.sectionStyles).filter(([i])=>Number(i)>=source.section));
const began=performance.now(),result=compileArcMotion(spec,record.seed,options),compileMs=performance.now()-began;
const physicalFrames=captured.physicsFrames+result.stats.sim_frames;
assert.ok(physicalFrames<=plan.allowance);assert.equal(result.forkEvidence.stateSha256,captured.fork.stateSha256);
const replay=replayGalleryTrack(result.track,record.case,true,CONTACT_IMPACT_CONTRACT.id),impact=replay.impactEvaluation!;
assert.deepEqual(replay.trace.frames.slice(0,captured.frame+1),record.trace.frames.slice(0,captured.frame+1),'earlier physical history changed');
const fragmented=new Set(record.production.fragmentSections),railGuides:Record<number,number[]>={};
for(const [section,chains] of arcRailGroups(result.track.lines.filter((l:any)=>!fragmented.has(Math.floor((l.id-1000)/10000)))))railGuides[section]=(chains[1]??[]).map((l:any)=>l.id);
for(const i of fragmented)railGuides[i as number]=result.rows[i as number]?.railGuides??[];
const realization=inspectRepertoireLayout(record.production.plan,result.track.lines,railGuides,replay.collisionIds,replay.trace.frames.map((f:number[])=>({x:(f[8]+f[10]+f[12]+f[14]+f[16]+f[18])/6,y:(f[9]+f[11]+f[13]+f[15]+f[17]+f[19])/6})));
const grade=contactImpactGrade(replay.grade,impact),request=record.production.plan.requests[source.section];
const row={source:source.id,variant,request,seed:record.seed,planSha256:sha(readFileSync(planPath)),
  trackHash:sha(JSON.stringify(result.track)),compileMs,physicalFrames,preparationFrames:captured.physicsFrames,
  compilerFrames:result.stats.sim_frames,externalReplayFrames:record.case.durationFrames+21,
  prefix:{frame:captured.frame,stateSha256:captured.fork.stateSha256,geometrySha256:captured.prefixSha256,unchanged:true},
  legacy:replay.grade.score,grade,impact,realization,failure:result.failure,rows:result.rows,
  local:impact.events.filter(e=>e.onset>=request.frame-4&&e.onset<request.next),
  localGains:impact.speedGains.filter(g=>g.end>=request.frame&&g.start<request.next)};
const id=`${source.id}-${variant}`;writeGalleryJson(out,id+'.json',row);
writeGalleryJson(out,id+'-track.json',{track:result.track,trace:replay.trace,source:source.path,case:record.case,railGuides});
assert.deepEqual(galleryCompilerIdentity(root),plan.compiler);assert.equal(sha(readFileSync(import.meta.filename)),plan.harnessSha256);
console.log(JSON.stringify({source:source.id,variant,valid:impact.valid,fulfilled:realization.fulfilled,
  score:grade.score.score,loss:impact.account.loss,physicalFrames,compileMs}));
