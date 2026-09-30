import {expect,it} from 'vitest';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
import {MOTION_PROFILES} from '../scripts/v0/optimizer/motion_profiles.ts';
import {RAIL_CONTOURS,railContours} from '../scripts/v0/optimizer/rail_contours.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {galleryArcOptions} from '../scripts/gallery/methods.ts';
import {makeSolidLine} from '../scripts/v0/arc.ts';
import type {Spec} from '../scripts/v0/types.ts';
const points=[{x:0,y:0},{x:12,y:1},{x:4,y:9}],v={x:9,y:2};
const control={entry:12,turn:-20,exit:25,support:20,bias:.2,offset:.1};

it('builds six distinct normal geometries without changing ordinary arcs or the input',()=>{
  const original=structuredClone({points,v,control});
  const base=motionArc(points,v,control,1000,false,12,false,24);
  expect(motionArc(points,v,control,1000,false,12,false,24,4,{})).toEqual(base);
  const shapes=[...MOTION_PROFILES.map(profile=>motionArc(points,v,control,1000,false,12,false,24,4,{profile})),
    ...RAIL_CONTOURS.map(contour=>motionArc(points,v,control,1000,false,12,false,24,4,{contour}))];
  expect(new Set([base,...shapes].map(lines=>JSON.stringify(lines)))).toHaveLength(7);
  for(const lines of shapes){
    expect(new Set(lines.map(l=>l.id)).size).toBe(lines.length);
    expect(lines.every(l=>l.type===0&&!l.leftExtended&&!l.rightExtended&&Number.isFinite(Math.hypot(l.x2-l.x1,l.y2-l.y1))&&Math.hypot(l.x2-l.x1,l.y2-l.y1)>0)).toBe(true);
  }
  expect({points,v,control}).toEqual(original);
});
it('keeps ribbon rungs unique and their collision normals facing upstream',()=>{
  const input=[makeSolidLine(1000,0,0,84,0)];
  const out=railContours(input,'ribbon',1001);
  const rungs=out.filter(l=>l.x1===l.x2);
  expect(rungs).toHaveLength(4);
  expect(new Set(rungs.map(l=>l.x1)).size).toBe(4);
  for(const l of rungs)expect(-(l.y2-l.y1)*(l.flipped?-1:1)).toBeLessThan(0);
  expect(out[0]).toEqual(input[0]);
  expect(()=>railContours([{...input[0],type:1}],'teeth',1001)).toThrow('normal lines');
  expect(()=>railContours([makeSolidLine(0,0,0,0,0)],'teeth',1)).toThrow('nondegenerate');
});
it.each([...MOTION_PROFILES,...RAIL_CONTOURS])('searches and independently replays %s within the same budget, with memo parity',method=>{
  const spec:Spec={duration:2,preroll:5,jitter:0,contacts:[.5,1,1.5,2].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
  const options={budget:25000,samples:24,channel:12,radius:24,bidirectional:true,pruneGuidance:true,memoCandidates:true,...galleryArcOptions(method)};
  const result=compileArcMotion(spec,17,options);
  expect(result.track.lines.length).toBeGreaterThan(0);
  expect(result.track.lines.every(l=>l.type===0)).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
  expect(compileArcMotion(spec,17,{...options,reuseEvaluations:true}).track).toEqual(result.track);
  if(RAIL_CONTOURS.includes(method as any))expect(result.guidanceReduction).toBeNull();
});

it.each(RAIL_CONTOURS)('repeats the complete %s structure across the rail',kind=>{
  const out=railContours([makeSolidLine(0,0,0,84,0)],kind,1);
  for(const x of [14,42,70]){
    const depth=kind==='ribbon'?12:kind==='teeth'?20:14;
    expect(out.some(l=>Math.abs(l.x2-x)<1e-9&&Math.abs(l.y2-depth)<1e-9)).toBe(true);
  }
});

it('offers full paired guides independently of archived contour experiments',async()=>{
  const {galleryActiveMethods}=await import('../scripts/gallery/methods.ts');
  expect(galleryActiveMethods).toContain('paired');
  for(const method of RAIL_CONTOURS)expect(galleryActiveMethods).not.toContain(method);
  const spec:Spec={duration:2,preroll:5,jitter:0,contacts:[.5,1,1.5,2].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
  const options={budget:25000,samples:24,channel:12,radius:24,bidirectional:true,pruneGuidance:true};
  const trimmed=compileArcMotion(spec,17,options),full=compileArcMotion(spec,17,{...options,...galleryArcOptions('paired')});
  expect(full.guidanceReduction).toBeNull();
  expect(trimmed.guidanceReduction.removedSegments).toBeGreaterThan(0);
  expect(full.track.lines.length).toBeGreaterThan(trimmed.track.lines.length);
  expect(full.stats.sim_frames).toBe(trimmed.stats.sim_frames);
  const retained=new Map(full.track.lines.map(l=>[l.id,l]));
  for(const line of trimmed.track.lines)expect(retained.get(line.id)).toEqual(line);
});
