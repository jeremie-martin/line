import {it,expect} from 'vitest';
import {LineRiderEngine as Engine,disposeEngines} from '../scripts/lib/native_motion/engine.ts';
import {getRiderMetered,getBallisticStateMetered,matchesBallisticStateMetered,resetFrameCount,getPhysicsFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
it('compares every ballistic point component and binding without changing charged work',()=>{
 const engine=new Engine().setStart({x:0,y:-15},{x:4,y:0}).addLine({id:1,type:0,x1:-50,y1:10,x2:400,y2:10});
 try{
  resetFrameCount();setPhysicsFrameLimit(null);
  for(const frame of [0,1,20,60]){
   const state=getBallisticStateMetered(engine,frame),work=getPhysicsFrameCount();
   expect(state).toEqual(engine.getRider(frame).ballisticState());
   expect(matchesBallisticStateMetered(engine,frame,state)).toBe(true);
   for(const id of Object.keys(state.points))for(const key of ['x','y','prevX','prevY','vx','vy'] as const){
    const changed=structuredClone(state);changed.points[id][key]+=.001;
    expect(matchesBallisticStateMetered(engine,frame,changed)).toBe(false);
   }
   for(const key of ['riderMounted','sledIntact'] as const)expect(matchesBallisticStateMetered(engine,frame,{...state,[key]:!state[key]})).toBe(false);
   engine.getRawFrameAtFrame(0); // the shared ABI buffer can be overwritten between reads
   expect(matchesBallisticStateMetered(engine,frame,state)).toBe(true);
   expect(getPhysicsFrameCount()).toBe(work);
  }
  const state=engine.getRider(60).ballisticState();
  const branch=engine.addLine({id:2,type:0,x1:-50,y1:0,x2:400,y2:0});
  const rider=getRiderMetered(branch,60);
  expect(matchesBallisticStateMetered(branch,60,state)).toBe(JSON.stringify(rider.ballisticState())===JSON.stringify(state));
 }finally{disposeEngines();}
});
it('preserves the serialized numeric equality contract for zero and nonfinite states',()=>{
 try{for(const position of [{x:0,y:0},{x:NaN,y:Infinity}]){
  const engine=new Engine().setStart(position,{x:-0,y:0}),frame=0,state=getBallisticStateMetered(engine,frame),changed=structuredClone(state);
  for(const point of Object.values(changed.points) as any[])for(const key of ['x','y','prevX','prevY','vx','vy'] as const){
   if(!Number.isFinite(point[key]))point[key]=-Infinity;
   else if(point[key]===0)point[key]=-point[key];
  }
  expect(JSON.stringify(changed)).toBe(JSON.stringify(state));
  expect(matchesBallisticStateMetered(engine,frame,changed)).toBe(true);
 }}finally{disposeEngines();}
});

it('checks direct state-read allowances before simulation and charges cached comparisons zero', () => {
 const engine=new Engine();
 resetFrameCount();setPhysicsFrameLimit(5);
 try{
  expect(()=>getBallisticStateMetered(engine,6)).toThrow('attempted=6');
  expect(engine.getLastFrameIndex()).toBe(0);
  expect(getPhysicsFrameCount()).toBe(0);
  const state=getBallisticStateMetered(engine,5);
  expect(getPhysicsFrameCount()).toBe(5);
  expect(matchesBallisticStateMetered(engine,5,state)).toBe(true);
  expect(getPhysicsFrameCount()).toBe(5);
  expect(()=>matchesBallisticStateMetered(engine,6,state)).toThrow('attempted=6');
  expect(engine.getLastFrameIndex()).toBe(5);
 }finally{setPhysicsFrameLimit(null);disposeEngines();}
});
