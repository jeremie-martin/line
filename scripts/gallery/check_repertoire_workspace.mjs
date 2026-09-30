/** End-to-end checks for editing, native playback, saved jobs and failure handling. */
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const root='generated/repertoire-workspace-20260930',origin='http://127.0.0.1:8767';
const browser=await chromium.launch({headless:true});const checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/motion-gallery/workspace.html');await page.waitForFunction(()=>!document.getElementById('play').disabled);
 assert.match(await page.locator('#playback-status').textContent(),/every recorded body point matches/);
 await page.locator('#title').fill('Draft retained');assert.match(await page.locator('#result-note').textContent(),/different arrangement/);
 await page.reload();await page.waitForFunction(()=>!document.getElementById('play').disabled);assert.equal(await page.locator('#title').inputValue(),'Draft retained');checks.push('draft survives reload without replacing playback');
 for(let i=0;i<4;i++){
  await page.locator('#examples button').nth(i).click();await page.waitForFunction(()=>!document.getElementById('play').disabled);
  assert.match(await page.locator('#playback-status').textContent(),/every recorded body point matches/);
  await page.locator('#seek').evaluate(e=>{e.value='25';e.dispatchEvent(new Event('input'));});assert.equal(await page.locator('#time').textContent(),'25.00 s');
  await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('audio').currentTime>25.15);await page.locator('#play').click();
 }
 checks.push('four arrangements replay, scrub and play with audio');
 await page.locator('#examples button').nth(0).click();await page.locator('#examples button').nth(3).click();await page.waitForFunction(()=>!document.getElementById('play').disabled);assert.equal(await page.locator('#result-title').textContent(),'Ripples and interruptions');checks.push('rapid switching cancels superseded replay');
 await page.locator('#use-result').click();const download=page.waitForEvent('download');await page.locator('#export').click();
 const saved=await download;await saved.saveAs(root+'/exported-arrangement.json');assert.equal(JSON.parse(readFileSync(root+'/exported-arrangement.json')).title,'Ripples and interruptions');checks.push('downloaded arrangement matches the editor');
 await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));assert.match(await page.locator('#status').textContent(),/JSON|property|Unexpected/);
 const composition={schema:'line.repertoire-plan.v1',title:'Workspace round trip',song:'luna_bala_44s',phrases:[{title:'A short folded reply',start:24.2,end:25.8,recipe:'fold'}]};
 await page.locator('#import').setInputFiles({name:'arrangement.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(composition))});await page.waitForFunction(()=>document.getElementById('title').value==='Workspace round trip');checks.push('valid JSON import and malformed-input rejection');
 const request={composition,seed:402,baselineBudget:1000000,compositionBudget:1000000};
 const invalid=await page.request.post(origin+'/api/repertoire/compile',{data:{...request,compositionBudget:0}});assert.equal(invalid.status(),400);
 const cross=await page.request.post(origin+'/api/repertoire/compile',{headers:{Origin:'https://invalid.example'},data:request});assert.equal(cross.status(),403);checks.push('invalid ceilings and foreign-origin submission rejected');
 const started=await page.request.post(origin+'/api/repertoire/compile',{data:request});assert.ok(started.ok());const {job}=await started.json();
 let state;for(let i=0;i<120;i++){state=(await(await page.request.get(origin+`/api/repertoire/jobs/${job.id}`)).json()).job;if(['complete','error','cancelled'].includes(state.status))break;await page.waitForTimeout(1000);}
 assert.equal(state.status,'complete',state.error);assert.equal(state.valid,true);
 const cached=await(await page.request.post(origin+'/api/repertoire/compile',{data:request})).json();assert.equal(cached.reused,true);assert.equal(cached.job.id,job.id);checks.push('actual bounded compilation completes and identical request reuses exact result');
 await page.goto(origin+'/motion-gallery/workspace.html?data='+encodeURIComponent(state.manifest));await page.waitForFunction(()=>!document.getElementById('play').disabled);assert.equal(await page.locator('#result-title').textContent(),composition.title);
 const altered={...request,composition:{...composition,title:'Cancelled check'},compositionBudget:4000000};const cancelled=(await(await page.request.post(origin+'/api/repertoire/compile',{data:altered})).json()).job;
 await page.request.post(origin+`/api/repertoire/jobs/${cancelled.id}/cancel`,{data:{}});const cancellation=(await(await page.request.get(origin+`/api/repertoire/jobs/${cancelled.id}`)).json()).job;assert.equal(cancellation.status,'cancelled');checks.push('cancel stops only the selected owned job');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(origin+'/motion-gallery/workspace.html');await mobile.waitForFunction(()=>!document.getElementById('play').disabled);assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mobile.screenshot({path:root+'/workspace-mobile.png',fullPage:true});checks.push('phone layout has no horizontal overflow');
 assert.deepEqual(errors,[]);writeFileSync(root+'/workspace-checks.json',JSON.stringify({checks,errors,job:state},null,2)+'\n');console.log(JSON.stringify({checks,errors,job:job.id}));
}finally{await browser.close();}
