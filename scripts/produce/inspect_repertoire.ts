/** Inspect which physically reshaped main segments actually contact the rider,
 * retaining contact order so a glancing hit cannot be mistaken for traversal.
 * Same-state, same-control ordinary geometry is a diagnostic comparison only;
 * it is not claimed to be a valid replacement ride or a necessity test. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {motionArc} from '../v0/optimizer/arc_geometry.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
import {sha} from '../../benchmark/v3/model.ts';
const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=
  await import(new URL('../lib/native_motion/engine.ts?repertoire-inspection',import.meta.url).href);
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('study')&&arg('out'),'--study and --out required');
const root=resolve(arg('study')!),out=resolve(arg('out')!);
function read(path:string){const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(bytes.toString());}
const manifest=read(join(root,'manifest.json')),rows:any[]=[];
for(const cell of manifest.cells){
  const r=read(join(root,cell.path)),construction=read(join(root,cell.id,'construction.json'));
  assert.equal(sha(readFileSync(join(root,cell.path))),cell.sha256);
  const c=manifest.plan.cases.find((c:any)=>c.id===cell.caseId);
  const replay=replayGalleryTrack(r.track,c,true),collisions=replay.collisionIds!;
  assert.equal(sha(JSON.stringify(collisions)),cell.collisionSha256);
  const fragments=new Set<number>(construction.fragmentSections??[]);
  const groups=arcRailGroups(r.track.lines.filter((l:any)=>!fragments.has(Math.floor((l.id-1000)/10000)))),supports:any[]=[];
  for(const [key,style] of Object.entries(construction.styles) as [string,any][]){
    if(!style.profile)continue;
    const section=Number(key),row=construction.rows[section],prefix=r.track.lines.filter((l:any)=>Math.floor((l.id-1000)/10000)<section);
    try{
      const base=new Engine().setStart(r.track.startPosition,r.track.riders[0].startVelocity),engine=prefix.length?base.addLine(prefix):base;
      const free=engine.getRider(row.frame);engine.prepareCollisionTrace(row.frame);engine.getRider(row.frame);
      const trace=engine.readCollisionTrace()[0],points=['PEG','TAIL','NOSE','STRING'].map(k=>trace[k]);
      const build=(s:any)=>arcRailGroups(motionArc(points,free.velocity,row.control,1000+section*10000,false,12,false,24,4,s)).get(section)![0];
      const actual=groups.get(section)![0],ordinary=build({...style,profileStrength:0});
      assert.deepEqual(actual,build(style));
      const differences=actual.map((l,i)=>Math.max(Math.hypot(l.x1-ordinary[i].x1,l.y1-ordinary[i].y1),Math.hypot(l.x2-ordinary[i].x2,l.y2-ordinary[i].y2)));
      const shaped=new Set(actual.filter((_,i)=>differences[i]>1e-9).map(l=>l.id));
      const main=new Set(actual.map(l=>l.id)),guide=new Set((groups.get(section)![1]??[]).map(l=>l.id));
      const count=(ids:Set<number>)=>collisions.filter(contact=>contact.some(id=>ids.has(id))).length;
      // Mirror motionArc's integration schedule, not the rider's elapsed time
      // or physical distance. Segment zero is the straight approach. Keeping
      // null before the profile begins distinguishes entry from shaped motion.
      const steps=Math.max(4,Math.ceil(row.control.support*4));
      assert.equal(actual.length,steps+1);
      const entry=style.profileStart!==undefined?row.control.support*style.profileStart:
        row.control.turnFraction===undefined?Math.min(5,row.control.support*.5):row.control.support*row.control.turnFraction;
      const mainIndex=new Map(actual.map((line,index)=>[line.id,index]));
      const phase=(index:number)=>{
        const time=(index-.5)*row.control.support/steps;
        return index===0||time<entry?null:Math.max(0,Math.min(1,(time-entry)/Math.max(.01,row.control.support-entry)));
      };
      const contactTimeline=collisions.flatMap((ids,frame)=>{
        const mainContacts=ids.filter(id=>main.has(id)).map(id=>({id,segment:mainIndex.get(id)!,profilePhase:phase(mainIndex.get(id)!)}));
        const guideIds=ids.filter(id=>guide.has(id));
        return mainContacts.length||guideIds.length?[{frame,main:mainContacts,guideIds}]:[];
      });
      supports.push({section,start:row.frame/40,end:(construction.rows[section+1]?.frame??c.durationFrames)/40,
        profile:style.profile,strength:style.profileStrength??1,profileStart:style.profileStart??null,rippleCycles:style.rippleCycles??2,
        reshapedMainSegments:shaped.size,mainSegments:main.size,maxEndpointDisplacement:Math.max(...differences),
        mainContactFrames:count(main),reshapedMainContactFrames:count(shaped),guideContactFrames:count(guide),
        profileSchedule:{supportFrames:row.control.support,profileStartFrames:entry,steps},contactTimeline});
    }finally{dispose();}
  }
  rows.push({id:cell.id,trackHash:cell.trackHash,collisionSha256:cell.collisionSha256,supports});
}
mkdirSync(dirname(out),{recursive:true});
writeGalleryJson(dirname(out),out.split('/').at(-1)!,{schema:'line.repertoire-contact-inspection.v3',
  manifest:{path:join(root,'manifest.json'),sha256:sha(readFileSync(join(root,'manifest.json')))},
  toolSha256:sha(readFileSync(import.meta.filename)),
  interpretation:'Actual contacts with main segments displaced by the profile, relative to the same controls and incoming state at zero strength. Any-contact counts include glancing hits and do not establish traversal or useful riding. Timeline frames run at 40 fps; omitted frames have no collision with either rail of this support. Main segment zero is the approach. profilePhase is the segment midpoint in the construction heading schedule (null before its start), not rider time, arclength or a traversal score. Contacts include all rider points; simultaneous contacts do not establish ordering within a frame or continuous sliding. Guide IDs remain separate. This does not prove necessity or validate the zero-strength counterfactual ride.',rows});
console.log(JSON.stringify({tracks:rows.length,profiledSupports:rows.reduce((n,r)=>n+r.supports.length,0),
  supportsWithReshapedMainContact:rows.flatMap(r=>r.supports).filter(r=>r.reshapedMainContactFrames>0).length}));
