import {it,expect} from 'vitest';
import {LineRiderEngine as Engine,disposeEngines} from '../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectoryWindow,resetFrameCount,getPhysicsFrameCount,getFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
const create=()=>new Engine().setStart({x:0,y:-15},{x:4,y:0}).addLine([
 {id:1,type:0,x1:-50,y1:10,x2:120,y2:10},{id:2,type:0,x1:120,y1:10,x2:280,y2:-20}]);
it('reads owned windows with scalar contact order and rejects incomplete caches',()=>{
 try{
  const engine=create();
  expect(()=>engine.getCachedRawFrames(0,60)).toThrow('already simulated');
  expect(engine.getLastFrameIndex()).toBe(0);
  engine.getRider(60);
  for(const [start,end]of [[0,0],[0,60],[7,18],[59,60]]){
   const frames=engine.getCachedRawFrames(start,end);
   expect(frames).toEqual(Array.from({length:end-start+1},(_,k)=>engine.getRawFrameAtFrame(start+k)));
   const saved=structuredClone(frames);engine.readCachedMotionWindow(0,60, values => Float64Array.from(values));
   expect(frames).toEqual(saved);
  }
  const sibling=engine.addLine({id:3,type:0,x1:-50,y1:0,x2:280,y2:0});
  expect(()=>sibling.getCachedRawFrames(0,60)).toThrow('already simulated');
 }finally{disposeEngines();}
});
it('preserves both extraction counters and budget interruptions on cached and computing paths',()=>{
 try{
  for(const cachedThrough of [0,12,60])for(const limit of [null,5,70])for(const [from,to]of [[0,60],[7,18],[20,19],[0,5.5]]){
   const outcomes=[];
   for(const bulk of [false,true]){
    const engine=create();engine.getRider(cachedThrough);resetFrameCount();setPhysicsFrameLimit(limit);
    const scalar={getLastFrameIndex:()=>engine.getLastFrameIndex(),getRawFrameAtFrame:(frame:number)=>engine.getRawFrameAtFrame(frame)};
    let result:any;try{result=extractRawTrajectoryWindow(bulk?engine:scalar,from,to);}catch(error){result=(error as Error).message;}
    outcomes.push({result,physics:getPhysicsFrameCount(),reads:getFrameCount(),last:engine.getLastFrameIndex()});
   }
   expect(outcomes[1]).toEqual(outcomes[0]);
  }
 }finally{setPhysicsFrameLimit(null);disposeEngines();}
});
