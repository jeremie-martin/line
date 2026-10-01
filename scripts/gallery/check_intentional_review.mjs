/** Real native playback, optional media, comparison identity and navigation. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const origin=process.env.REVIEW_ORIGIN??'http://127.0.0.1:8767';
const collectionPath=process.env.REVIEW_COLLECTION??'motion-gallery/production-library.json';
const collection=JSON.parse(readFileSync(collectionPath,'utf8'));
const out=process.env.REVIEW_OUT??'generated/intentional-motion';mkdirSync(out,{recursive:true});
const reviewUrl=new URL(origin+'/motion-gallery/production.html');
if(process.env.REVIEW_COLLECTION)reviewUrl.searchParams.set('collection','/'+collectionPath.replace(/^\/+/,''));
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(reviewUrl.href);await page.waitForFunction(()=>!document.getElementById('play').disabled);
 assert.equal(await page.locator('#library button').count(),collection.entries.filter(e=>e.manifest).length);
 for(const [i,entry]of collection.entries.filter(e=>e.manifest).entries()){
  await page.locator('#library button').nth(i).click();
  await page.waitForFunction(()=>!document.getElementById('play').disabled);
  assert.match(await page.locator('#result-title').textContent(),new RegExp(`seed ${entry.seed}$`));
  const sampleTime=Math.min(5.95,Number(await page.locator('#seek').getAttribute('max'))/2);
  await page.locator('#seek').evaluate((e,t)=>{e.value=String(t);e.dispatchEvent(new Event('input'));},sampleTime);
  assert.equal(await page.locator('#time').textContent(),sampleTime.toFixed(2)+' s');
  const link=await page.locator('#passage-link').getAttribute('href');assert.equal(new URL(link).searchParams.get('t'),sampleTime.toFixed(3));
  assert.equal(new URL(link).searchParams.get('data'),entry.manifest);
  assert.equal(new URL(link).searchParams.get('collection'),reviewUrl.searchParams.get('collection'));
  if(entry.priorManifest){
   await page.selectOption('#comparison','1');
   assert.equal(await page.locator('#time').textContent(),sampleTime.toFixed(2)+' s');
   assert.equal(new URL(await page.locator('#passage-link').getAttribute('href')).searchParams.get('compare'),'ordinary');
   await page.selectOption('#comparison','2');
   assert.equal(await page.locator('#time').textContent(),sampleTime.toFixed(2)+' s');
   assert.equal(new URL(await page.locator('#passage-link').getAttribute('href')).searchParams.get('compare'),'previous');
   assert.ok(await page.locator('#motion-detail').isVisible());
   assert.match(await page.locator('#motion-summary').textContent(),/100 ms:.*above-band episodes/);
  }
  await page.locator('#play').click();await page.waitForFunction(t=>document.getElementById('audio').currentTime>t+.1,sampleTime);await page.locator('#play').click();
  const reportedPassages=[];
  const expectedTimes={'Calm opening':0,'Reported acceleration · 9.4s':8.7,'Reported acceleration · 5.95s':5.3,'Reported acceleration · 15.32s':14.7};
  const expectedLabels=[];
  if(/^(luna_bala_44s|tiki_tiki_48s)-/.test(entry.id))expectedLabels.push('Calm opening');
  const reported={'amour_de_ma_vie_44s-303':'Reported acceleration · 9.4s','amour_de_ma_vie_44s-101':'Reported acceleration · 5.95s','tiki_tiki_48s-101':'Reported acceleration · 15.32s'};
  if(reported[entry.id])expectedLabels.push(reported[entry.id]);
  const labels=await page.locator('#review-moments button').allTextContents();assert.deepEqual(labels,expectedLabels);
  for(const label of labels){
   assert.ok(Object.hasOwn(expectedTimes,label));
   await page.locator('#review-moments button').filter({hasText:label}).click();
   const t=expectedTimes[label];assert.equal(await page.locator('#time').textContent(),t.toFixed(2)+' s');
   assert.equal(new URL(await page.locator('#passage-link').getAttribute('href')).searchParams.get('t'),t.toFixed(3));
   reportedPassages.push({label,start:t});
  }
  await page.locator('#inspect').check();await page.locator('#inspect').uncheck();
  checks.push({id:entry.id,nativeReplay:true,synchronizedAudio:true,ordinaryComparison:true,previousArrangement:!!entry.priorManifest,shareableTime:true,
   motionDetails:!!entry.priorManifest,reportedPassages,contactInspectionToggle:true});
 }
 const last=collection.entries.filter(e=>e.manifest).at(-1);
 const url=new URL(reviewUrl);url.searchParams.set('data',last.manifest);url.searchParams.set('t','9.425');url.searchParams.set('compare',last.priorManifest?'previous':'ordinary');
 await page.goto(url.href);await page.waitForFunction(()=>!document.getElementById('play').disabled);
 assert.equal(await page.locator('#time').textContent(),'9.43 s');
 if(last.priorManifest)assert.equal(await page.locator('#comparison').inputValue(),'2');
 await page.evaluate(()=>{const b=document.querySelectorAll('#library button');b[1].click();b[6].click();b[b.length-1].click();});
 await page.waitForFunction(()=>!document.getElementById('play').disabled);
 assert.match(await page.locator('#result-title').textContent(),/seed 303$/);
 assert.match(await page.locator('#audio').getAttribute('data-source'),/amour_de_ma_vie/);
 checks.push({shareablePassageReload:true,rapidSeedSwitch:true});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:out+'/review-mobile.png',fullPage:true});checks.push({mobileNoOverflow:true});
 assert.deepEqual(errors,[]);
 writeFileSync(out+'/review-ui.json',JSON.stringify({collection:collectionPath,checks,errors},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,errors}));
}finally{await browser.close();}
