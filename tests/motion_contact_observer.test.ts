import {it,expect} from 'vitest';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory,resetFrameCount,getPhysicsFrameCount} from '../scripts/lib/detector.ts';
it('reads all native collision IDs without advancing or charging extra physics',()=>{
  const engine=new Engine().setStart({x:0,y:-15},{x:4,y:0}).addLine([
    {id:1,type:0,x1:-50,y1:10,x2:120,y2:10},
    {id:2,type:0,x1:120,y1:10,x2:200,y2:-10},
    {id:3,type:0,x1:200,y1:-10,x2:280,y2:30}]);
  try{
    expect(()=>engine.getAllContactLineIdsAtFrame(100)).toThrow('already simulated');
    resetFrameCount();extractRawTrajectory(engine,60);const work=getPhysicsFrameCount();let contacts=0;
    for(let f=0;f<=60;f++){
      const ids=engine.getAllContactLineIdsAtFrame(f);contacts+=ids.length;
      expect(ids.sort((a,b)=>a-b)).toEqual([...new Set(engine.getUpdatesAtFrame(f).filter((u:any)=>u.type==='CollisionUpdate').map((u:any)=>u.id))].sort((a:any,b:any)=>a-b));
    }
    expect(contacts).toBeGreaterThan(0);expect(getPhysicsFrameCount()).toBe(work);
  }finally{dispose();}
});
