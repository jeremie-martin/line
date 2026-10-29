import {expect,it,vi} from 'vitest';
// A toy family is added the way a real one is: one more row in the table.
vi.mock('../scripts/v0/optimizer/geometry_families.ts',async importOriginal=>{
 const real=await importOriginal<typeof import('../scripts/v0/optimizer/geometry_families.ts')>();
 return {...real,GEOMETRY_FAMILIES:{...real.GEOMETRY_FAMILIES,zigzag:{label:'Zigzags',style:{profileStart:0,profileStrength:1},
  heading:(base:number,w:number,strength:number)=>base+24*strength*Math.PI/180*2/Math.PI*Math.asin(Math.sin(3*Math.PI*w))}}};
});
import {constructions,constructionStyle,creativePreferences,validateProductionPlan} from '../scripts/v0/optimizer/repertoire_policy.ts';
import {planIntentionalRepertoire} from '../scripts/v0/optimizer/intentional_repertoire.ts';
import {MOTION_PROFILES} from '../scripts/v0/optimizer/motion_profiles.ts';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';
import {repertoireCatalog} from '../scripts/gallery/repertoire_catalog.ts';
import type {Spec} from '../scripts/v0/types.ts';
const toy='zigzag' as any;
const spec:Spec={duration:3,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};

it('joins the planner, the profiles and the review page from its row alone',()=>{
 expect(constructions.at(-1)).toBe(toy);
 expect(creativePreferences().repertoire).toContain(toy);
 expect(MOTION_PROFILES).toContain(toy);
 expect(repertoireCatalog.constructions.at(-1)).toEqual({id:'zigzag',label:'Zigzags'});
});

it('is planned and built like every shaped family',()=>{
 const plan=planIntentionalRepertoire(spec,101,{repertoire:['arcs',toy]});
 expect(validateProductionPlan(spec,plan)).toEqual(plan);
 const request=plan.requests.find(r=>r.construction===toy)!;
 expect(request.guidance).toBe('required');
 const style=constructionStyle(request);
 expect(style).toMatchObject({guides:true,profile:'zigzag',profileStart:0,profileStrength:1});
 const points=[{x:0,y:0},{x:12,y:1}],v={x:9,y:2},control={entry:12,turn:-20,exit:25,support:20,bias:.2,offset:.1};
 const build=(s:any)=>JSON.stringify(motionArc(points,v,control,1000,12,24,4,s));
 const others=[{},...MOTION_PROFILES.filter(p=>p!==toy).map(profile=>({profile}))].map(build);
 expect(others).not.toContain(build(style));
 expect(build({...style,profileStrength:0})).toEqual(build({guides:style.guides}));
});

it('compiles through the production route and fulfils its shaped-family check',()=>{
 const r=compileHandoff(spec,101,{budget:120000,creative:{repertoire:[toy]}}).repertoire!;
 expect(r.plan.requests.slice(1).every(q=>q.construction===toy)).toBe(true);
 expect(r.physicalFrames).toBeLessThanOrEqual(120000);
 expect(r.valid).toBe(true);
 expect(r.realization.fulfilled).toBe(true);
});
