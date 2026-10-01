import {expect,it} from 'vitest';
import {motionArc,arcMainSteps} from '../scripts/v0/optimizer/arc_geometry.ts';
import {MOTION_PROFILES,foldTime} from '../scripts/v0/optimizer/motion_profiles.ts';
import {RAIL_CONTOURS,railContours} from '../scripts/v0/optimizer/rail_contours.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {galleryArcOptions} from '../scripts/gallery/methods.ts';
import {makeSolidLine} from '../scripts/v0/arc.ts';
import type {Spec} from '../scripts/v0/types.ts';
const points=[{x:0,y:0},{x:12,y:1},{x:4,y:9}],v={x:9,y:2};
const control={entry:12,turn:-20,exit:25,support:20,bias:.2,offset:.1};

it('can anchor a full fold on its actual first face without adding an approach corner',()=>{
 const style={profile:'fold' as const,faces:3,profileStart:0,profileStrength:1};
 const build=(alignedFoldEntry=false)=>motionArc(points,v,control,1000,false,12,false,24,4,{...style,alignedFoldEntry});
 const lines=build(true),angle=(l:any)=>Math.atan2(l.y2-l.y1,l.x2-l.x1);
 expect(angle(lines[0])).toBeCloseTo(angle(lines[1]),12);
 expect(build()).toEqual(motionArc(points,v,control,1000,false,12,false,24,4,style));
 expect(lines).not.toEqual(build());
});

it('can keep a fold entry compact before a long runout without changing its face headings',()=>{
  const style={profile:'fold' as const,faces:3,profileStart:0,foldAngle:40};
  const c={...control,support:180,turnFraction:.1,bias:-2};
  const build=(foldTiming?:number)=>motionArc(points,v,{...c,foldTiming},1000,false,0,false,0,4,style);
  const original=build(),compact=build(1);
  expect(build(0)).toEqual(original);
  expect(compact).toHaveLength(original.length);
  const length=(l:any)=>Math.hypot(l.x2-l.x1,l.y2-l.y1);
  expect(length(compact[1])).toBeLessThan(length(original[1]));
  expect(length(compact[2])).toBeLessThan(length(original[2]));
  for(let i=1;i<original.length;i++){
    expect(length(compact[i])).toBeGreaterThan(0);
    expect(Math.atan2(compact[i].y2-compact[i].y1,compact[i].x2-compact[i].x1))
      .toBeCloseTo(Math.atan2(original[i].y2-original[i].y1,original[i].x2-original[i].x1),12);
  }
});

it('moves fold corners without losing the selected headings or total support time',()=>{
  for(const first of [.1,1/3,.85])for(const bias of [-2,0,2]){
    const times=Array.from({length:61},(_,i)=>foldTime(i/60,first,bias));
    expect(times[0]).toBe(0);expect(times.at(-1)).toBe(1);
    expect(times.every((t,i)=>!i||t>times[i-1])).toBe(true);
    for(let i=1;i<=3;i++)expect(foldTime(i/3,first,bias)-foldTime((i-1)/3,first,bias)).toBeGreaterThanOrEqual(.2-1e-12);
  }
  const style={profile:'fold' as const,faces:3,profileStart:0,foldAngle:40};
  const build=(c:any,s:any=style)=>motionArc(points,v,c,1000,false,0,false,0,4,s);
  const a=build(control),b=build({...control,bias:-1,turnFraction:.6});
  expect(a).not.toEqual(b);
  for(let i=1;i<a.length;i++)expect(Math.atan2(a[i].y2-a[i].y1,a[i].x2-a[i].x1)).toBeCloseTo(Math.atan2(b[i].y2-b[i].y1,b[i].x2-b[i].x1),12);
  expect(build(control,{...style,profileStrength:0})).toEqual(build(control,{faces:3}));
  expect(motionArc(points,v,control,1000,false,12,false,24,4,{...style,profileStrength:0}))
    .toEqual(motionArc(points,v,control,1000,false,12,false,24,4,{faces:3}));
  for(const bias of [-2,2])for(const turnFraction of [.1,.85]){
    const lines=motionArc(points,v,{...control,bias,turnFraction},1000,false,12,false,24,4,style);
    const angles=lines.slice(1,4).map(l=>Math.atan2(l.y2-l.y1,l.x2-l.x1)*180/Math.PI);
    expect(angles[1]-(angles[0]+angles[2])/2).toBeCloseTo(40,10);
  }
  for(const s of [{foldAngle:30},{profile:'scallops',foldAngle:30},{...style,foldAngle:Infinity},{...style,foldAngle:76}])
    expect(()=>build(control,s)).toThrow('profile controls');
});

it('keeps a deliberate face count across support lengths and verifies physical continuity',()=>{
  for(const support of [5,20,35])for(const faces of [2,3,4]){
    const lines=motionArc(points,v,{...control,support},1000,false,0,false,24,4,{faces});
    expect(lines.length).toBe(faces+1);
    expect(lines.every(l=>l.type===0)).toBe(true);
    for(let i=1;i<lines.length;i++)expect([lines[i].x1,lines[i].y1]).toEqual([lines[i-1].x2,lines[i-1].y2]);
  }
  for(const faces of [0,1,2.5,25,NaN,Infinity])expect(()=>arcMainSteps(10,4,faces)).toThrow('arc faces');
  expect(arcMainSteps(10)).toBe(40);
});

it('searches fixed faces without bypassing real geometry or memo identity',()=>{
  const spec:Spec={duration:2,preroll:5,jitter:0,contacts:[.5,1,1.5,2].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
  const options={budget:25000,samples:24,channel:12,radius:24,bidirectional:true,pruneGuidance:true,memoCandidates:true,faces:3};
  const a=compileArcMotion(spec,17,options),b=compileArcMotion(spec,17,{...options,reuseEvaluations:true});
  expect(a.track).toEqual(b.track);expect(a.stats.sim_frames).toBeLessThanOrEqual(options.budget);
  expect(a.rows.length).toBeGreaterThan(0);
  for(const row of a.rows)expect(a.track.lines.filter(l=>l.id>=1000+a.rows.indexOf(row)*10000&&l.id<1004+a.rows.indexOf(row)*10000)).toHaveLength(4);
});

it('varies physical profile strength while preserving default and zero-strength geometry',()=>{
  const build=(style?:Parameters<typeof motionArc>[9])=>motionArc(points,v,control,1000,false,12,false,24,4,style);
  for(const profile of MOTION_PROFILES){
    expect(build({profile,profileStrength:0})).toEqual(build());
    expect(build({profile,profileStrength:1})).toEqual(build({profile}));
    expect(build({profile,profileStrength:1.5})).not.toEqual(build({profile}));
  }
  for(const profileStrength of [-1,NaN,Infinity,2.1])expect(()=>build({profile:'scallops',profileStrength})).toThrow('profile controls');
  expect(()=>build({profileStrength:1})).toThrow('profile controls');
});

it('places ripple waves independently of the entry turn while retaining the inherited default',()=>{
  const build=(style:any)=>motionArc(points,v,control,1000,false,12,false,24,4,style);
  const inherited=build({profile:'scallops'});
  expect(build({profile:'scallops',rippleCycles:2})).toEqual(inherited);
  expect(build({profile:'scallops',profileStart:0,rippleCycles:1})).not.toEqual(inherited);
  expect(build({profile:'scallops',profileStart:0,rippleCycles:1})[1]).not.toEqual(inherited[1]);
  expect(build({profile:'scallops',profileStart:0,rippleCycles:1,profileStrength:0})).toEqual(build({}));
  for(const style of [{profileStart:0},{profile:'scallops',profileStart:-.1},{profile:'scallops',profileStart:1},
    {profile:'scallops',rippleCycles:1.5},{profile:'scallops',rippleCycles:0},{profile:'terraces',rippleCycles:1}])
    expect(()=>build(style)).toThrow('profile controls');
});

it('builds six distinct normal geometries without changing ordinary arcs or the input',()=>{
  const original=structuredClone({points,v,control});
  const base=motionArc(points,v,control,1000,false,12,false,24);
  expect(motionArc(points,v,control,1000,false,12,false,24,4,{})).toEqual(base);
  const shapes=[...MOTION_PROFILES.map(profile=>motionArc(points,v,control,1000,false,12,false,24,4,{profile})),
    ...RAIL_CONTOURS.map(contour=>motionArc(points,v,control,1000,false,12,false,24,4,{contour}))];
  expect(new Set([base,...shapes].map(lines=>JSON.stringify(lines)))).toHaveLength(1+MOTION_PROFILES.length+RAIL_CONTOURS.length);
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
