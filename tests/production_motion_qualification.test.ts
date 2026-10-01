import {describe,it,expect} from 'vitest';
import {productionSongs,productionSeeds,reportedWindows,qualifyProductionMotion,type ProductionObservation} from '../benchmark/v6/production_qualification.ts';
import {summarizeMotion} from '../scripts/v0/optimizer/motion_quality.ts';
function fixture(){
 const rows=(method:string,old:boolean):ProductionObservation[]=>productionSongs.flatMap(song=>productionSeeds.map(seed=>{
  const full={...summarizeMotion([],1),frames:1760,absoluteCorrection:1,directionCorrection:1};
  full.bursts=full.bursts.map(b=>({...b,excessIntegral:old?1:0,maxExcess:old?1:0}));
  return {song,seed,method,trackHash:`${song}-${seed}-${method}`,valid:true,fulfilled:true,durationFrames:1760,full,
   opening:full,openingImpactRms:old?.1:.01,windows:reportedWindows.filter(w=>w.song===song&&w.seed===seed).map(w=>({...w,summary:full}))};
 }));
 return {baseline:[...rows('baseline',false),...rows('production',true)],candidate:rows('production',false)};
}
describe('complete production motion qualification',()=>{
 it('requires measured reductions and refuses omitted or duplicate tracks',()=>{
  const {baseline,candidate}=fixture();expect(qualifyProductionMotion(baseline,candidate).passed).toBe(true);
  expect(qualifyProductionMotion(baseline,baseline).passed).toBe(false);
  expect(()=>qualifyProductionMotion(baseline,candidate.slice(1))).toThrow('twelve');
  expect(()=>qualifyProductionMotion(baseline,[...candidate.slice(1),candidate[1]])).toThrow('twelve');
 });
 it('retains a motion failure and incomplete realization independently of the averages',()=>{
  const {baseline,candidate}=fixture();candidate[0].fulfilled=false;
  const window=candidate.find(r=>r.windows.length)!.windows[0];window.summary=structuredClone(window.summary);window.summary.bursts[1].maxExcess=.2;
  const result=qualifyProductionMotion(baseline,candidate);
  expect(result.bursts.every(b=>b.passed)).toBe(true);expect(result.passed).toBe(false);
  expect(result.completion).toHaveLength(12);expect(result.windows.some(w=>!w.passed)).toBe(true);
 });
});
