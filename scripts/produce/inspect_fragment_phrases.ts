/** Descriptive checks for the preserved mixed tracks: parent collision planes,
 * actual fragment/guide contacts, and body motion through the searched return. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join,dirname,basename} from 'node:path';
import {sha} from '../../benchmark/v3/model.ts';
import {replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('study')&&arg('out'));
const root=resolve(arg('study')!),out=resolve(arg('out')!);
function read(path:string){const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(bytes.toString());}
const manifest=read(join(root,'manifest.json')),rows:any[]=[];
for(const cell of manifest.cells.filter((c:any)=>c.railLayout==='mixed')){
  const r=read(join(root,cell.path)),baseCell=manifest.cells.find((c:any)=>c.caseId===cell.caseId&&c.seed===cell.seed&&c.method==='baseline');
  assert.equal(sha(readFileSync(join(root,cell.path))),cell.sha256);
  const base=read(join(root,baseCell.path));assert.equal(base.trackHash,r.construction.baseTrackHash);
  const c=manifest.plan.cases.find((c:any)=>c.id===cell.caseId),replay=replayGalleryTrack(r.track,c,true);
  assert.equal(sha(JSON.stringify(replay.collisionIds)),cell.collisionSha256);
  assert.deepEqual(replay.trace,r.trace);
  const construction=r.construction.fragmentConstruction,parents=new Map<number,any>(base.track.lines.map((l:any)=>[l.id,l]));
  const fragments=new Map<number,any>(r.track.lines.filter((l:any)=>Object.hasOwn(construction.provenance,l.id)).map((l:any)=>[l.id,l]));
  assert.equal(fragments.size,Object.keys(construction.provenance).length);
  let maximumPlaneDistance=0;
  for(const [id,l]of fragments){
    const parent=parents.get(construction.provenance[id]);assert.ok(parent);
    assert.equal(Math.floor((id-1000)/10000),Math.floor((parent.id-1000)/10000));
    assert.equal(l.type,0);assert.equal(l.flipped,parent.flipped);
    const dx=parent.x2-parent.x1,dy=parent.y2-parent.y1,length=Math.hypot(dx,dy);
    for(const [x,y]of [[l.x1,l.y1],[l.x2,l.y2]])maximumPlaneDistance=Math.max(maximumPlaneDistance,Math.abs((x-parent.x1)*dy-(y-parent.y1)*dx)/length);
  }
  assert.ok(maximumPlaneDistance<1e-8,'fragment moved off its observed parent plane');
  assert.deepEqual(r.trace.frames.slice(0,r.construction.boundaryFrame+1),base.trace.frames.slice(0,r.construction.boundaryFrame+1));
  let maximumBodyDifference=0;
  for(let f=0;f<=construction.continuationBoundary;f++)for(let p=0;p<r.trace.frames[f].length;p+=2)
    maximumBodyDifference=Math.max(maximumBodyDifference,Math.hypot(r.trace.frames[f][p]-base.trace.frames[f][p],r.trace.frames[f][p+1]-base.trace.frames[f][p+1]));
  const sections=r.construction.fragmentSections.map((section:number)=>{
    const ids=new Set([...fragments.keys()].filter(id=>Math.floor((id-1000)/10000)===section)),guides=new Set<number>(r.railGuides[section]);
    const touched=new Set<number>(),timeline=replay.collisionIds!.flatMap((contact,frame)=>{
      const here=contact.filter(id=>ids.has(id));here.forEach(id=>touched.add(id));
      return here.length?[{frame,main:here.filter(id=>!guides.has(id)),guides:here.filter(id=>guides.has(id))}]:[];
    });
    return {section,fragments:ids.size,touchedFragments:touched.size,guideFragments:guides.size,timeline};
  });
  rows.push({id:r.id,trackHash:r.trackHash,sourceTrackHash:base.trackHash,width:construction.width,
    returnFrame:construction.continuationBoundary,maximumBodyDifferenceThroughReturn:maximumBodyDifference,maximumPlaneDistance,
    fixedSuffixValid:construction.fixedSuffixValid,completeComposedRideValid:r.valid,sections});
}
writeGalleryJson(dirname(out),basename(out),{schema:'line.fragment-phrase-inspection.v1',
  manifest:{path:join(root,'manifest.json'),sha256:sha(readFileSync(join(root,'manifest.json')))},toolSha256:sha(readFileSync(import.meta.filename)),
  interpretation:'Fragments deliberately realize the source motion, rather than invent a new motion. Body error is measured through the boundary before the searched return. The later continuation may change substantially. Plane distance and contact counts are checks, not aesthetic scores or necessity proofs.',rows});
console.log(JSON.stringify(rows.map(({sections,...r})=>r)));
