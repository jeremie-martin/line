import {it,expect} from 'vitest';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
import {normalizeArcControl,arcResponseKeys,arcControlMemoKey} from '../scripts/v0/optimizer/arc_motion_control.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';
const points=[{x:0,y:0},{x:12,y:1},{x:4,y:9}],velocity={x:9,y:2};
const control={entry:12,turn:-20,exit:25,support:20,bias:.2,offset:.1};
it('enforces no guides even when proposals explicitly request full close guidance',()=>{
  const expected=motionArc(points,velocity,control,1000,false,0,false,24);
  for(const profile of [undefined,'serpentine','terraces','scallops'] as const){
    const forced=motionArc(points,velocity,{...control,clearance:6,guideStart:0,guideEnd:1,guideFlare:-10},1000,false,12,false,24,4,{guides:false,profile});
    expect(forced).toEqual(motionArc(points,velocity,control,1000,false,0,false,24,4,{profile}));
    if(!profile)expect(forced).toEqual(expected);
  }
});
it('canonicalizes inactive guide variables and excludes their response probes',()=>{
  const a=normalizeArcControl({...control,clearance:8,guideStart:.2,guideEnd:.9,guideFlare:5},{span:40,guides:false});
  const b=normalizeArcControl({...control,clearance:26,guideStart:0,guideEnd:1,guideFlare:-12},{span:40,guides:false});
  expect(a).toEqual(control);expect(arcControlMemoKey(a,12)).toEqual(arcControlMemoKey(b,12));
  const active=arcResponseKeys(false);
  expect(active).toContain('bend');expect(active).toContain('turnFraction');
  for(const key of ['clearance','guideStart','guideEnd','guideFlare'])expect(active).not.toContain(key);
});
it('searches single rails from scratch through lookahead and replay without emitting guides',()=>{
  const spec:Spec={duration:2,preroll:5,jitter:0,contacts:[.5,1,1.5,2].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
  const options={budget:35000,samples:32,channel:12,guides:false,guidance:'full' as const,guidanceSamples:24,responseSamples:24,lookaheadWidth:2,lookaheadSamples:8,warmStart:{...control,clearance:6,guideStart:0,guideEnd:1}};
  const result=compileArcMotion(spec,17,options);
  expect(result.track.lines.length).toBeGreaterThan(0);
  expect(result.track.lines.every(l=>l.type===0)).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
  expect(result.guidanceReduction?.originalGuides).toBe(0);
  for(const row of result.rows)for(const key of ['clearance','guideStart','guideEnd','guideFlare'])expect(row.control[key]).toBeUndefined();
  const last=new Map<number,any>();
  for(const l of result.track.lines){const group=Math.floor((l.id-1000)/10000),previous=last.get(group);if(previous)expect([l.x1,l.y1]).toEqual([previous.x2,previous.y2]);last.set(group,l);}
});
it('does not let an inactive guide clearance select a different unguided search',()=>{
 const spec:Spec={duration:2,preroll:5,jitter:0,contacts:[.5,1,1.5].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
 const options={budget:35000,samples:32,guides:false,radius:24,
  guidance:'clearance' as const,guidanceSamples:24,responseSamples:24,
  lookaheadWidth:2,lookaheadSamples:8};
 const a=compileArcMotion(spec,17,{...options,channel:0}),b=compileArcMotion(spec,17,{...options,channel:24});
 expect(b.track).toEqual(a.track);expect(b.stats).toEqual(a.stats);
 expect(b.report).toEqual(a.report);
});
