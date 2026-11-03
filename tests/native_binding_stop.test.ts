import {it,expect} from 'vitest';
import {LineRiderEngine as Engine,disposeEngines as dispose} from '../scripts/lib/native_motion/engine.ts';
import {boundThroughMetered,resetFrameCount,getPhysicsFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';

// At 8 px/frame the rider hits the wall and comes unbound at frame 11.
const floor={id:1,type:0,x1:-50,y1:10,x2:400,y2:10},wall={id:2,type:0,x1:100,y1:30,x2:100,y2:-60};
const HORIZON=80;
const start=(lines:any[])=>new Engine().setStart({x:0,y:-15},{x:8,y:0}).addLine(lines);
it('stops at the first unbound frame and charges only the frames simulated',()=>{
 resetFrameCount();setPhysicsFrameLimit(null);
 try{
  const child=start([floor,wall]);
  expect(boundThroughMetered(child,HORIZON)).toBe(false);
  expect(child.getLastFrameIndex()).toBe(11);expect(getPhysicsFrameCount()).toBe(11);
  const reference=start([floor,wall]);
  expect(reference.isBoundAtFrame(10)).toBe(true);
  expect(reference.isBoundAtFrame(11)).toBe(false);expect(reference.isBoundAtFrame(HORIZON)).toBe(false);
  const intact=start([floor]);resetFrameCount();
  expect(boundThroughMetered(intact,HORIZON)).toBe(true);expect(getPhysicsFrameCount()).toBe(HORIZON);
 }finally{dispose();}
});
it('checks the allowance before each simulated frame',()=>{
 resetFrameCount();setPhysicsFrameLimit(5);
 try{
  const child=start([floor,wall]);
  expect(()=>boundThroughMetered(child,HORIZON)).toThrow('hard limit');
  expect(getPhysicsFrameCount()).toBe(5);expect(child.getLastFrameIndex()).toBe(5);
  resetFrameCount();setPhysicsFrameLimit(50);
  expect(boundThroughMetered(start([floor,wall]),HORIZON)).toBe(false);expect(getPhysicsFrameCount()).toBe(11);
 }finally{setPhysicsFrameLimit(null);dispose();}
});
