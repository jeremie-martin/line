import {expect,it} from 'vitest';
import {motionArc,type ArcMotionControl} from '../scripts/v0/optimizer/arc_geometry.ts';
import {normalizeArcControl,arcMethodKeys} from '../scripts/v0/optimizer/arc_motion_control.ts';

it('retains a complete smooth motif followed by a connected straight runout',()=>{
 const control:ArcMotionControl={entry:0,turn:0,exit:0,support:40,bias:0,offset:0};
 for(const profile of ['serpentine','scallops','terraces'] as const){
  const style={profile,profileStart:0,profileStrength:.8,rippleCycles:profile==='scallops'?1:undefined};
  const build=(c:ArcMotionControl)=>motionArc([{x:0,y:0}],{x:8,y:0},c,1000,false,0,false,0,4,style);
  const original=build(control),explicit=build({...control,profileEnd:1}),compact=build({...control,profileEnd:.4});
  expect(explicit).toEqual(original);
  expect(compact).toHaveLength(original.length);
  expect(compact.every(l=>l.type===0)).toBe(true);
  for(let i=1;i<compact.length;i++)expect([compact[i].x1,compact[i].y1]).toEqual([compact[i-1].x2,compact[i-1].y2]);
  const headings=compact.slice(1).map(l=>Math.atan2(l.y2-l.y1,l.x2-l.x1));
  expect(Math.max(...headings.slice(0,64))).toBeGreaterThan(.15);
  expect(Math.min(...headings.slice(0,64))).toBeLessThan(-.1);
  expect(headings.slice(64).every(a=>Math.abs(a)<1e-12)).toBe(true);
  expect(original.slice(80).some(l=>Math.abs(l.y2-l.y1)>.1)).toBe(true);
 }
});

it('keeps duration search specific to experimental smooth transfer constructions',()=>{
 const c:ArcMotionControl={entry:0,turn:0,exit:0,support:40,bias:0,offset:0,profileEnd:.3};
 const style={span:100,profile:'scallops' as const,railLayout:'transfer' as const,compactProfileProposals:true};
 expect(normalizeArcControl(c,style).profileEnd).toBe(.3);
 expect(arcMethodKeys('response',true,false,true,style)).toContain('profileEnd');
 for(const other of [{...style,compactProfileProposals:false},{...style,profile:'fold' as const},{...style,railLayout:'paired' as const}]){
  expect(normalizeArcControl(c,other).profileEnd).toBeUndefined();
  expect(arcMethodKeys('response',true,false,true,other)).not.toContain('profileEnd');
 }
});
