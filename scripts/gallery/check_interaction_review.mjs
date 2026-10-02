/** Exercise the candidate review through the real production player.
 * Requires scripts/serve.ts and the generated interaction-candidates study.
 * Screenshots and browser notes remain local; no generation jobs are submitted.
 */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const arg=(key,fallback)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const origin=arg('origin','http://localhost:8767'),out=arg('out','generated/interaction-candidates-20261002');
const source='/generated/interaction-candidates-20261002/review.json';
const body=readFileSync('.'+source),data=JSON.parse(body);
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(body),readFileSync('.'+source+'.sha256','utf8').trim());mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),errors=[],checks=[];
const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const url=id=>`${origin}/motion-gallery/production.html?review=${source}&clip=${id}`;
const ready=()=>page.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:60000});
const choose=async id=>{await page.selectOption('#interaction-passage',id);await ready();};
const seek=async t=>page.locator('#seek').evaluate((e,t)=>{e.value=String(t);e.dispatchEvent(new Event('input'));},t);
try {
 await page.goto(url('merged-hits'));await ready();
 for(const clip of data.clips){
  await choose(clip.id);
  assert.ok((await page.locator('#record-link').getAttribute('href')).endsWith(clip.record));
  assert.equal(+(await page.locator('#seek').getAttribute('min')),Math.floor(clip.range[0]*40)/40);
  assert.equal(+(await page.locator('#seek').getAttribute('max')),Math.ceil(clip.range[1]*40)/40);
  assert.equal(await page.locator('#interaction-observations details').getAttribute('hidden'),null);
 }
 checks.push({allPassagesLoad:data.clips.length,nativeRecordsBound:true,excerptRanges:true});
 await choose('merged-hits');await seek(14.95);
 await page.locator('#interaction-notes').fill('Browser validation note');
 await page.getByRole('button',{name:'Mark current time',exact:true}).click();
 await choose('clean-landing');assert.equal(await page.locator('#interaction-notes').inputValue(),'');
 await choose('merged-hits');assert.equal(await page.locator('#interaction-notes').inputValue(),'Browser validation note');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export observations',exact:true}).click();
 const exported=JSON.parse(readFileSync(await (await download).path()));
 assert.equal(exported.panelSha256,data.panelSha256);assert.equal(exported.candidatesSha256,data.candidatesSha256);
 assert.deepEqual(exported.annotations['merged-hits'].times,[14.95]);
 assert.equal(exported.annotations['merged-hits'].trackHash,data.clips.find(c=>c.id==='merged-hits').trackHash);
 await page.reload();await ready();assert.equal(await page.locator('#interaction-notes').inputValue(),'Browser validation note');
 checks.push({notesIsolatedByPassage:true,notesSurviveReload:true,exportCarriesArtifactIdentityAndMarkedTimes:true});
 await page.locator('#play').click();
 // Wait for playback to start before waiting for the automatic pause. The Play
 // label remains unchanged while audio.play() is still resolving.
 await page.waitForFunction(()=>document.getElementById('play').textContent==='Pause');
 await page.waitForFunction(()=>document.getElementById('play').textContent==='Play',null,{timeout:10000});
 const stopped=await page.locator('#audio').evaluate(e=>({time:e.currentTime,paused:e.paused}));
 const end=+(await page.locator('#seek').getAttribute('max'));
 assert.ok(stopped.paused&&stopped.time>=end-.05&&stopped.time<end+.25);
 await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').textContent==='Pause');
 assert.ok((await page.locator('#audio').evaluate(e=>e.currentTime))<end-.5);
 await page.locator('#interaction-observations summary').click();
 const svg=page.locator('.interaction-chart svg');await svg.click({position:{x:300,y:100}});
 assert.equal(await page.locator('#play').textContent(),'Play');
 checks.push({musicPlayback:true,autopauseAtExcerptEnd:true,restartAtExcerptBeginning:true,chartSeeksAndPausesNativePlayer:true});
 await page.screenshot({path:out+'/review-measurements.png',fullPage:true});
 await page.locator('#interaction-observations summary').click();
 await page.screenshot({path:out+'/review-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:out+'/review-mobile.png',fullPage:true});
 checks.push({mobileHorizontalOverflow:false});
 await page.evaluate(ids=>{const e=document.getElementById('interaction-passage');for(const id of ids){e.value=id;e.dispatchEvent(new Event('change'));}},['amour-strong','luna-opening','merged-hits']);
 await ready();assert.ok((await page.locator('#record-link').getAttribute('href')).endsWith(data.clips.find(c=>c.id==='merged-hits').record));
 checks.push({rapidSelectionLeavesFinalPassage:true});
 // A valid checksum on a study file does not prove its chart belongs to the
 // loaded physical ride. The second identity check must reject this mismatch.
 const bad=structuredClone(data);bad.clips.find(c=>c.id==='merged-hits').trackHash='different-track';
 const altered=JSON.stringify(bad);
 await page.route('**'+source,route=>route.fulfill({contentType:'application/json',body:altered}));
 await page.route('**'+source+'.sha256',route=>route.fulfill({body:hash(altered)}));
 await page.goto(url('merged-hits'));
 await page.waitForFunction(()=>document.getElementById('result-note').textContent.includes('Study observations do not match'));
 assert.equal(await page.locator('#play').isDisabled(),true);assert.equal(await page.locator('#seek').isDisabled(),true);
 assert.equal(await page.locator('#interaction-observations details').isHidden(),true);
 checks.push({rejectsMismatchedStudyTrack:true,noStaleMeasurementsOnFailure:true});
 await page.unrouteAll();
 await page.goto(`${origin}/motion-gallery/production.html`);await ready();
 assert.equal(await page.locator('#interaction-review').count(),0);assert.equal(await page.locator('#generate').isVisible(),true);
 assert.equal(+(await page.locator('#seek').getAttribute('min')),0);
 checks.push({normalProductionViewUnaffected:true});
 assert.deepEqual(errors,[]);
 const result={schema:'line.interaction-review-checks.v1',reviewSha256:hash(body),scriptSha256:hash(readFileSync(import.meta.filename)),checks,errors};
 const bytes=JSON.stringify(result,null,2)+'\n';writeFileSync(out+'/browser.json',bytes);writeFileSync(out+'/browser.json.sha256',hash(bytes)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
