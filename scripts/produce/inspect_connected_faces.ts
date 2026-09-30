/** Inspect actual collisions with the long faces of selected connected rails.
 * Final-frame point projections describe progress, not exact collision locations
 * within the solver or a proof of continuous sliding around a corner. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join,dirname,basename} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {writeGalleryJson} from '../gallery/artifacts.ts';
const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=
  await import(new URL('../lib/native_motion/engine.ts?face-inspection',import.meta.url).href);
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('study')&&arg('out'));
const root=resolve(arg('study')!),out=resolve(arg('out')!);
function read(path:string){const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(bytes.toString());}
const manifest=read(join(root,'manifest.json')),rows:any[]=[];
for(const cell of manifest.cells){
  const record=read(join(root,cell.path));assert.equal(sha(readFileSync(join(root,cell.path))),cell.sha256);
  const fragments=new Set<number>(record.construction.fragmentSections??[]);
  const groups=arcRailGroups(record.track.lines.filter((l:any)=>!fragments.has(Math.floor((l.id-1000)/10000)))),selected=Object.entries(record.construction.styles).filter(([,style]:any)=>style.faces!==undefined);
  if(!selected.length)continue;
  try{
    const engine=new Engine().setStart(record.track.startPosition,record.track.riders[0].startVelocity).addLine(record.track.lines);
    const states:any[]=record.trace.frames.map((frame:number[],f:number)=>{
      const state=engine.getRider(f).ballisticState();
      assert.deepEqual(record.trace.pointIds.flatMap((id:string)=>[state.points[id].x,state.points[id].y]),frame);
      return state;
    });
    const collisions=states.map((_,f)=>engine.getUpdatesAtFrame(f).filter((u:any)=>u.type==='CollisionUpdate'));
    assert.equal(sha(JSON.stringify(collisions.map(events=>[...new Set<number>(events.map((u:any)=>u.id))].sort((a,b)=>a-b)))),cell.collisionSha256);
    const supports=selected.flatMap(([key,style]:any)=>{
      const section=Number(key),chains=groups.get(section);if(!chains)return [];
      const main=chains[0],guide=new Set((chains[1]??[]).map(l=>l.id)),byId=new Map(main.map((l,i)=>[l.id,i]));
      const timeline=collisions.flatMap((events,frame)=>{
        const relevant=events.filter((e:any)=>byId.has(e.id)||guide.has(e.id));
        const contacts=[...new Map(relevant.map((e:any)=>[e.id+':'+e.updated[0].id,e])).values()].map((e:any)=>{
          const index=byId.get(e.id),pointId=e.updated[0].id;
          if(index===undefined)return {id:e.id,role:'guide',pointId};
          const l=main[index],p=states[frame].points[pointId],dx=l.x2-l.x1,dy=l.y2-l.y1;
          return {id:e.id,role:index===0?'approach':'main',face:index,pointId,
            finalFrameProjection:((p.x-l.x1)*dx+(p.y-l.y1)*dy)/(dx*dx+dy*dy)};
        });
        return contacts.length?[{frame,contacts}]:[];
      });
      const faces=main.map((l,index)=>{
        const entries=timeline.flatMap(f=>f.contacts.filter((c:any)=>c.face===index).map((c:any)=>({frame:f.frame,...c})));
        return {index,id:l.id,role:index===0?'approach':'main',length:Math.hypot(l.x2-l.x1,l.y2-l.y1),
          headingDegrees:Math.atan2(l.y2-l.y1,l.x2-l.x1)*180/Math.PI,
          contactFrames:new Set(entries.map(e=>e.frame)).size,
          firstFrame:entries[0]?.frame??null,lastFrame:entries.at(-1)?.frame??null,
          pointProgress:Object.fromEntries([...new Set(entries.map(e=>e.pointId))].map(id=>{
            const es=entries.filter(e=>e.pointId===id);return [id,{frames:es.map(e=>e.frame),
              first:es[0].finalFrameProjection,last:es.at(-1)!.finalFrameProjection,
              min:Math.min(...es.map(e=>e.finalFrameProjection)),max:Math.max(...es.map(e=>e.finalFrameProjection))}];
          }))};
      });
      const guides=(chains[1]??[]).map(l=>{
        const frames=timeline.filter(f=>f.contacts.some((c:any)=>c.id===l.id)).map(f=>f.frame);
        return {id:l.id,length:Math.hypot(l.x2-l.x1,l.y2-l.y1),headingDegrees:Math.atan2(l.y2-l.y1,l.x2-l.x1)*180/Math.PI,
          contactFrames:frames.length,firstFrame:frames[0]??null,lastFrame:frames.at(-1)??null};
      });
      return [{section,style,faces,guides,timeline}];
    });
    rows.push({id:cell.id,valid:record.valid,trackHash:record.trackHash,collisionSha256:cell.collisionSha256,supports});
  }finally{dispose();}
}
writeGalleryJson(dirname(out),basename(out),{schema:'line.connected-face-inspection.v1',
  manifest:{path:join(root,'manifest.json'),sha256:sha(readFileSync(join(root,'manifest.json')))},
  toolSha256:sha(readFileSync(import.meta.filename)),
  interpretation:'Collisions are real engine events, separated by main face, guide and rider point. Projections use the contacted point at the end of its frame, after all solver updates; they are not exact within-solver collision positions. Ordered contact and progress do not by themselves prove uninterrupted sliding or artistic value. Missing sections in invalid partial rides are not successful constructions.',rows});
console.log(JSON.stringify({tracks:rows.length,supports:rows.reduce((n,r)=>n+r.supports.length,0)}));
