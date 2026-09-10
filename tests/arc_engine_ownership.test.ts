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

it('preserves caller-owned judge engines across successful and failed compilations',()=>{
  const script=`
    import assert from 'node:assert/strict';
    import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from './scripts/lib/_lr_engine_wasm.ts';
    import {compileHandoff} from './scripts/v0/optimizer/handoff.ts';
    import {compileArcMotion} from './scripts/v0/optimizer/arc_motion.ts';
    const caller=new Engine().setStart({x:125,y:-80},{x:2,y:.3});
    const sibling=caller.addLine({id:1,type:0,x1:0,y1:250,x2:500,y2:250});
    const frames=[0,15,40,80];
    const capture=engine=>frames.map(f=>engine.getRider(f).ballisticState());
    const before=[capture(caller),capture(sibling)];
    const spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
    try{
      for(let i=0;i<2;i++){
        const result=compileHandoff(spec,17,{budget:30000});
        assert.ok(result.stats.sim_frames<=30000);
        assert.deepEqual([capture(caller),capture(sibling)],before);
        assert.throws(()=>compileArcMotion(spec,17,{budget:30000,controlPolicy:()=>{throw new Error('injected proposal failure');}}),/injected/);
        // Exercise allocation after cleanup: stale handles must not alias it.
        new Engine().setStart({x:-999,y:500},{x:0,y:0}).getRider(10);
        global.gc();await new Promise(r=>setTimeout(r,0));
        assert.deepEqual([capture(caller),capture(sibling)],before);
      }
      console.log('owned engines preserved');
    }finally{dispose();}`;
  expect(execFileSync(process.execPath,['--expose-gc','--import','tsx','--input-type=module','-e',script],
    {encoding:'utf8',env:{...process.env,LR_ENGINE:'wasm'}}).trim()).toBe('owned engines preserved');
});
