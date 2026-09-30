/** Loading/playback regressions with real gallery data and injected failures.
 * npm run gallery:renderer
 * node scripts/gallery/check_interactions.mjs --out=generated/gallery-interactions.json
 * Requires npm run dash. Large data and screenshots remain local. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const arg=key=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const origin=arg('origin')??'http://127.0.0.1:8767';
const out=arg('out');assert.ok(out,'Supply --out=PATH');
const paths=[
 'generated/motion-gallery/20260930-functional-rails/manifest.json',
 arg('guide-study')??'generated/motion-gallery/20260930-guide-intent/manifest.json',
];
const hash=b=>createHash('sha256').update(b).digest('hex');
async function ready(page){
 try{await page.waitForFunction(()=>document.getElementById('panels').dataset.state==='ready');}
 catch(error){console.error(await page.locator('#status').textContent());throw error;}
}
const failure=page=>page.waitForFunction(()=>document.getElementById('panels').dataset.state==='error');
const time=async page=>+(await page.locator('#seek').inputValue());
const shown=page=>page.locator('.details a').evaluateAll(links=>links.map(a=>new URL(a.href).pathname));
async function inputs(page,values){
 await page.evaluate(values=>{for(const [key,value] of Object.entries(values))document.getElementById(key).value=String(value);document.getElementById(Object.keys(values)[0]).dispatchEvent(new Event('change'));},values);
}
async function seek(page,t){await page.locator('#seek').fill(String(t));await page.locator('#seek').dispatchEvent('input');}
const browser=await chromium.launch();const rows=[],errors=[];
async function pageFor(path,setup){
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 page.on('pageerror',error=>errors.push(error.message));
 await setup?.(page);
 await page.goto(`${origin}/motion-gallery/?data=/${path}`, {waitUntil:'domcontentloaded'});
 return page;
}
try {
 for(const path of paths){
  const m=JSON.parse(readFileSync(path)),base='/'+dirname(path)+'/',url=c=>base+c.path;
  assert.equal(hash(readFileSync(path)),readFileSync(path+'.sha256','utf8').trim());
  console.log(`Interactions: ${path}`);
  const page=await pageFor(path);await ready(page);
  const budget=+(await page.locator('#budget').inputValue()),a=m.plan.seeds[0],b=m.plan.seeds[1];
  assert.ok(b!==undefined&&m.plan.cases.length>1,'interaction study needs two seeds and passages');
  const checkShown=async(caseId,seed)=>{
   const ids=await shown(page);assert.equal(ids.length,2);
   const method=m.plan.kind==='guide-choice'?await page.locator('#left-method').inputValue():null;
   for(const id of ids)assert.ok(m.cells.some(c=>url(c)===id&&c.caseId===caseId&&c.seed===seed&&c.budget===budget&&(!method||c.method===method)),id);
  };
  await seek(page,1);await page.locator('#play').click();
  await page.selectOption('#seed',String(b));await ready(page);
  assert.equal(await page.locator('#play').textContent(),'Pause');assert.ok(await time(page)>=1);
  const before=await time(page);await page.waitForTimeout(200);assert.ok(await time(page)>before);
  await page.locator('#play').click();const paused=await time(page);
  await page.selectOption('#seed',String(a));await ready(page);assert.equal(await time(page),paused);
  await checkShown(m.plan.cases[0].id,a);
  // A blocked, now-obsolete comparison must not prevent a newer selection loading.
  let release,started;const blocked=new Promise(r=>started=r),gate=new Promise(r=>release=r);
  const coldCase=m.plan.cases[1].id;
  const slow=new Set(m.cells.filter(c=>c.caseId===coldCase&&c.seed===b&&c.budget===budget).map(url));
  await page.route('**/*.json',async route=>{
   if(slow.has(new URL(route.request().url()).pathname)){started();await gate;}
   await route.continue().catch(()=>{});
  });
  await page.locator('#play').click();await inputs(page,{passage:coldCase,seed:b});await blocked;
  assert.equal(await page.locator('#panels canvas').count(),0);
  assert.equal(await page.locator('#seek').isDisabled(),true);
  assert.equal(await page.locator('#play').textContent(),'Pause');
  await page.locator('#play').click(); // Pause intent must also work during loading.
  await inputs(page,{passage:m.plan.cases[0].id,seed:a});await ready(page);
  assert.equal(await page.locator('#play').textContent(),'Play');assert.equal(await time(page),0);
  release();await page.waitForTimeout(100);await checkShown(m.plan.cases[0].id,a);
  await page.unroute('**/*.json');
  // Seed bursts leave the last requested pair on screen, with the paused playhead intact.
  await seek(page,1.5);
  await page.evaluate(seeds=>{for(const seed of seeds){const el=document.getElementById('seed');el.value=String(seed);el.dispatchEvent(new Event('change'));}},[b,a,b,a,b]);
  await ready(page);await checkShown(m.plan.cases[0].id,b);assert.equal(await time(page),1.5);
  if(m.plan.kind==='guide-choice'){
   await page.locator('#play').click();
   await page.locator('#extra-error').fill('0.02');await page.locator('#extra-error').dispatchEvent('input');await ready(page);
   assert.equal(await page.locator('#play').textContent(),'Pause');
   const method=await page.locator('#left-method').inputValue();
   const p=m.portfolios.find(p=>p.caseId===m.plan.cases[0].id&&p.seed===b&&p.budget===budget&&(p.method??'arcs')===method);
   const d=p.decisions.find(d=>d.section===1);assert.ok(d);
   await page.selectOption('#choice-fork',d.id??String(d.section));await ready(page);
   assert.equal(await time(page),d.frame/40);
   assert.equal(await page.locator('#play').textContent(),'Play');
   if(m.plan.methods.length>1){
    await seek(page,1);await page.locator('#play').click();
    await page.selectOption('#left-method',m.plan.methods.find(v=>v!==method));await ready(page);
    assert.equal(await page.locator('#play').textContent(),'Pause');assert.ok(await time(page)>=1);await checkShown(p.caseId,b);
    await page.locator('#play').click();const paused=await time(page);
    await page.evaluate(methods=>{for(const method of methods){const el=document.getElementById('left-method');el.value=method;el.dispatchEvent(new Event('change'));}},[...m.plan.methods].reverse());
    await ready(page);assert.equal(await time(page),paused);await checkShown(p.caseId,b);
   }
  }else{
   await page.locator('#play').click();await page.selectOption('#right-method','paired');await ready(page);
   assert.equal(await page.locator('#play').textContent(),'Pause');await page.locator('#play').click();
   // A missing thumbnail cannot hold selected tracks hostage.
   const selected=new Set(await shown(page));
   for(const c of m.cells.filter(c=>c.caseId===m.plan.cases[0].id&&c.seed===a&&c.budget===budget&&['arcs','paired'].includes(c.method)))selected.add(url(c));
   await page.close();
   let previews=0,releasePreviews;const previewGate=new Promise(r=>releasePreviews=r);
   const fresh=await pageFor(path,async p=>p.route('**/*.json',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname.startsWith(base)&&pathname!==`/${path}`&&!selected.has(pathname)){previews++;await previewGate;}
    await route.continue().catch(()=>{});
   }));
   // Choose the same selected pair before its initial request finishes; initial default requests are allowed too.
   await ready(fresh);await inputs(fresh,{'right-method':'paired',seed:b});await ready(fresh);
   await fresh.locator('#play').click();const t=await time(fresh);await fresh.waitForTimeout(200);assert.ok(await time(fresh)>t);
   assert.ok(previews>0);releasePreviews();await fresh.close();
  }
  if(!page.isClosed()){
   await page.setViewportSize({width:390,height:844});await page.selectOption('#seed',String(a));await ready(page);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.close();
  }
  // One HTTP error must be recoverable through the visible retry button.
  let failedPath,requests=0;
  const bad=await pageFor(path,async p=>p.route('**/*.json',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname.startsWith(base)&&pathname!==`/${path}`){
    if(!failedPath)failedPath=pathname;
    if(pathname===failedPath&&++requests===1)return route.fulfill({status:503,body:'Injected temporary outage'});
   }
   await route.continue();
  }));
  await failure(bad);assert.match(await bad.locator('#status').textContent(),/503/);
  assert.equal(await bad.locator('#panels canvas').count(),0);
  await bad.locator('#retry').click();await ready(bad);assert.ok(requests>=2);await bad.close();
  rows.push({path,sha256:hash(readFileSync(path)),preservesPlaybackAndPlayhead:true,pausedSeedSwitch:true,rapidSeedSwitch:true,
   cancelsStaleDownloads:true,pauseDuringLoading:true,noStalePanels:true,retriesFailedDownload:true,
   ...(m.plan.kind==='guide-choice'?{preferencePreservesPlayback:true,forkPausesAtBoundary:true,mobileOverflow:false,geometrySwitchPreservesPlayback:m.plan.methods.length>1}:{selectedTracksBeforePreviews:true,stylePreservesPlayback:true})});
 }
 // Replacing a selection must terminate an in-flight replay, not wait behind it.
 let workers=0;
 const interrupted=await pageFor(paths[1],async p=>{
  await p.addInitScript(()=>{
   const NativeWorker=window.Worker;window.replayRequests=0;
   window.Worker=class extends NativeWorker{postMessage(...args){window.replayRequests++;super.postMessage(...args);}};
  });
  await p.route('**/motion-gallery-renderer/worker.js',route=>++workers===1?
   route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{};'}):route.continue());
 });
 await interrupted.waitForFunction(()=>window.replayRequests===1);
 const m=JSON.parse(readFileSync(paths[1]));
 await interrupted.selectOption('#seed',String(m.plan.seeds[1]));await ready(interrupted);
 assert.ok(workers>=2);assert.equal(await interrupted.evaluate(()=>window.replayRequests),2);
 const ids=await shown(interrupted);assert.equal(ids[0],ids[1]); // One replay for two identical panels.
 await interrupted.locator('#play').click();await interrupted.waitForTimeout(150);await interrupted.locator('#play').click();
 await seek(interrupted,2);assert.equal(await interrupted.evaluate(()=>window.replayRequests),2);
 await interrupted.selectOption('#seed',String(m.plan.seeds[1]));await ready(interrupted);
 assert.equal(await interrupted.evaluate(()=>window.replayRequests),2);await interrupted.close();
 rows.push({cancelsRunningReplay:true,deduplicatesIdenticalPanels:true,noPhysicsOnPlayOrScrub:true,reusesVerifiedReplay:true});
 // Native replay and artwork failures are also retryable without reloading the page.
 for(const resource of ['artwork','worker']){
  let requests=0;
  const page=await pageFor(paths[0],async p=>{
   const pattern=resource==='artwork'?'**/bosh-sprite.svg':'**/motion-gallery-renderer/worker.js';
   await p.route(pattern,async route=>{
    if(++requests===1)return resource==='artwork'?route.fulfill({status:503,body:'Injected artwork outage'}):route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{throw new Error("Injected replay failure")};'});
    await route.continue();
   });
  });
  await failure(page);
  await page.locator('#retry').click();await ready(page);
  assert.ok(requests>=2,resource);await page.close();rows.push({resource,retriesWithoutReload:true});
 }
 assert.deepEqual(errors,[]);
 mkdirSync(dirname(out),{recursive:true});
 const result={schema:'line.gallery-interaction-checks.v1',rows,errors};
 const body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',hash(body)+'\n');console.log(result);
}finally{await browser.close();}
