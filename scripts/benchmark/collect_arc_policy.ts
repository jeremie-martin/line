/** Replay verified teacher prefixes to pair physical arrivals with optimized controls. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {developmentCases} from '../../benchmark/v2/catalog.ts';
import {benchmarkPolicy} from '../../benchmark/v2/policy.ts';
import {applyJolt} from '../produce/seed.ts';
import {sliceTimeline,effectiveAxes,sampleGapTargets} from '../v0/core/substrate.ts';
import {normalizeCompilerTimeline} from '../v0/optimizer/compiler_input.ts';
import {scheduleNativeContacts} from '../v0/optimizer/native_motion_schedule.ts';
import {createArcEngine} from '../v0/optimizer/arc_engine.ts';
import {arcPolicyArrival,ARC_POLICY_SCHEMA} from '../v0/optimizer/arc_control_policy.ts';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,getPhysicsFrameCount} from '../lib/detector.ts';
import {CALIB} from '../v0/types.ts';
import {makeRng} from '../lib/rng.ts';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const input=arg('inputs')!,out=arg('out')!;
const hash=(body:string|Buffer)=>createHash('sha256').update(body).digest('hex');
const checked=(path:string)=>{const body=readFileSync(path);if(hash(body)!==readFileSync(path+'.sha256','utf8').trim().split(/\s/)[0])throw new Error('checksum '+path);return JSON.parse(body.toString());};
const plan=checked(input+'/plan.json');checked(input+'/summary.json');
const parents=JSON.parse(readFileSync('benchmark/v2/studies/current-baseline-analysis.json','utf8')).caseStatistics;
const all:any[]=[],provenance:any[]=[];
for(const source of plan.sourceIds){
  const record=checked(input+'/'+source+'.json'),entry=developmentCases.find(e=>e.case.metadata.id===source)!;
  const spec=normalizeCompilerTimeline(applyJolt(entry.case.spec,benchmarkPolicy.transform.joltMs));
  const duration=Math.round(spec.duration*40),end=duration+20,frames=spec.contacts.map(c=>Math.round(c.t*40));
  const gaps=sliceTimeline(frames,duration);
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact&&spec.contacts[g.index].impact!==undefined)g.targets.impact=spec.contacts[g.index].impact;}
  const rng=makeRng(record.seed),planned=scheduleNativeContacts(gaps.map(g=>({...g,targets:{...g.targets,...sampleGapTargets(g.targets,spec.jitter??CALIB.SIGMA,rng)}})));
  const contacts=[{frame:1,gap:-1},...planned.filter(g=>g.endsWithContact).map(g=>({frame:g.endFrame,gap:g.index}))];
  const future=(features:number[],i:number)=>{
    for(let k=1;k<=2;k++){
      const contact=contacts[i+k],target=contact?planned.find(g=>g.startFrame===contact.frame)?.targets:undefined;
      features.push(contact?((contacts[i+k+1]?.frame??end+1)-contact.frame)/40:0,contact?(gaps[contact.gap]?.targets.impact??-1):-1,target?.air??-1,target?.speed??-1,target?.amplitude??-1);
    }return features;
  };
  resetFrameCount();
  const rider=record.track.riders[0],start={position:rider.startPosition,velocity:rider.startVelocity};
  let engine=createArcEngine(start);const reference=createArcEngine(start,record.track.lines);const parent=parents.find((r:any)=>r.sourceId===source);
  if(record.rows.length!==contacts.length)throw new Error('incomplete teacher '+source);
  for(let i=0;i<contacts.length;i++){
    const row=record.rows[i],frame=contacts[i].frame;
    if(row.frame!==frame)throw new Error('teacher timeline mismatch');
    const before=getRiderMetered(engine,frame-1).ballisticState(),free=getRiderMetered(engine,frame),velocity=free.velocity;
    if(JSON.stringify(before)!==JSON.stringify(getRiderMetered(reference,frame-1).ballisticState()))throw new Error('teacher prefix replay mismatch '+source+':'+i);
    if(i>0){
      const incoming=Math.atan2(velocity.y,velocity.x)*180/Math.PI,span=row.next-frame-1,c=row.control;
      const target=[(c.entry-incoming)/30,c.turn/60,(c.exit-incoming)/60,c.support/span,c.bias,c.offset,(c.clearance??record.options.channel??12)/12,c.turnFraction??Math.min(5,c.support*.5)/c.support,(c.bend??0)/30,(c.guideFlare??0)/8];
      all.push({source,parent:parent.parentId??source,index:i,features:future(arcPolicyArrival(before,velocity),i-1),target,control:c});
    }
    const geometry=record.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)===i);
    if(!geometry.length)throw new Error('empty teacher interval');
    engine=engine.addLine(geometry).detach();Engine.retainOnly([engine,reference]);
  }
  getRiderMetered(engine,end);
  provenance.push({source,sha256:hash(readFileSync(input+'/'+source+'.json')),replayFrames:getPhysicsFrameCount(),prefixesMatchedFullTrack:true});
  dispose();process.stderr.write(source+' '+all.length+'\n');
}
mkdirSync(out,{recursive:true});
const body=JSON.stringify({schema:'line.arc-control-policy-data.v1',featureSchema:ARC_POLICY_SCHEMA,teacherPlanSha256:hash(readFileSync(input+'/plan.json')),provenance,rows:all})+'\n';
writeFileSync(out+'/data.json',body);writeFileSync(out+'/data.json.sha256',hash(body)+'\n');
console.log(JSON.stringify({rows:all.length,sources:provenance.length}));
