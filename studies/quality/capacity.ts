/** Fixed-prefix feasibility. These are possible local catches, not complete
 * improved rides: every result still needs a viable musical continuation. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {resolveCase} from '../../tools/eval/inputs.ts';
import {repertoireSearchOptions,loadConstructionArtifact} from '../../scripts/v0/optimizer/repertoire_search.ts';
import {impactSearchProfile} from '../../scripts/v0/optimizer/contact_impact_profile.ts';
import {createArcCompileContext} from '../../scripts/v0/optimizer/arc_compile_context.ts';
import {searchInterval} from '../../scripts/v0/optimizer/arc_interval.ts';
import {resetFrameCount,setPhysicsFrameLimit,getPhysicsFrameCount} from '../../scripts/lib/detector.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';

const song=process.argv[2],seed=101;
const saved=JSON.parse(gunzipSync(readFileSync(`generated/quality-inspection/${song}~101.json.gz`)).toString());
const {spec,planned}=await resolveCase({id:`${song}~${seed}`,song,seed,perturbation:null},-15);
const options=repertoireSearchOptions(spec,saved.plan,100_000_000);
const {id,constructionModel,...profile}=impactSearchProfile('line.strike.v3') as any;
const artifact=loadConstructionArtifact(constructionModel);
Object.assign(options,profile,{impactContract:'line.strike.v3',constructionPolicies:artifact.policies,constructionExamples:artifact.examples});
const ctx=createArcCompileContext(spec,seed,options), rows:any[]=[];
const summary=(c:any)=>({control:c.c,cost:c.cost,localCost:c.localCost,impact:c.meta?.impact??c.actualImpact,
  achieved:c.meta?.achieved??c.achieved,heading:c.heading,pose:c.pose,endSpeed:c.endSpeed,
  residuals:c.measurement?.localResiduals??c.localResiduals,motion:c.meta?.motion??c.motion});
for(let i=1;i<ctx.contacts.length;i++){
  const request=ctx.gaps[ctx.contacts[i].gap].targets.impact;
  if(request===undefined||request<.6)continue;
  const prefix=saved.result.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)<i);
  const engine=ctx.lineage.rebuild(prefix);
  resetFrameCount();setPhysicsFrameLimit(250_000);
  const incumbent=searchInterval(ctx,engine,i,{directControls:[saved.result.rows[i].control]},[engine]);
  if(!incumbent?.best)throw new Error(`saved construction cannot reproduce ${song}:${i}`);
  const before=summary(incumbent.best),baselineImpact=saved.result.rows[i].impact;
  if(Math.abs(before.impact-baselineImpact)>1e-9)throw new Error(`impact replay differs ${song}:${i}`);
  const result=searchInterval(ctx,engine,i,{warmStart:saved.result.rows[i].control,samples:512,guidanceSamples:384,responseSamples:320},[engine]);
  const seen=new Map<string,any>();
  for(const c of result?.candidates??[])seen.set(JSON.stringify(c.c),summary(c));
  rows.push({section:i,request,construction:saved.plan.requests[i],before,best:result?.best?summary(result.best):null,
    frames:getPhysicsFrameCount(),candidates:[...seen.values()]});
  console.log(`${song}:${i} ${before.impact.toFixed(3)} -> ${(result?.best?.actualImpact??0).toFixed(3)} ${seen.size} candidates`);
  Engine.retainOnly([]);ctx.lineage.memoContexts.clear();
}
setPhysicsFrameLimit(null);
mkdirSync('generated/quality-capacity',{recursive:true});
writeFileSync(`generated/quality-capacity/${song}.json.gz`,gzipSync(JSON.stringify({song,planned,rows})));
