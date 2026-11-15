// Run with prepared hit-study scenes and the review server on 10.77.77.9:8767.
// Exercises the real framing functions; checks every half frame of both rides.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']}),p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://10.77.77.9:8767/generated/concept-lab/hit-motion.html?camera=old-authored&effect=still&t=9.4');await p.waitForFunction(()=>window.__ready);
for(const song of ['tiki','circus']){
 await p.selectOption('#song',song);await p.waitForFunction(s=>window.__ready&&window.hitStudy.state().song===s,song);
 for(const camera of ['old-six','old-zoom','old-authored','old-punch','old-punch-locked']){
  await p.click(`#punchComparisons button[data-camera="${camera}"]`);
  assert.equal(await p.evaluate(()=>window.hitStudy.state().mode),'still');assert.equal(await p.locator('#camera').inputValue(),camera);
  if(camera!=='old-six')assert.equal(await p.locator('#cameraCurves svg').count(),2);
 }
}
const data=await p.evaluate(async()=>{
 const N=await import('/generated/renderer/native.js'),{framingFor}=await import('/generated/concept-lab/hit-motion-camera.mjs'),{rideSignals}=await import('/scripts/video/camera.js'),{BODY_POINTS}=await import('/scripts/video/picture.js');
 const results=[];
 for(const song of ['tiki','circus']){
  const scene=await(await fetch(`/generated/hit-effects/data/${song}.json`)).json(), replay=await N.replay(scene.track,scene.trace);
  const centres=replay.frames.map(f=>{const ps=f.points.filter(p=>BODY_POINTS.includes(p.name));return {x:ps.reduce((s,p)=>s+p.pos.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.pos.y,0)/ps.length};}),motion=rideSignals(centres);
  const [fixed,coupled,locked]=['old-six','old-punch','old-punch-locked'].map(m=>framingFor(m,replay,scene)(motion));
  let lo=0,hi=0;
  for(let f=0;f<centres.length;f+=.5){const a=fixed(0,f),c=coupled(0,f),d=locked(0,f);if(a.ax!==d.ax||a.ay!==d.ay||c.z!==d.z)throw Error(`Isolation broken ${song} ${f}`);lo=Math.min(lo,c.ay-d.ay);hi=Math.max(hi,c.ay-d.ay);}
  results.push({song,minY:lo,maxY:hi});
 }
 return results;
});console.log('Exact fixed-position and same-zoom checks pass at every half frame:',data);
await p.selectOption('#song','tiki');await p.waitForFunction(()=>window.__ready&&window.hitStudy.state().song==='tiki');await p.click('#punchComparisons button[data-camera="old-authored"]');await p.evaluate(()=>window.hitStudy.seek(10.41));await p.locator('#cameraAnalysis').scrollIntoViewIfNeeded();await p.screenshot({path:'generated/hit-effects/punch-curves.png'});
assert.deepEqual(errors,[]);console.log('PASS punch controls and charts on both songs; no browser errors');await b.close();
