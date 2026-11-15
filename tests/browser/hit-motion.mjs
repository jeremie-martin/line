// Run after preparing the hit study and starting the review server.
// node tests/browser/hit-motion.mjs (HIT_STUDY_URL may override the server).
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.HIT_STUDY_URL ?? 'http://10.77.77.1:8770/generated/concept-lab/hit-motion.html';
const b=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']}),p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.goto(url);await p.waitForFunction(()=>window.__ready);
await p.evaluate(()=>window.hitStudy.seek(10.45));
await p.screenshot({path:'generated/hit-effects/revised-desktop.png',fullPage:true});
console.log(await p.evaluate(()=>({canvas:[document.querySelector('#candidate').width,document.querySelector('#candidate').height],bg:getComputedStyle(document.body).backgroundColor,themeOptions:document.querySelector('#theme').options.length,overflow:document.documentElement.scrollWidth>innerWidth})));
const timing=await p.evaluate(()=>{const ts=[];for(let i=0;i<30;i++){const t=performance.now();window.hitStudy.seek(10.4+i/60);ts.push(performance.now()-t);}return {median:ts.sort((a,b)=>a-b)[15],max:Math.max(...ts)};});console.log('1080 frame draw ms',timing);
await p.click('#play');await p.waitForTimeout(250);await p.click('#variants button[data-mode=press]');await p.waitForTimeout(250);assert.equal(await p.locator('#play').textContent(),'Pause');await p.keyboard.press('a');assert(await p.locator('#baseline').isVisible());await p.click('#play');
await p.locator('#curves').scrollIntoViewIfNeeded();await p.screenshot({path:'generated/hit-effects/revised-curves.png'});
assert.equal(await p.locator('#curves svg').count(),4);assert.equal(await p.locator('#curves path').count(),8);
await p.selectOption('#song','circus');await p.waitForFunction(()=>window.__ready&&window.hitStudy.state().song==='circus');
await p.selectOption('#view','pair');await p.evaluate(()=>{window.hitStudy.select('current');window.hitStudy.seek(18.1);});assert(await p.evaluate(()=>document.querySelector('#baseline').toDataURL()===document.querySelector('#candidate').toDataURL()));
await p.evaluate(async()=>{
  const N=await import('/generated/renderer/native.js'),{createPicture}=await import('/scripts/video/picture.js'),{resolveLook}=await import('/scripts/video/look.js');
  const scene=await(await fetch('/generated/hit-effects/data/circus.json')).json(),replay=await N.replay(scene.track,scene.trace),sheet=await N.loadSheet();
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
  createPicture(canvas,scene,replay,sheet,N.riderPainter()).draw(18.1,resolveLook('hokusai',{ends:'none',hits:'v1'}));
  if(canvas.toDataURL()!==document.querySelector('#baseline').toDataURL())throw Error('Full HD study baseline differs from production picture');
});
await p.evaluate(()=>{const song=document.querySelector('#song');for(const key of ['tiki','circus']){song.value=key;song.dispatchEvent(new Event('change'));}});
await p.waitForFunction(()=>window.__ready&&window.hitStudy.state().song==='circus');
const changed=await p.evaluate(()=>{window.hitStudy.seek(5);const a=document.querySelector('#candidate').toDataURL();window.hitStudy.seek(6);return a!==document.querySelector('#candidate').toDataURL();});assert(changed,'cached-song reload left a stale picture');
await p.emulateMedia({colorScheme:'dark'});assert.equal(await p.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(242, 243, 245)');
const phone=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});phone.on('pageerror',e=>errors.push(e.message));await phone.goto(url);await phone.waitForFunction(()=>window.__ready);await phone.locator('#variants').scrollIntoViewIfNeeded();await phone.selectOption('#quickEffect','spring');assert.equal(await phone.evaluate(()=>window.hitStudy.state().mode),'spring');const quick=await phone.locator('#quickEffect').boundingBox();assert(quick.y>=0 && quick.y+quick.height<844);await phone.screenshot({path:'generated/hit-effects/revised-phone.png'});assert(await phone.locator('#candidate').isVisible());assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
assert.deepEqual(errors,[]);console.log('PASS desktop/phone layout, full-resolution canvas, playing switches, A/B equality, chart series, both songs, light chrome, no page errors');await b.close();
