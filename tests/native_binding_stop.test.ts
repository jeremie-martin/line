import {it,expect} from 'vitest';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../scripts/lib/native_motion/engine.ts';
import {boundThroughMetered,getRiderMetered,resetFrameCount,getPhysicsFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';

// At 8 px/frame the rider hits the wall and comes unbound at frame 11.
const floor={id:1,type:0,x1:-50,y1:10,x2:400,y2:10},wall={id:2,type:0,x1:100,y1:30,x2:100,y2:-60};
const unused={id:3,type:0,x1:-50,y1:300,x2:400,y2:300},later={id:4,type:0,x1:300,y1:12,x2:400,y2:12};
const HORIZON=80;
/** A candidate read either fully or with the early stop, then a sibling read. */
function ride(early:boolean,crashOnOwn:boolean){
 const base=new Engine().setStart({x:0,y:-15},{x:8,y:0}).addLine(crashOnOwn?[floor]:[floor,wall]);
 const own=crashOnOwn?[wall]:[unused],child=base.addLine(own);
 resetFrameCount();setPhysicsFrameLimit(null);
 getRiderMetered(child,0);
 const bound=early?boundThroughMetered(child,HORIZON,own,1)
  :(s=>s.riderMounted&&s.sledIntact)(getRiderMetered(child,HORIZON).ballisticState());
 const charged=getPhysicsFrameCount(),reached=child.getLastFrameIndex();
 const sibling=base.addLine([later]),pose=getRiderMetered(sibling,HORIZON).ballisticState();
 return {bound,charged,reached,total:getPhysicsFrameCount(),pose};
}
it('stops a replay that crashed on its own lines, with identical charges and later reads',()=>{
 try{
  const full=ride(false,true),early=ride(true,true);
  expect(full.bound).toBe(false);expect(full.reached).toBe(HORIZON);
  expect(early.reached).toBe(11);
  expect({...early,reached:0}).toEqual({...full,reached:0});
 }finally{dispose();}
});
it('keeps stepping when the crash is not on its own lines, whose frames a sibling reuses',()=>{
 try{
  const full=ride(false,false),early=ride(true,false);
  expect(full.bound).toBe(false);
  expect(early).toEqual(full);
  expect(early.reached).toBe(HORIZON);
 }finally{dispose();}
});
it('refuses a read past the allowance before simulating, as a full read does',()=>{
 const base=new Engine().setStart({x:0,y:-15},{x:8,y:0}).addLine([floor]),child=base.addLine([wall]);
 resetFrameCount();setPhysicsFrameLimit(50);
 try{
  expect(()=>boundThroughMetered(child,HORIZON,[wall],1)).toThrow('hard limit');
  expect(getPhysicsFrameCount()).toBe(0);
  expect(boundThroughMetered(child,40,[wall],1)).toBe(false);
  expect(getPhysicsFrameCount()).toBe(40);expect(child.getLastFrameIndex()).toBe(11);
 }finally{setPhysicsFrameLimit(null);dispose();}
});
