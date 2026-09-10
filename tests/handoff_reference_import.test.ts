import {afterAll,beforeAll,expect,it} from 'vitest';
import {cpSync,existsSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

let checkout:string;
beforeAll(()=>{
  checkout=mkdtempSync(join(tmpdir(),'reference-compiler-test-'));
  cpSync('scripts',join(checkout,'scripts'),{recursive:true,filter:p=>
    !p.endsWith('.wasm')&&!p.endsWith('.gz')&&!p.endsWith('arc_control_policy_model.json')&&
    !p.endsWith('arc_value_model.json')&&!p.includes('__pycache__')});
  cpSync('package.json',join(checkout,'package.json'));
  symlinkSync(resolve('node_modules'),join(checkout,'node_modules'),'dir');
  symlinkSync(resolve('vendor'),join(checkout,'vendor'),'dir');
});
afterAll(()=>{if(checkout)rmSync(checkout,{recursive:true,force:true});});

it.each(['js','official'])('compiles via %s without Rust artifacts or arc assets',backend=>{
  expect(existsSync(join(checkout,'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm'))).toBe(false);
  expect(existsSync(join(checkout,'scripts/lib/native_motion/engine.wasm'))).toBe(false);
  const script=`
    import assert from 'node:assert/strict';
    import {compileHandoff,handoffBackend} from './scripts/v0/optimizer/handoff.ts';
    import {compileLegacyHandoff} from './scripts/v0/optimizer/legacy_handoff.ts';
    const spec={duration:2,preroll:0,jitter:0,contacts:[{t:.6},{t:1.2},{t:1.8}],axes:{air:()=>.5,speed:()=>.5}};
    const options={budget:10000};
    assert.equal(handoffBackend(spec,options),'legacy');
    const actual=compileHandoff(spec,17,options),expected=compileLegacyHandoff(spec,17,options);
    assert.deepEqual(actual.track,expected.track);assert.deepEqual(actual.report,expected.report);
    assert.deepEqual(actual.stats,expected.stats);assert.ok(actual.stats.sim_frames>0);
    console.log('reference compilation matched');`;
  const output=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',script],
    {cwd:checkout,encoding:'utf8',env:{...process.env,LR_ENGINE:backend},timeout:60000});
  expect(output.trim()).toBe('reference compilation matched');
},70000);
