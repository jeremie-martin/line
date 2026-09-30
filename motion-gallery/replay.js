/** One background replay per checked record; bounded cache, no physics on scrub. */
let rendererPromise,worker,nextRequest=0;
const pending=new Map(),cache=new Map();
const renderer=()=>rendererPromise??=import('/generated/motion-gallery-renderer/view.js');
function replay(record){
  if(!worker){
    worker=new Worker('/generated/motion-gallery-renderer/worker.js',{type:'module'});
    worker.onmessage=({data})=>{
      const request=pending.get(data.request);if(!request)return;
      pending.delete(data.request);
      if(data.error)request.reject(new Error(data.error));else request.resolve(data);
    };
    worker.onerror=event=>{
      for(const request of pending.values())request.reject(new Error(`Native replay unavailable: ${event.message}`));
      pending.clear();worker.terminate();worker=undefined;
    };
  }
  return new Promise((resolve,reject)=>{
    const request=++nextRequest;pending.set(request,{resolve,reject});
    worker.postMessage({request,track:record.track,trace:record.trace});
  });
}
export async function prepareView(record,digest){
  if(!cache.has(digest)){
    const promise=Promise.all([renderer().then(async module=>({module,sheet:await module.loadRider()})),replay(record)])
      .then(([{module,sheet},native])=>({module,sheet,native}));
    cache.set(digest,promise);
    promise.catch(()=>{if(cache.get(digest)===promise)cache.delete(digest);});
    while(cache.size>24)cache.delete(cache.keys().next().value);
  }
  const entry=cache.get(digest);cache.delete(digest);cache.set(digest,entry);
  const {module,sheet,native}=await entry;
  return {view:module.createView(record.track,native.frames,sheet),replayMs:native.replayMs,maxError:native.maxError};
}
