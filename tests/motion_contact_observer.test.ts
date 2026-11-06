import {it,expect} from 'vitest';
import {LineRiderEngine as Engine,disposeEngines as dispose} from '../scripts/lib/native_motion/engine.ts';
import {LineRiderEngine as Judge,disposeAllWasmEnginesForStudy as disposeJudge} from '../scripts/lib/_lr_engine_wasm.ts';
import {extractRawTrajectory,resetFrameCount,getPhysicsFrameCount} from '../scripts/lib/detector.ts';
it.each([{name:'compiler',Engine,dispose},{name:'judge',Engine:Judge,dispose:disposeJudge}])('reads $name contacts without advancing or charging extra physics',({Engine,dispose})=>{
  const engine=new Engine().setStart({x:0,y:-15},{x:4,y:0}).addLine([
    {id:1,type:0,x1:-50,y1:10,x2:120,y2:10},
    {id:2,type:0,x1:120,y1:10,x2:200,y2:-10},
    {id:3,type:0,x1:200,y1:-10,x2:280,y2:30}]);
  try{
    expect(()=>engine.getAllContactLineIdsAtFrame(100)).toThrow('already simulated');
    expect(()=>engine.hasContactAtFrame(100)).toThrow('already simulated');
    for(const frame of [-1, .5, NaN, Infinity, 2**31]) {
      expect(()=>engine.getAllContactLineIdsAtFrame(frame)).toThrow(RangeError);
      expect(()=>engine.hasContactAtFrame(frame)).toThrow(RangeError);
    }
    expect(engine.getLastFrameIndex()).toBe(0);
    resetFrameCount();extractRawTrajectory(engine,60);const work=getPhysicsFrameCount();let contacts=0;
    for(let f=0;f<=60;f++){
      const ids=engine.getAllContactLineIdsAtFrame(f);contacts+=ids.length;
      const updates=engine.getUpdatesAtFrame(f).filter((u:any)=>u.type==='CollisionUpdate');
      expect(ids).toEqual([...new Set(updates.map((u:any)=>u.id))]);
      expect(engine.hasContactAtFrame(f)).toBe(updates.length>0);
    }
    expect(contacts).toBeGreaterThan(0);expect(getPhysicsFrameCount()).toBe(work);
    const sibling=engine.addLine({id:4,type:0,x1:-50,y1:0,x2:280,y2:0});
    const last=sibling.getLastFrameIndex();
    expect(last).toBeLessThan(60);
    expect(()=>sibling.hasContactAtFrame(60)).toThrow('already simulated');
    expect(()=>sibling.getAllContactLineIdsAtFrame(60)).toThrow('already simulated');
    expect(sibling.getLastFrameIndex()).toBe(last);
  }finally{dispose();}
});
