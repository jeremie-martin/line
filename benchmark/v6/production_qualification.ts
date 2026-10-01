/** Apply the frozen production comparison rules. No metric changes or filtering. */
import assert from 'node:assert/strict';
import {policy} from './policy.ts';
import type {summarizeMotion} from '../../scripts/v0/optimizer/motion_quality.ts';
export const productionSongs=['luna_bala_44s','amor_na_praia_46s','tiki_tiki_48s','amour_de_ma_vie_44s'] as const;
export const productionSeeds=[101,202,303] as const;
export const reportedWindows=[
 {song:'amour_de_ma_vie_44s',seed:303,from:9.1,to:9.7},
 {song:'tiki_tiki_48s',seed:101,from:15.05,to:15.65},
 {song:'amour_de_ma_vie_44s',seed:101,from:5.7,to:6.25},
] as const;
type Summary=ReturnType<typeof summarizeMotion>;
export type ProductionObservation={song:string;seed:number;method:string;valid:boolean;fulfilled:boolean;
 trackHash:string;durationFrames:number;full:Summary;opening:Summary;openingImpactRms:number|null;
 windows:Array<{from:number;to:number;summary:Summary}>};
const mean=(xs:number[])=>xs.reduce((n,x)=>n+x,0)/xs.length;
export function qualifyProductionMotion(baseline:ProductionObservation[],candidate:ProductionObservation[]){
 const expected=productionSongs.flatMap(song=>productionSeeds.map(seed=>song+':'+seed)).sort();
 const key=(r:ProductionObservation)=>r.song+':'+r.seed;
 const old=baseline.filter(r=>r.method==='production'),ordinary=baseline.filter(r=>r.method==='baseline'),next=candidate.filter(r=>r.method==='production');
 for(const [label,rows]of [['baseline',old],['ordinary',ordinary],['candidate',next]] as const)
  assert.deepEqual(rows.map(key).sort(),expected,`${label} must contain each of the twelve scheduled tracks exactly once`);
 const byKey=(rows:ProductionObservation[])=>new Map(rows.map(r=>[key(r),r]));
 const oldMap=byKey(old),ordinaryMap=byKey(ordinary);
 for(const r of next){assert.equal(r.durationFrames,oldMap.get(key(r))!.durationFrames);assert.equal(r.full.frames,r.durationFrames);}
 assert.ok(old.every(r=>r.valid&&r.fulfilled),'preserved automatic comparison must be complete');
 assert.ok(ordinary.every(r=>r.valid),'preserved ordinary reference must be complete');
 const completion=next.map(r=>({song:r.song,seed:r.seed,valid:r.valid,fulfilled:r.fulfilled,passed:r.valid&&r.fulfilled}));
 const burden=(rows:ProductionObservation[],frames:number)=>rows.reduce((n,r)=>n+r.full.bursts.find(b=>b.frames===frames)!.excessIntegral,0)/(rows.reduce((n,r)=>n+r.durationFrames,0)/40);
 const bursts=[1,4,10].map(frames=>{const before=burden(old,frames),after=burden(next,frames),limit=before*(1-policy.qualification.burstExcessReduction);
  return {frames,before,after,limit,reduction:before>0?1-after/before:null,passed:after<=limit+1e-9};});
 const windows=reportedWindows.map(w=>{const r=next.find(r=>r.song===w.song&&r.seed===w.seed)!,summary=r.windows.find(s=>s.from===w.from&&s.to===w.to)?.summary;
  assert.ok(summary,'reported window is missing');const band=summary.bursts.find(b=>b.frames===4)!;
  return {...w,maxExcess:band.maxExcess,maximum:band.maximum,passed:r.valid&&band.maxExcess<=1e-9};});
 const quiet=['luna_bala_44s','tiki_tiki_48s'].flatMap(song=>{
  const rows=next.filter(r=>r.song===song);
  return (['absoluteCorrection','directionCorrection'] as const).map(metric=>{
   const reference=mean(rows.map(r=>ordinaryMap.get(key(r))!.opening[metric])),actual=mean(rows.map(r=>r.opening[metric]));
   return {song,metric,reference,actual,limit:reference*policy.qualification.quietReferenceMultiplier,passed:actual<=reference*policy.qualification.quietReferenceMultiplier+1e-9};});
 });
 const calm=next.filter(r=>['luna_bala_44s','tiki_tiki_48s'].includes(r.song));
 const impactValid=calm.every(r=>r.openingImpactRms!==null&&oldMap.get(key(r))!.openingImpactRms!==null);
 const before=impactValid?mean(calm.map(r=>oldMap.get(key(r))!.openingImpactRms!)):null,after=impactValid?mean(calm.map(r=>r.openingImpactRms!)):null;
 const impacts={tracks:calm.map(r=>({song:r.song,seed:r.seed,before:oldMap.get(key(r))!.openingImpactRms,after:r.openingImpactRms})),
  before,after,limit:before===null?null:before*(1-policy.qualification.quietImpactErrorReduction),
  passed:before!==null&&after!==null&&after<=before*(1-policy.qualification.quietImpactErrorReduction)+1e-9};
 return {schema:'line.production-motion-qualification.v1',passed:[...completion,...bursts,...windows,...quiet,impacts].every(r=>r.passed),
  completion,bursts,windows,quiet,impacts,denominators:{tracks:12,quietTracks:6,ordinaryReferences:12},
  interpretation:'Frozen known-song motion criteria; not a universal aesthetic rating. Every scheduled replacement participates, including incomplete results.'};
}
