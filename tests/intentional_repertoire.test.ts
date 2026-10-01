import {describe,it,expect} from 'vitest';
import {planIntentionalRepertoire} from '../scripts/v0/optimizer/intentional_repertoire.ts';
import {planRepertoire,validateProductionPlan} from '../scripts/v0/optimizer/repertoire_policy.ts';
import {inspectLayout} from '../scripts/v0/optimizer/repertoire_layout.ts';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
import {normalizeArcControl} from '../scripts/v0/optimizer/arc_motion_control.ts';
const spec={duration:12,contacts:Array.from({length:12},(_,i)=>({t:.7+i*.9,impact:.02})),axes:{speed:()=>.35}};
describe('intentional arrangement',()=>{
 it('binds the plan to authored targets and preserves frozen V1 requests',()=>{
  const legacy=planRepertoire(spec,101),plan=planIntentionalRepertoire(spec,101);
  expect(validateProductionPlan(spec,legacy)).toEqual(legacy);
  expect(planIntentionalRepertoire(spec,101)).toEqual(plan);
  const changed={...spec,contacts:spec.contacts.map(c=>({...c,impact:.8}))};
  expect(()=>validateProductionPlan(changed,plan)).toThrow('musical targets');
  const forged=structuredClone(plan);forged.requests[1].context!.quiet=0;
  expect(()=>validateProductionPlan(spec,forged)).toThrow('context');
  const invalid=structuredClone(legacy);invalid.requests[1].railLayout='transfer';
  expect(()=>validateProductionPlan(spec,invalid)).toThrow();
 });
 it('uses musical context across the track without eliminating expressive choices',()=>{
  const lively={...spec,contacts:spec.contacts.map(c=>({...c,impact:.8}))};
  const all=(s:typeof spec)=>Array.from({length:40},(_,i)=>planIntentionalRepertoire(s,i).requests.slice(1)).flat();
  const quiet=all(spec),energetic=all(lively);
  expect(quiet.filter(r=>r.guidance==='forbidden').length).toBeGreaterThan(energetic.filter(r=>r.guidance==='forbidden').length*2);
  expect(quiet.some(r=>r.guidance==='required')).toBe(true);
  expect(new Set(energetic.map(r=>r.construction)).size).toBe(6);
  expect(energetic.some(r=>r.railLayout==='transfer')).toBe(true);
  expect(energetic.every(r=>r.railLayout!=='transfer'||r.guidance==='required'&&r.construction!=='scattered')).toBe(true);
 });
});
describe('independent guide geometry and deliberate transfer',()=>{
 const points=[{x:0,y:0},{x:8,y:0}],v={x:6,y:2},c={entry:0,turn:5,exit:30,support:18,bias:0,offset:0};
 it('leaves ordinary geometry unchanged and keeps the full guide when shortening support',()=>{
  const old=motionArc(points,v,c,1000,false,12),zero=motionArc(points,v,{...c,guideTilt:0},1000,false,12,false,0,4,{independentGuide:true});
  expect(zero).toEqual(old);
  const shortened=motionArc(points,v,{...c,mainEnd:.5},1000,false,12,false,0,4,{railLayout:'transfer'});
  const split=old.findIndex((l,i)=>i>0&&(old[i-1].x2!==l.x1||old[i-1].y2!==l.y1));
  expect(shortened.filter(l=>l.id>=old[split].id)).toEqual(old.slice(split));
  expect(shortened.length).toBeLessThan(old.length);
  expect(normalizeArcControl({...c,guideTilt:10,mainEnd:.5},{span:30})).toEqual(c);
 });
 it('requires physical transfer and an absent lower floor, not an unused guide',()=>{
  const main=[{id:1000,type:0,x1:-10,y1:0,x2:0,y2:0},{id:1001,type:0,x1:0,y1:0,x2:20,y2:0}];
  const guide={id:1010,type:0,x1:60,y1:-12,x2:40,y2:-12};
  const request={section:0,frame:1,next:10,construction:'arcs' as const,guidance:'required' as const,railLayout:'transfer' as const};
  expect(inspectLayout(request,[...main,guide],new Set([1010]),[[1001],[],[1010],[1010]]).fulfilled).toBe(true);
  expect(inspectLayout(request,[...main,guide],new Set([1010]),[[1001],[1010],[1010]]).reasons).toContain('missing-separated-transfer');
  expect(inspectLayout(request,[...main,{...main[1],id:1002,x1:20,x2:70},guide],new Set([1010]),[[1001],[],[1010],[1010]]).reasons).toContain('missing-separated-transfer');
  expect(inspectLayout({...request,construction:'fold'},[...main,guide],new Set([1010]),[[1001],[],[1010],[1010]]).reasons).toContain('missing-engaged-transfer-corners');
 });
});
