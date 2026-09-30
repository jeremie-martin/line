/** Visible geometry and measured quality remain separate selection criteria.
 * No scorer changes, learned aesthetic weights, or per-passage rules. */
import {arcRailGroups} from './arc_guidance.ts';
import type {TrackLine} from '../types.ts';

export function guideFootprint(lines:TrackLine[]){
  const groups=arcRailGroups(lines),guides=[...groups.values()].map(chains=>chains[1]??[]);
  return {supportSections:groups.size,guideSections:guides.filter(g=>g.length).length,
    guideLength:guides.flat().reduce((sum,l)=>sum+Math.hypot(l.x2-l.x1,l.y2-l.y1),0)};
}
export type GuideAlternative={id:string;valid:boolean;qualityRms:number|null;usage:ReturnType<typeof guideFootprint>};
export const measuredGuideAlternative=(a:GuideAlternative)=>a.valid&&a.qualityRms!==null&&Number.isFinite(a.qualityRms)&&a.qualityRms>=0;
export function compareGuideFootprint(a:GuideAlternative,b:GuideAlternative){
  return a.usage.guideSections-b.usage.guideSections||a.usage.guideLength-b.usage.guideLength||a.qualityRms!-b.qualityRms!||a.id.localeCompare(b.id);
}
/** Representatives of the measured error envelope over every integer guide cap.
 * This schedules search, not delivery. Keep both endpoints, then fill the largest
 * error gaps between them, without specifying preferred guide counts or weights. */
export function guideCoverageFrontier<T extends GuideAlternative>(alternatives:T[],width=3):T[]{
  if(!Number.isSafeInteger(width)||width<2)throw new Error('guide coverage needs at least two paths');
  const valid=alternatives.filter(measuredGuideAlternative);
  if(!valid.length)return [];
  const accurate=valid.slice().sort((a,b)=>a.qualityRms!-b.qualityRms!||compareGuideFootprint(a,b))[0];
  const sparse=valid.slice().sort((a,b)=>a.usage.guideSections-b.usage.guideSections||a.qualityRms!-b.qualityRms!||compareGuideFootprint(a,b))[0];
  const selected=accurate.id===sparse.id?[accurate]:[accurate,sparse];
  const caps=Array.from({length:accurate.usage.guideSections-sparse.usage.guideSections+1},(_,i)=>i+sparse.usage.guideSections);
  while(selected.length<width){
    const current=caps.map(cap=>Math.min(...selected.filter(c=>c.usage.guideSections<=cap).map(c=>c.qualityRms!)));
    const gain=(c:T)=>caps.reduce((sum,cap,i)=>sum+(c.usage.guideSections<=cap?Math.max(0,current[i]-c.qualityRms!):0),0);
    const ranked=valid.filter(c=>!selected.includes(c)).map(c=>({c,gain:gain(c)})).sort((a,b)=>b.gain-a.gain||compareGuideFootprint(a.c,b.c));
    if(!ranked.length||ranked[0].gain<=0)break;
    selected.push(ranked[0].c);
  }
  return selected;
}
/** A fixed candidate set makes increasing tolerance monotonically expand the
 * eligible set. It never changes the benchmark or runs another search. */
export function selectGuideAlternative<T extends GuideAlternative>(alternatives:T[],extraRms:number){
  if(!Number.isFinite(extraRms)||extraRms<0)throw new Error('guide preference requires a finite nonnegative error tolerance');
  const valid=alternatives.filter(measuredGuideAlternative);
  if(!valid.length)return null;
  const best=valid.slice().sort((a,b)=>a.qualityRms!-b.qualityRms!||compareGuideFootprint(a,b))[0];
  const ceiling=best.qualityRms!+extraRms;
  const eligible=valid.filter(a=>a.qualityRms!<=ceiling);
  const selected=eligible.slice().sort(compareGuideFootprint)[0];
  return {best,selected,ceiling,eligible:eligible.length,extraRms:selected.qualityRms!-best.qualityRms!};
}
