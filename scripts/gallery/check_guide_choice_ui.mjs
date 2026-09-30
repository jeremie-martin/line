import assert from 'node:assert/strict';
/** Real browser checks for immutable preferences and the two physical branches. */
export async function checkGuideChoiceUI(page,manifest,out){
 const cells=new Map(manifest.cells.map(c=>[c.id,c]));let comparisons=0,forks=0;
 const ready=()=>page.waitForFunction(()=>document.getElementById('panels').dataset.state==='ready');
 const shown=()=>page.locator('.details a').evaluateAll(links=>links.map(a=>new URL(a.href).pathname.split('/').at(-1).slice(0,-5)));
 for(const p of manifest.portfolios){
  await page.evaluate(p=>{for(const [k,v]of Object.entries({passage:p.caseId,budget:p.budget,seed:p.seed}))document.getElementById(k).value=String(v);document.getElementById('passage').dispatchEvent(new Event('change'));},p);await ready();
  const valid=p.ids.map(id=>cells.get(id)).filter(c=>c.valid&&Number.isFinite(c.qualityRms));
  const best=valid.slice().sort((a,b)=>a.qualityRms-b.qualityRms||a.usage.guideSections-b.usage.guideSections||a.usage.guideLength-b.usage.guideLength||a.id.localeCompare(b.id))[0];
  for(const t of [0,.005,.01,.02,.04,.08]){
   await page.locator('#extra-error').fill(String(t));await page.locator('#extra-error').dispatchEvent('input');await ready();
   const selected=valid.filter(c=>c.qualityRms<=best.qualityRms+t).sort((a,b)=>a.usage.guideSections-b.usage.guideSections||a.usage.guideLength-b.usage.guideLength||a.qualityRms-b.qualityRms||a.id.localeCompare(b.id))[0];
   assert.deepEqual(await shown(),[best.id,selected.id]);comparisons++;
  }
  for(const d of p.decisions){
   await page.selectOption('#choice-fork',d.id??String(d.section));await ready();
   assert.deepEqual(await shown(),[d.single,d.guided]);assert.equal(+(await page.locator('#seek').inputValue()),d.frame/40);
   assert.match(await page.locator('#choice-explanation').textContent(),/Identical earlier linework and rider history/);forks++;
  }
 }
 const p=manifest.portfolios[0];
 await page.evaluate(p=>{for(const [k,v]of Object.entries({passage:p.caseId,budget:p.budget,seed:p.seed}))document.getElementById(k).value=String(v);document.getElementById('passage').dispatchEvent(new Event('change'));},p);await ready();
 await page.selectOption('#choice-fork','reference');await ready();
 await page.locator('#seek').fill('0');await page.locator('#seek').dispatchEvent('input');await page.locator('#inspect').check();
 await page.locator('.contact-navigation button').nth(1).click();assert.match(await page.locator('.contact-now').first().textContent(),/guide: [1-9]/);
 const before=await page.locator('#time').textContent();await page.locator('#inspect').uncheck();assert.equal(await page.locator('#time').textContent(),before);
 await page.locator('#play').click();await page.waitForTimeout(500);await page.locator('#play').click();assert.ok(parseFloat(await page.locator('#time').textContent())>parseFloat(before));
 const paused=await page.locator('#time').textContent();await page.waitForTimeout(100);assert.equal(await page.locator('#time').textContent(),paused);
 await page.locator('#extra-error').fill('0.02');await page.locator('#extra-error').dispatchEvent('input');await ready();assert.equal(await page.locator('#time').textContent(),paused);
 await page.selectOption('#view','overview');await page.screenshot({path:out+'.desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.selectOption('#choice-fork','1');await ready();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#inspect').check();await page.screenshot({path:out+'.mobile.png',fullPage:true});
 return {comparisons,forks,preferenceMatchesIndependentRanking:true,sharedPrefixSeeking:true,contactNavigation:true,preservesPlayhead:true,mobileOverflow:false};
}
