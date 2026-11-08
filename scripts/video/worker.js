// The native replay of one ride: the vendored engine, run in a worker so the page stays responsive. Returns, per physics frame
// (0 … track.duration), the rider's points and the lines it touches. With a saved trace (a compiled production records one, to its
// end or past it), every traced point within the track must match the engine within 1e-7: the ride drawn is the ride scored.
// The mirror engine expects window even in its non-DOM physics modules; the alias is isolated here.
globalThis.window=globalThis;
const Engine=require('native:505');
const {createLineFromJson}=require('native:502');
self.onmessage=({data:{request,track,trace}})=>{
  try {
    if(track.riders?.length!==1)throw new Error('Replay requires exactly one rider');
    if(!track.lines.every(l=>l.type===0))throw new Error('Replay requires normal lines only');
    if(!Number.isSafeInteger(track.duration)||track.duration<0)throw new Error('Track duration must be a whole number of physics frames');
    if(trace){
      if(trace.pointIds.length!==10||new Set(trace.pointIds).size!==10)throw new Error('Incomplete body-point trace');
      if(trace.fps!==40||!trace.frames.length||trace.frames.length>track.duration+1)throw new Error('Invalid recorded replay');
      // the trace is a check, not the source: every frame it recorded must match the engine; it stops where the ride ended (a
      // crash or an ejection), and the engine draws on from there
    }
    const started=performance.now();
    const engine=new Engine().setRiders(track.riders).addLines(track.lines.map(l=>createLineFromJson({...l})));
    let maxError=0;
    const contacts=[],frames=[];
    for(let index=0;index<=track.duration;index++){
      const rider=engine.getRawRider(index);
      contacts.push([...engine.getFrame(index).involvedLineIds]);
      const points=rider.points.map(({name,pos})=>({name,pos:{x:pos.x,y:pos.y}}));
      if(trace&&index<trace.frames.length)for(let p=0;p<trace.pointIds.length;p++){
        const point=points.find(v=>v.name===trace.pointIds[p]),expected=trace.frames[index];
        if(!point)throw new Error(`Missing rider point ${trace.pointIds[p]}`);
        for(const [axis,j] of [['x',0],['y',1]]){
          const error=Math.abs(point.pos[axis]-expected[p*2+j]);
          if(!Number.isFinite(error)||error>1e-7)throw new Error(`Native replay differs at frame ${index}, ${point.name}.${axis}: ${error}`);
          maxError=Math.max(maxError,error);
        }
      }
      frames.push({points,framesSinceUnmount:rider.framesSinceUnmount,framesSinceSledBreak:rider.framesSinceSledBreak,framesSinceStringDetached:rider.framesSinceStringDetached});
    }
    self.postMessage({request,frames,contacts,maxError,replayMs:performance.now()-started});
  } catch(error) {self.postMessage({request,error:error.message});}
};
