import {it,expect}from 'vitest';
import {compileArcMotion}from '../scripts/v0/optimizer/arc_motion.ts';
import {composeRepertoire}from '../scripts/v0/optimizer/repertoire_composition.ts';
import {validateRepertoirePlan,resolveComposition,type RepertoirePlan}from '../scripts/v0/optimizer/repertoire_plan.ts';
import {arcRailGroups}from '../scripts/v0/optimizer/arc_guidance.ts';
import type{Spec}from '../scripts/v0/types.ts';
const spec:Spec={duration:6,preroll:5,jitter:0,contacts:Array.from({length:9},(_,i)=>({t:(i+1)*.6,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const plan:RepertoirePlan={schema:'line.repertoire-plan.v1',title:'Repeated fragments with shaped returns',song:'test',phrases:[
 {title:'First dots',start:.6,end:.7,recipe:'scattered'},
 {title:'Ripples',start:1.2,end:1.3,recipe:'scallops',controls:{profileStrength:.6,profileStart:0,rippleCycles:1}},
 {title:'Dots return',start:2.4,end:2.5,recipe:'scattered'},
 {title:'Terrace',start:3.6,end:3.7,recipe:'terraces',controls:{profileStrength:.7}},
]};
it('validates a composition without changing the authored specification',()=>{
 expect(validateRepertoirePlan(plan)).toEqual(plan);
 for(const p of [{...plan,phrases:[{...plan.phrases[0],controls:{guides:false}}]},
  {...plan,phrases:[plan.phrases[1],plan.phrases[0]]},{...plan,extra:true},
  {...plan,phrases:[{...plan.phrases[1],controls:{rippleCycles:0}}]},
  {...plan,phrases:[{...plan.phrases[1],recipe:'single',controls:{guides:true}}]}])expect(()=>validateRepertoirePlan(p)).toThrow();
 expect(()=>resolveComposition({...plan,phrases:[{...plan.phrases[0],start:7,end:8}]},[{frame:1}],6)).toThrow('beyond');
});
it('realizes multiple scattered phrases, preserves earlier fragments and accounts for all stages',()=>{
 const source=compileArcMotion(spec,17,{budget:300000,samples:64,channel:12,radius:24,bidirectional:true,impactWeight:1,amplitudeWeight:1/3,
  arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,guidance:'clearance',guidanceSamples:24,pruneGuidance:true,collectTrajectoryLoss:true});
 const before=JSON.stringify(spec),original=JSON.stringify(source.track);
 const composed=composeRepertoire(spec,17,source,plan,650000);
 expect(composed.valid).toBe(true);expect(composed.attempts).toHaveLength(2);
 expect(composed.fragmentSections).toEqual([1,4]);
 expect(composed.physicalFrames).toBe(composed.attempts.reduce((n,a)=>n+a.physicalFrames,0));expect(composed.physicalFrames).toBeLessThanOrEqual(650000);
 const prefix=(lines:any[])=>lines.filter(l=>Math.floor((l.id-1000)/10000)<1);
 expect(prefix(composed.result.track.lines)).toEqual(prefix(source.track.lines));
 expect(composed.result.track.lines.every(l=>l.type===0)).toBe(true);
 for(const i of [1,4])expect(composed.railGuides?.[i]).toBeDefined();
 const connected=arcRailGroups(composed.result.track.lines.filter(l=>!composed.fragmentSections.includes(Math.floor((l.id-1000)/10000))));
 expect(connected.has(2)&&connected.has(6)).toBe(true);
 expect(JSON.stringify(spec)).toBe(before);expect(JSON.stringify(source.track)).toBe(original);
});
