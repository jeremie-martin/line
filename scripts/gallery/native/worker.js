// The mirror engine expects window even in its non-DOM physics modules.
// Isolate that compatibility alias in the worker, away from gallery globals.
globalThis.window=globalThis;
const Engine=require('native:505');
const {createLineFromJson}=require('native:502');
self.onmessage=({data:{request,track,trace}})=>{
  try {
    if(track.riders?.length!==1)throw new Error('Gallery replay requires exactly one rider');
    if(!track.lines.every(l=>l.type===0))throw new Error('Gallery replay requires normal lines only');
    if(trace.pointIds.length!==10||new Set(trace.pointIds).size!==10)throw new Error('Incomplete body-point trace');
    if(trace.fps!==40||!trace.frames.length)throw new Error('Invalid recorded replay');
    const started=performance.now();
    const engine=new Engine().setRiders(track.riders).addLines(track.lines.map(l=>createLineFromJson({...l})));
    let maxError=0;
    const frames=trace.frames.map((expected,index)=>{
      const rider=engine.getRawRider(index);
      const points=rider.points.map(({name,pos})=>({name,pos:{x:pos.x,y:pos.y}}));
      for(let p=0;p<trace.pointIds.length;p++){
        const point=points.find(v=>v.name===trace.pointIds[p]);
        if(!point)throw new Error(`Missing rider point ${trace.pointIds[p]}`);
        for(const [axis,j] of [['x',0],['y',1]]){
          const error=Math.abs(point.pos[axis]-expected[p*2+j]);
          if(!Number.isFinite(error)||error>1e-7)throw new Error(`Native replay differs at frame ${index}, ${point.name}.${axis}: ${error}`);
          maxError=Math.max(maxError,error);
        }
      }
      return {points,framesSinceUnmount:rider.framesSinceUnmount,framesSinceSledBreak:rider.framesSinceSledBreak,framesSinceStringDetached:rider.framesSinceStringDetached};
    });
    self.postMessage({request,frames,maxError,replayMs:performance.now()-started});
  } catch(error) {self.postMessage({request,error:error.message});}
};
