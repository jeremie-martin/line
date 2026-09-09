import {expect,it} from 'vitest';
import {motionArc,normalizeArcTurnFraction} from '../scripts/v0/optimizer/arc_geometry.ts';

it('materializes the inherited turn without changing a long physical curve',()=>{
  const points=[{x:0,y:0},{x:12,y:1},{x:4,y:9},{x:7,y:4}],velocity={x:9,y:2};
  for(const support of [2,12,50,80,172]){
    const c={entry:12,turn:-20,exit:25,support,bias:.2,offset:.1};
    const implicit=Math.min(5,support*.5)/support;
    const original=motionArc(points,velocity,c,1000,false,12,false,24);
    const explicit=motionArc(points,velocity,{...c,turnFraction:normalizeArcTurnFraction(implicit,support,true)},1000,false,12,false,24);
    expect(explicit).toEqual(original);
    if(support>50){
      const old=motionArc(points,velocity,{...c,turnFraction:normalizeArcTurnFraction(implicit,support)},1000,false,12,false,24);
      expect(old).not.toEqual(original);
    }
  }
});

it('preserves existing explicit timing for shorter curves and the upper limit',()=>{
  for(const support of [2,10,30,50])for(const fraction of [-1,0,.05,.1,.3,.85,1])
    expect(normalizeArcTurnFraction(fraction,support,true)).toBe(normalizeArcTurnFraction(fraction,support));
  expect(normalizeArcTurnFraction(1,100,true)).toBe(.85);
});
