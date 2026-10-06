/** Browser check of the complete, separately published campaign review. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const main='/home/wyss/line',catalog=JSON.parse(readFileSync(main+'/docs/research/quality-20261005-passive-catalog.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8767/generated/report/quality-20261005/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#metrics tr').length===37);
 assert.equal(await page.locator('#error').innerText(),'');assert.equal(await page.locator('#trial').inputValue(),'Q67');
 assert.equal(await page.locator('#curveChoice').inputValue(),'Q67');assert.equal(await page.locator('#clipTrial').inputValue(),'Q67');
 assert.equal(await page.locator('#passage option').count(),8);assert.equal(await page.locator('#fullSong option').count(),4);
 assert.equal(await page.locator('#freshDragPairs .pair').count(),3);assert.ok(await page.locator('#catalogData').isVisible());
 const catalogChecks=[];
 for(const comparison of ['baseline','q62'])for(const subset of ['all','completeBoth']){
  await page.locator('#catalogBaseline').selectOption(comparison);await page.locator('#catalogSubset').selectOption(subset);
  const expected=catalog.comparisons[comparison].subsets[subset];
  assert.equal(await page.locator('#catalogMetrics tr').count(),Object.keys(expected.metrics).length);
  assert.ok((await page.locator('#catalogIdentity').innerText()).startsWith(expected.cases+' cases'));
  const row=page.locator('#catalogMetrics tr').filter({has:page.locator('td:first-child',{hasText:/^impact loss \(v3\)$/})});
  const values=await row.locator('td').allTextContents();assert.equal(values[1],expected.metrics['impact loss (v3)'].baseline[0].toFixed(4));
  assert.equal(values[2],expected.metrics['impact loss (v3)'].candidate[0].toFixed(4));
  catalogChecks.push({comparison,subset,cases:expected.cases,rows:Object.keys(expected.metrics).length,impact:values});
 }
 await page.locator('#catalogBaseline').selectOption('baseline');await page.locator('#catalogSubset').selectOption('all');
 await page.locator('#catalogData details summary').click();assert.equal(await page.locator('#catalogGroupHead th').count(),catalog.groups.length+1);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 await page.locator('#trial').selectOption('Q52');assert.equal(await page.locator('#curveChoice').inputValue(),'Q52');await page.locator('#trial').selectOption('Q67');
 const full=[];
 for(let i=0;i<4;i++){
  await page.locator('#fullSong').selectOption(String(i));
  full.push(await page.evaluate(()=>['fullBaseline','fullCandidate'].map(id=>(document.getElementById(id) as HTMLVideoElement).src)));
 }
 assert.equal(new Set(full.flat()).size,8);
 await page.evaluate(async()=>{const v=document.getElementById('fullCandidate') as HTMLVideoElement;v.muted=true;await v.play()});
 await page.waitForTimeout(800);const fullPlaying=await page.locator('#fullCandidate').evaluate((v:HTMLVideoElement)=>({paused:v.paused,time:v.currentTime}));
 assert.equal(fullPlaying.paused,false);assert.ok(fullPlaying.time>0);
 await page.locator('#fullCandidate').evaluate((v:HTMLVideoElement)=>v.pause());
 await page.locator('#play').click();await page.waitForTimeout(800);
 const pair=await page.evaluate(()=>['before','after'].map(id=>{const v=document.getElementById(id) as HTMLVideoElement;return {id,time:v.currentTime,paused:v.paused}}));
 assert.ok(pair.every(v=>!v.paused&&v.time>0));assert.ok(Math.abs(pair[0].time-pair[1].time)<.15);await page.locator('#pause').click();
 assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/line-quality-final-review-mobile.png',fullPage:true});
 const result={at:new Date().toISOString(),viewport:{width:390,height:844},defaultTrial:'Q67',metrics:37,clips:8,fullSongs:4,freshDiagnosticPairs:3,catalogChecks,
  overflow,full,fullPlaying,pair,errors};
 writeFileSync(main+'/docs/research/quality-20261005-review-ui.json',JSON.stringify(result,null,2)+'\n');console.log('Complete review, catalog controls and media pass mobile browser check');
}finally{await browser.close()}
