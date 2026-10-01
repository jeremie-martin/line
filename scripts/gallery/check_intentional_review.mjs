/** Real native playback, optional media, comparison identity and navigation. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const origin=process.env.REVIEW_ORIGIN??'http://127.0.0.1:8767';
const collection=JSON.parse(readFileSync('motion-gallery/production-library.json','utf8'));
const out='generated/intentional-motion';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/motion-gallery/production.html');await page.waitForFunction(()=>!document.getElementById('play').disabled);
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
  if(entry.priorManifest){
   await page.selectOption('#comparison','2');
   assert.equal(await page.locator('#time').textContent(),sampleTime.toFixed(2)+' s');
   assert.equal(new URL(await page.locator('#passage-link').getAttribute('href')).searchParams.get('compare'),'previous');
  }
  await page.locator('#play').click();await page.waitForFunction(t=>document.getElementById('audio').currentTime>t+.1,sampleTime);await page.locator('#play').click();
  checks.push({id:entry.id,nativeReplay:true,synchronizedAudio:true,previousArrangement:!!entry.priorManifest,shareableTime:true});
 }
 const last=collection.entries.filter(e=>e.manifest).at(-1);
 const url=new URL(origin+'/motion-gallery/production.html');url.searchParams.set('data',last.manifest);url.searchParams.set('t','9.425');url.searchParams.set('compare',last.priorManifest?'previous':'ordinary');
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
 writeFileSync(out+'/review-ui.json',JSON.stringify({checks,errors},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,errors}));
}finally{await browser.close();}
