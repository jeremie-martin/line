import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {repertoireSearchOptions} from '../scripts/v0/optimizer/repertoire_search.ts';
import {createArcCompileContext} from '../scripts/v0/optimizer/arc_compile_context.ts';
import {searchInterval} from '../scripts/v0/optimizer/arc_interval.ts';
import {arcControlMemoKey} from '../scripts/v0/optimizer/arc_motion_control.ts';
import {resetFrameCount,setPhysicsFrameLimit,getPhysicsFrameCount,PhysicsFrameLimitExceeded} from '../scripts/lib/detector.ts';
import {LineRiderEngine as Engine} from '../scripts/lib/native_motion/engine.ts';
for(const song of ['tiki_tiki_48s','luna_bala_44s'])it(`retains an offered scattered incumbent without substituting unrelated controls: ${song}`,()=>{
 const f=JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/scattered-incumbent/${song}.json.gz`,import.meta.url))).toString());
 const spec={...f.spec,axes:Object.fromEntries(Object.entries(f.axes).map(([k,values]:[string,any])=>[k,(t:number)=>values[Math.round(t*40)]??undefined]))};
 const options=repertoireSearchOptions(spec,f.plan,100_000_000,'line.strike.v3'),ctx=createArcCompileContext(spec,f.seed,options),engine=ctx.lineage.rebuild(f.lines);
 resetFrameCount();setPhysicsFrameLimit(250_000);
 try{
  const initial=searchInterval(ctx,engine,f.section,{directControls:[f.control]},[engine]);
  expect(initial?.best?.actualImpact).toBeCloseTo(f.impact,12);
  const key=(c:any)=>arcControlMemoKey(c,options.channel);
  const incumbent=key(initial!.best.c);
  // These cheaper connected carriers fail as scattered realizations. The
  // previously verified offered control remains valid regardless of rank.
  const broader=searchInterval(ctx,engine,f.section,{directControls:[f.control,...f.carriers]},[engine]);
  expect(broader?.candidates.some(c=>key(c.c)===incumbent)).toBe(true);
  expect(broader?.best).toBeTruthy();
  // An exact probe of a different control cannot return the cached incumbent.
  const exact=searchInterval(ctx,engine,f.section,{directControls:[f.carriers[0]]},[engine]);
  expect(exact?.candidates.every(c=>key(c.c)===key(f.carriers[0]))).toBe(true);
  // A budget ceiling cannot discard a complete cached realization.
  // Reopening the native impact trace needs two metered frames. Contact
  // footprints themselves are cached; no observation replay is needed.
  setPhysicsFrameLimit(getPhysicsFrameCount()+2);
  let atLimit;
  try {atLimit=searchInterval(ctx,engine,f.section,{directControls:[f.control,...f.carriers]},[engine]);}
  catch(e){if(!(e instanceof PhysicsFrameLimitExceeded))throw e;throw Error('discarded validated offered incumbent at the work ceiling',{cause:e});}
  expect(atLimit?.best).toBeTruthy();
  expect(atLimit?.best.actualImpact).toBeCloseTo(f.impact,12);
  expect(ctx.work.budgetInterruptions).toHaveLength(0);
  // If another fragment still needs validation at the ceiling, preserve the
  // verified offered incumbent while interrupting only that fresh replay.
  for(const k of ctx.lineage.memoContexts.values())for(const entry of k.keys())
    if(entry.endsWith('|fragments')&&entry!==incumbent+'|fragments')k.delete(entry);
  setPhysicsFrameLimit(getPhysicsFrameCount()+2);
  const interrupted=searchInterval(ctx,engine,f.section,{directControls:[f.control,...f.carriers]},[engine]);
  expect(interrupted?.best?.actualImpact).toBeCloseTo(f.impact,12);
  expect(ctx.work.budgetInterruptions.at(-1)).toMatchObject({phase:'fragments',retained:true});
 }finally{setPhysicsFrameLimit(null);Engine.retainOnly([])}
},30_000);
