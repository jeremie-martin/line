/** Exercise the actual completed production collection and its media controls. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:8767',out='generated/production-repertoire';
const collection=JSON.parse(readFileSync('motion-gallery/production-library.json','utf8'));
assert.equal(collection.entries.length,12);
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/motion-gallery/');
 await page.waitForURL('**/production.html');
 await page.waitForFunction(()=>!document.getElementById('play').disabled);
 assert.equal(await page.locator('#library button').count(),12);
 for(let i=0;i<collection.entries.length;i++){
  const entry=collection.entries[i];
  await page.locator('#library button').nth(i).click();
  await page.waitForFunction(()=>!document.getElementById('play').disabled);
  assert.match(await page.locator('#result-title').textContent(),new RegExp(`seed ${entry.seed}$`));
  assert.match(await page.locator('#result-note').textContent(),/every requested construction fulfilled/);
  assert.ok(await page.locator('#observations tr').count()>20);
  await page.locator('#seek').evaluate(e=>{e.value='12';e.dispatchEvent(new Event('input'));});
  assert.equal(await page.locator('#time').textContent(),'12.00 s');
  await page.locator('#play').click();
  await page.waitForFunction(()=>document.getElementById('audio').currentTime>12.1);
  await page.locator('#play').click();
  await page.waitForFunction(()=>!document.getElementById('movie').hidden&&document.getElementById('movie').readyState>=1);
  const media=await page.locator('#movie').evaluate(e=>({w:e.videoWidth,h:e.videoHeight,d:e.duration,src:e.currentSrc}));
  assert.equal(media.w,1080);assert.equal(media.h,1920);assert.ok(media.d>40);
  await page.locator('#reference-movie-link').waitFor({state:'visible'});
  assert.match(await page.locator('#reference-movie-link').getAttribute('href'),/baseline/);
  checks.push({id:entry.id,nativeReplay:true,synchronizedAudio:true,video:media});
 }
 // A finished video and the native inspection player must not play over each other.
 await page.locator('#movie').evaluate(e=>e.play());
 await page.waitForFunction(()=>document.getElementById('movie').currentTime>.1);
 assert.equal(await page.locator('#audio').evaluate(e=>e.paused),true);
 await page.locator('#timeline button').nth(2).click();
 assert.equal(await page.locator('#movie').evaluate(e=>e.paused),true);
 await page.locator('#play').click();
 await page.waitForFunction(()=>!document.getElementById('audio').paused);
 await page.locator('#movie').evaluate(e=>e.play());
 assert.equal(await page.locator('#audio').evaluate(e=>e.paused),true);
 checks.push({mutuallyExclusiveMediaPlayback:true,phraseSeekPausesVideo:true});
 await page.evaluate(()=>{const buttons=document.querySelectorAll('#library button');buttons[1].click();buttons[6].click();buttons[11].click();});
 await page.waitForFunction(()=>!document.getElementById('play').disabled);
 await page.waitForFunction(()=>!document.getElementById('movie').hidden&&document.getElementById('movie').readyState>=1);
 assert.match(await page.locator('#result-title').textContent(),/seed 303$/);
 assert.match(await page.locator('#audio').getAttribute('data-source'),/amour_de_ma_vie/);
 assert.match(await page.locator('#audio').getAttribute('src'),/^blob:/);
 assert.match(await page.locator('#movie').getAttribute('src'),/amour_de_ma_vie_44s-303/);
 assert.equal(await page.locator('#movie').evaluate(e=>e.paused),true);
 checks.push({rapidSwitchUsesFinalSongSeedAndVideo:true});
 await page.screenshot({path:out+'/production-final-desktop.png',fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 mobile.setDefaultTimeout(60000);mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto(origin+'/motion-gallery/production.html');
 await mobile.waitForFunction(()=>!document.getElementById('play').disabled);
 await mobile.waitForFunction(()=>!document.getElementById('movie').hidden);
 assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await mobile.screenshot({path:out+'/production-final-mobile.png',fullPage:true});
 checks.push({mobileWidth:390,noHorizontalOverflow:true});
 // A historical track must never play changed bytes from a mutable audio path.
 const stale=await browser.newPage();stale.setDefaultTimeout(60000);stale.on('pageerror',e=>errors.push(e.message));
 await stale.route('**/*.mp3',async route=>{const response=await route.fetch(),body=Buffer.from(await response.body());body[0]^=1;await route.fulfill({response,body});});
 await stale.goto(origin+'/motion-gallery/production.html');
 await stale.waitForFunction(()=>document.getElementById('status').textContent.includes('does not match the saved recording'));
 assert.equal(await stale.locator('#play').isDisabled(),true);assert.equal(await stale.locator('#seek').isDisabled(),false);
 await stale.locator('#seek').evaluate(e=>{e.value='12';e.dispatchEvent(new Event('input'));});
 assert.equal(await stale.locator('#time').textContent(),'12.00 s');
 await stale.unroute('**/*.mp3');await stale.reload();await stale.waitForFunction(()=>!document.getElementById('play').disabled);
 checks.push({changedRecordingCannotPlayAgainstSavedTrack:true,scrubbingSurvivesAudioMismatch:true,verifiedAudioRecoversOnReload:true});
 assert.deepEqual(errors,[]);
 writeFileSync(out+'/production-final-browser.json',JSON.stringify({checks,errors},null,2)+'\n');
 console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}
