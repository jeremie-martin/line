/** Browser regression of the finished musical comparison and exact-track links. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const arg=key=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
assert.ok(arg('study')&&arg('out'));
const path=arg('study')+'/manifest.json',manifest=JSON.parse(readFileSync(path)),out=arg('out');
const origin=arg('origin')??'http://127.0.0.1:8767',url=`${origin}/motion-gallery/music.html?data=/${path}`;
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(readFileSync(path)),readFileSync(path+'.sha256','utf8').trim());
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Same preserved tracks'),null,{timeout:120000});
  const seek=async t=>{await page.locator('#seek').fill(String(t));await page.locator('#seek').dispatchEvent('input');
    await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>!v.seeking&&v.readyState>=2));};
  await page.goto(url);await ready();
  assert.equal(await page.locator('#variant').inputValue(),'mixed');
  const firstCase=manifest.plan.cases[0],focus=manifest.plan.repertoire?firstCase.guidance[0]:firstCase.mixed[0];
  assert.equal(+(await page.locator('#seek').inputValue()),firstCase.moments.reduce((best,m)=>Math.abs(m.time-focus)<Math.abs(best.time-focus)?m:best).time);
  const otherMethod=manifest.plan.methods.includes('guidance')?'guidance':'ripple';
  const shapeMethod=manifest.plan.repertoire?'candidate':manifest.plan.geometry??'facets';
  let comparisons=0;
  for(const c of manifest.plan.cases)for(const seed of manifest.plan.seeds)for(const method of manifest.plan.methods.filter(m=>m!=='baseline')){
    await page.evaluate(({song,seed,method})=>{
      for(const [id,value]of Object.entries({song,seed,variant:method}))document.getElementById(id).value=String(value);
      document.getElementById('variant').dispatchEvent(new Event('change'));
    },{song:c.id,seed,method});await ready();
    const href=new URL(await page.locator('#inspect').getAttribute('href'));
    assert.equal(href.searchParams.get('passage'),c.id);assert.equal(href.searchParams.get('seed'),String(seed));assert.equal(href.searchParams.get('right'),method);
    assert.ok((await page.locator('#decision').textContent()).length>20);comparisons++;
  }
  await page.selectOption('#song',manifest.plan.cases[0].id);await ready();
  await page.selectOption('#seed',String(manifest.plan.seeds[0]));await ready();
  await page.selectOption('#variant','mixed');await ready();
  await page.locator('#moments button').last().click();await seek(24.8);
  assert.deepEqual(await page.locator('video').evaluateAll(vs=>vs.map(v=>v.muted)),[false,true]);
  const time=await page.locator('video').evaluateAll(vs=>vs.map(v=>v.currentTime));assert.ok(time.every(t=>Math.abs(t-24.8)<.01));
  await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('baseline').currentTime>25.1);
  await page.selectOption('#variant',otherMethod);await ready();assert.equal(await page.locator('#play').textContent(),'Pause');
  assert.ok(+(await page.locator('#seek').inputValue())>=25.1);
  assert.ok((await page.locator('#moment-label').textContent()).includes(manifest.plan.cases[0].moments.at(-1).title));
  await page.evaluate(seeds=>{for(const seed of seeds){const s=document.getElementById('seed');s.value=String(seed);s.dispatchEvent(new Event('change'));}},[...manifest.plan.seeds].reverse());
  await ready();assert.equal(await page.locator('#play').textContent(),'Pause');await page.locator('#play').click();
  assert.ok(await page.locator('video').evaluateAll(vs=>Math.abs(vs[0].currentTime-vs[1].currentTime)<.001));
  await page.selectOption('#rate','0.5');assert.deepEqual(await page.locator('video').evaluateAll(vs=>vs.map(v=>v.playbackRate)),[.5,.5]);
  await page.selectOption('#variant',shapeMethod);await ready();
  assert.deepEqual(await page.locator('video').evaluateAll(vs=>vs.map(v=>v.playbackRate)),[.5,.5]);
  await page.selectOption('#rate','1');
  // A pause while a replacement is downloading must cancel resume intent.
  await page.route('**/*.video.json',async route=>{await new Promise(r=>setTimeout(r,300));await route.continue();});
  await page.locator('#play').click();await page.selectOption('#variant','mixed');await page.locator('#play').click();
  await ready();assert.equal(await page.locator('#play').textContent(),'Play');await page.unroute('**/*.video.json');
  // Temporary download failures are retried instead of being cached forever.
  let fail=true;await page.route(`**/*-${otherMethod}.video.json`,route=>fail?route.fulfill({status:503,body:'temporary'}):route.continue());
  await page.selectOption('#variant',otherMethod);await page.waitForFunction(()=>!document.getElementById('retry').hidden);
  assert.equal(await page.locator('#play').isDisabled(),true);
  fail=false;await page.locator('#retry').click();await ready();await page.unroute(`**/*-${otherMethod}.video.json`);
  await page.selectOption('#variant','mixed');await ready();await page.locator('#moments button').last().click();await seek(24.8);
  assert.ok(await page.locator('#targets tr').count()>0);
  const inspect=await page.locator('#inspect').getAttribute('href'),native=await browser.newPage();await native.goto(inspect);
  await native.waitForFunction(()=>document.getElementById('panels').dataset.state==='ready');
  assert.equal(await native.locator('#left-method').inputValue(),'baseline');assert.equal(await native.locator('#right-method').inputValue(),'mixed');
  assert.equal(await native.locator('#seed').inputValue(),await page.locator('#seed').inputValue());
  assert.equal(+(await native.locator('#seek').inputValue()),24.8);
  assert.equal(await native.locator('.details').filter({hasText:'original feedback'}).count(),0);
  await native.close();
  mkdirSync(dirname(out),{recursive:true});await page.screenshot({path:out+'.desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.locator('.videos').scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:out+'.mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const view of ['baseline','alternative']){
    await page.selectOption('#display',view);
    assert.equal(await page.locator('.videos article:visible').count(),1);
    assert.ok(await page.locator('.videos article:visible').evaluate(e=>e.getBoundingClientRect().width)>300);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.selectOption('#display','both');
  assert.deepEqual(errors,[]);
  const result={schema:'line.musical-direction-ui-checks.v1',manifest:{path,sha256:hash(readFileSync(path))},comparisons,
    singleAudioSource:true,synchronizedSeeking:true,playbackPreservedAcrossVariants:true,seedChoices:manifest.plan.seeds.length,
    rapidSeedSwitch:manifest.plan.seeds.length>1?true:null,
    pauseDuringReplacementRespected:true,failedDownloadRetry:true,exactTrackInspectorLink:true,localTargetsShown:true,fullWidthSingleVideoView:true,mobileOverflow:false,errors,
    files:Object.fromEntries(['motion-gallery/music.html','motion-gallery/music.js','motion-gallery/music.css','motion-gallery/main.js'].map(p=>[p,hash(readFileSync(p))]))};
  const body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',hash(body)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
