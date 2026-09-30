/** Contact inspection reads actual collision IDs, never geometric proximity. */
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {galleryMethodDetails} from './methods.ts';
import type {TrackLine} from '../v0/types.ts';
type RecordInput={method:string;railLayout?:string;railGuides?:Record<number,number[]>;track:{lines:TrackLine[]}};
export function inspectRailContacts(record:RecordInput,contacts:number[][]){
  const layout=record.railLayout??galleryMethodDetails[record.method]?.railLayout;
  const groups=layout==='connected'?arcRailGroups(record.track.lines):null;
  const guideIds=new Set<number>(),guideGroups=new Map<number,number>();
  for(const [group,chains]of groups??[])for(const line of chains[1]??[]){guideIds.add(line.id);guideGroups.set(line.id,group);}
  const lineIds=new Set(record.track.lines.map(l=>l.id));
  if(layout==='mixed'){
    if(!record.railGuides)throw new Error('mixed construction requires explicit rail roles');
    for(const [section,ids]of Object.entries(record.railGuides))for(const id of ids){
      if(!lineIds.has(id)||guideIds.has(id)||Math.floor((id-1000)/10000)!==Number(section))throw new Error('invalid recorded guide role');
      guideIds.add(id);guideGroups.set(id,Number(section));
    }
  }
  const touched=new Set<number>(),touchedGroups=new Set<number>(),guideFrames:number[]=[];
  const byFrame=contacts.map((ids,frame)=>{
    if(ids.some(id=>!lineIds.has(id)))throw new Error('Collision references a missing track segment');
    const all=[...new Set(ids)],guides=all.filter(id=>guideIds.has(id));
    for(const id of guides){touched.add(id);touchedGroups.add(guideGroups.get(id)!);}
    if(guides.length)guideFrames.push(frame);
    return {all,guides};
  });
  return {layout,guideIds,guideFrames,byFrame,summary:{
    supportSections:groups?.size??(layout==='mixed'?new Set(record.track.lines.map(l=>Math.floor((l.id-1000)/10000))).size:null),guideSections:new Set(guideGroups.values()).size,
    touchedGuideSections:touchedGroups.size,guideSegments:guideIds.size,touchedGuideSegments:touched.size,
  }};
}
