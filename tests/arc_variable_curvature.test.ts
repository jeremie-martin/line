import {it,expect} from 'vitest';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
const points=[{x:0,y:0},{x:4,y:0},{x:1,y:-2},{x:3,y:-2}],velocity={x:8,y:2};
const control={entry:15,turn:-90,exit:-45,support:8,bias:0,offset:.1,clearance:12};
it('retains exact default geometry and exposes only an active curvature bound',()=>{
  const diagnostics={curvatureActive:false};
  const original=motionArc(points,velocity,control,1000,false,12,false,24,diagnostics);
  expect(diagnostics.curvatureActive).toBe(true);
  expect(motionArc(points,velocity,{...control,radius:24},1000,false,12,false,24)).toEqual(original);
  const tighter=motionArc(points,velocity,{...control,radius:16},1000,false,12,false,24);
  expect(tighter).not.toEqual(original);expect(tighter.length).toBe(original.length);
  expect(tighter.every(line=>line.type===0)).toBe(true);
  const flat={curvatureActive:false};motionArc(points,{x:8,y:0},{...control,entry:0,turn:0,exit:0},1000,false,12,false,24,flat);
  expect(flat.curvatureActive).toBe(false);
});
