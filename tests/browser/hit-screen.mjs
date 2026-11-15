// Geometry measurements are checked against the renderer's returned world matrix.
// Requires prepared hit-study data and the review server.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']}),page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://10.77.77.1:8770/generated/concept-lab/hit-motion.html?effect=still&camera=measured-punch&t=13');await page.waitForFunction(()=>window.__ready);
const result=await page.evaluate(async()=>{
  const N=await import('/generated/renderer/native.js'),{createPicture,riderAt,BODY_POINTS}=await import('/scripts/video/picture.js'),{prepareHits}=await import('/scripts/video/hits.js'),{resolveLook}=await import('/scripts/video/look.js');
  const {rideSignals}=await import('/scripts/video/camera.js'),{rideIntensity}=await import('/scripts/video/intensity.js');
  const {framingFor}=await import('/generated/concept-lab/hit-motion-camera.mjs'),{riderOnScreen}=await import('/generated/concept-lab/hit-motion-screen.mjs'),{effectsAt}=await import('/generated/concept-lab/hit-motion-model.mjs');
  const {cameraZoomAt}=await import('/generated/concept-lab/hit-motion-zoom.mjs');
  const sheet=await N.loadSheet(), out=[];
  for(const song of ['tiki','circus']){
    const scene=await(await fetch(`/generated/hit-effects/data/${song}.json`)).json(),replay=await N.replay(scene.track,scene.trace);
    const centres=replay.frames.map(f=>{const ps=f.points.filter(p=>BODY_POINTS.includes(p.name));return {x:ps.reduce((s,p)=>s+p.pos.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.pos.y,0)/ps.length};});
    const hits=prepareHits(scene.account,replay.contacts,centres,new Map(scene.track.lines.map(l=>[l.id,l]))),motion=rideSignals(centres),level=rideIntensity(motion.velocity.map(v=>v.speed),hits,scene.track.duration/40),hitTimes=hits.map(h=>({t:h.time-scene.timing.offset,s:h.strength}));
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const look=resolveLook('hokusai',{ends:'none',hits:'v1'}),settings={threshold:.55,reference:.85,peak:.26,cap:.35,attack:.025,decay:.1};let count=0,maxError=0;
    for (const viewZoom of [.5,1,1.5]) {
    settings.viewZoom=viewZoom;
    for(const camera of ['current','old-six','old-ten','old-zoom','old-authored','old-punch','old-punch-locked','measured-punch','measured-locked','measured-current']){
      const factory=framingFor(camera,replay,scene,settings),frame=factory(motion,level,hitTimes,scene.span[1]);
      const original=framingFor(camera,replay,scene,{...settings,viewZoom:1})(motion,level,hitTimes,scene.span[1]);
      for(const t of [10.45,13.95,27.84]) {
        const at=(t+scene.timing.offset)*40,a=frame(t,at,look),b=original(t,at,look);
        if(a.ax!==b.ax||a.ay!==b.ay||Math.abs(a.z-b.z*viewZoom)>1e-12)throw Error('Magnification changed follower path');
      }
      for(const mode of ['still','roll','lens','vertical','falling']){
        const effects=effectsAt(mode,1,false,scene.timing.offset),picture=createPicture(canvas,scene,replay,sheet,N.riderPainter(),{effectsAt:effects,framing:factory});
        for(const t of [10.45,13.95,27.84]){
          const at=(t+scene.timing.offset)*40,pose=riderAt(replay.frames,at),world=picture.draw(t,look),expected=riderOnScreen(frame(t,at,look),effects(hits,t+scene.timing.offset),pose);
          const points=pose.points.filter(p=>BODY_POINTS.includes(p.name)).map(p=>world.transformPoint(p.pos));
          const x=points.reduce((s,p)=>s+p.x,0)/points.length,y=points.reduce((s,p)=>s+p.y,0)/points.length,radius=Math.sqrt(points.reduce((s,p)=>s+(p.x-x)**2+(p.y-y)**2,0)/points.length);
          const error=Math.max(Math.abs(x-expected.x),Math.abs(y-expected.y),Math.abs(radius-expected.radius));if(error>1e-5)throw Error(`${song}/${camera}/${mode}/${t} projection error ${error}`);maxError=Math.max(maxError,error);count++;
        }
      }
    }
    }
    out.push({song,frames:count,maxError});
  }
  return out;
});console.log('Screen metrics agree with actual rendered transforms:',result);
for(const song of ['tiki','circus']){
  await page.selectOption('#song',song);await page.waitForFunction(s=>window.__ready&&window.hitStudy.state().song===s,song);
  await page.locator('#viewZoom').fill('0.5');await page.locator('#viewZoom').dispatchEvent('input');assert.equal(await page.locator('#viewZoomValue').textContent(),'×0.50');
  await page.click('#realizedComparisons button[data-camera="measured-locked"]');await page.click('#largerPunch');
  assert.equal(await page.locator('#punchPeak').inputValue(),'26');assert.equal(await page.locator('#screenCurves svg').count(),4);
  await page.locator('#screenComparison summary').click();await page.waitForSelector('#screenTable tr');assert.equal(await page.locator('#screenTable tbody tr').count(),11);
  await page.locator('#screenComparison summary').click();
}
await page.selectOption('#song','tiki');await page.waitForFunction(()=>window.__ready&&window.hitStudy.state().song==='tiki');await page.evaluate(()=>window.hitStudy.seek(13.95));await page.locator('#screenAnalysis').scrollIntoViewIfNeeded();await page.screenshot({path:'generated/hit-effects/screen-metrics.png'});
assert.deepEqual(errors,[]);console.log('PASS realized settings, 26% dose, all camera metrics, both songs, no browser errors');await b.close();
