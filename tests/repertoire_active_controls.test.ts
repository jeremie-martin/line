import {it,expect} from 'vitest';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
import {normalizeArcControl,arcMethodKeys} from '../scripts/v0/optimizer/arc_motion_control.ts';
it('removes a geometrically inactive full-fold coordinate without changing its linework',()=>{
 const style={profile:'fold' as const,profileStart:0,profileStrength:1,faces:3,foldAngle:30};
 const control={entry:10,turn:12,exit:20,support:12,bias:.2,offset:.1,bend:30};
 const normalized=normalizeArcControl(control,{span:30,...style});
 expect(normalized.bend).toBeUndefined();
 const points=[{x:0,y:0},{x:5,y:1},{x:10,y:-1}];
 expect(motionArc(points,{x:8,y:2},normalized,1000,false,12,false,24,4,style))
 .toEqual(motionArc(points,{x:8,y:2},control,1000,false,12,false,24,4,style));
 expect(arcMethodKeys('response',true,false,true,style)).not.toContain('bend');
 for(const active of [{...style,profileStrength:.8},{...style,profileStart:.8},{profile:'serpentine'}]){
  expect(arcMethodKeys('response',true,false,true,active)).toContain('bend');
  expect(normalizeArcControl(control,{span:30,...active}).bend).toBe(30);
 }
});
