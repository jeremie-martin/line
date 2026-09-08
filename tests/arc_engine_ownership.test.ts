import {expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';

it('retains an empty prefix engine across collection of temporary wrappers',()=>{
  const script=`
    import {createArcEngine} from './scripts/v0/optimizer/arc_engine.ts';
    import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from './scripts/lib/native_motion/engine.ts';
    const engine=createArcEngine({position:{x:100,y:40},velocity:{x:2,y:0}});
    Engine.retainOnly([engine]);
    const before=engine.getRider(0).ballisticState();
    for(let i=0;i<8;i++){global.gc();await new Promise(r=>setTimeout(r,0));}
    const after=engine.getRider(0).ballisticState();
    console.log(JSON.stringify({same:JSON.stringify(before)===JSON.stringify(after),frame:engine.getLastFrameIndex()}));
    dispose();`;
  const result=JSON.parse(execFileSync(process.execPath,['--expose-gc','--import','tsx','--input-type=module','-e',script],{encoding:'utf8'}));
  expect(result).toEqual({same:true,frame:0});
});
