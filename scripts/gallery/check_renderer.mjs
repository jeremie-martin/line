/** Browser checks for native gallery playback. Run npm run gallery:renderer first.
 * Usage: node scripts/gallery/check_renderer.mjs MANIFEST... --out=generated/check.json
 * Optional --mirror-origin=http://127.0.0.1:8765 checks against the full app too.
 * The dashboard must already be served; --origin overrides localhost:8767. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const args=process.argv.slice(2),arg=key=>args.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const paths=args.filter(a=>!a.startsWith('--'));
assert.ok(paths.length,'Supply at least one manifest');assert.ok(arg('out'),'Supply --out=PATH');
const origin=arg('origin')??'http://127.0.0.1:8767';
const hash=b=>createHash('sha256').update(b).digest('hex');
const studies=paths.map(path=>({path,manifest:JSON.parse(readFileSync(path))}));
for(const {path} of studies)assert.equal(hash(readFileSync(path)),readFileSync(path+'.sha256','utf8').trim());
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/motion-gallery/?data=/${paths[0]}`);
  await page.waitForFunction(()=>!document.getElementById('play').disabled);
  const rows=[];
  // Retain one worker, discard each engine after its display frames are copied.
  await page.evaluate(()=>{window.checkWorker=new Worker('/generated/motion-gallery-renderer/worker.js',{type:'module'});});
  async function replay(record){return page.evaluate(r=>new Promise((resolve,reject)=>{
    const w=window.checkWorker;w.onerror=e=>reject(new Error(e.message));w.onmessage=({data})=>resolve(data);
    w.postMessage({request:1,track:r.track,trace:r.trace});
  }),record);}
  for(const {path,manifest} of studies){
    for(const cell of manifest.cells){
      const bytes=readFileSync(resolve(dirname(path),cell.path));assert.equal(hash(bytes),cell.sha256);
      const record=JSON.parse(bytes),native=await replay(record);
      assert.equal(native.error,undefined,cell.id);assert.equal(native.frames.length,record.trace.frames.length);
      rows.push({id:cell.id,frames:native.frames.length,maxError:native.maxError,replayMs:native.replayMs});
    }
    console.log(`Native replay checked: ${path} (${manifest.cells.length})`);
  }
  const {manifest,path}=studies[0],record=JSON.parse(readFileSync(resolve(dirname(path),manifest.cells[0].path)));
  const bad=structuredClone(record);bad.trace.frames[3][0]+=1;
  assert.match((await replay(bad)).error,/Native replay differs/);
  const accelerated=structuredClone(record);accelerated.track.lines[0].type=1;
  assert.match((await replay(accelerated)).error,/normal lines only/);
  const mirrorChecks=[];
  if(arg('mirror-origin')){
    const mirror=await browser.newPage();
    await mirror.route('**/*',route=>new URL(route.request().url()).origin===arg('mirror-origin')?route.continue():route.abort());
    await mirror.goto(arg('mirror-origin'));await mirror.waitForFunction(()=>window.__lr&&window.Selectors&&window.loadTrackFromString);
    for(const method of ['arcs','paired','scattered','serpentine']){
      const cell=manifest.cells.find(c=>c.method===method);if(!cell)continue;
      const r=JSON.parse(readFileSync(resolve(dirname(path),cell.path))),native=await replay(r);
      await mirror.evaluate(async track=>{window.__lr.enterEditor();window.__lr.loadTrack(track);await window.__lr.waitForTrackLoaded(track);},r.track);
      const at=Array.from({length:Math.ceil(native.frames.length/13)},(_,i)=>i*13).flatMap(f=>[f,Math.min(f+.375,native.frames.length-1)]);
      const actual=await mirror.evaluate(at=>at.map(f=>{
        const r=window.Selectors.getSimulatorTrack().getRawRider(f);
        return {points:r.points.map(({name,pos})=>({name,pos:{x:pos.x,y:pos.y}})),framesSinceUnmount:r.framesSinceUnmount,framesSinceSledBreak:r.framesSinceSledBreak,framesSinceStringDetached:r.framesSinceStringDetached};
      }),at);
      const expected=await page.evaluate(async({frames,at})=>{
        const {riderAt}=await import('/generated/motion-gallery-renderer/view.js');return at.map(f=>riderAt(frames,f));
      },{frames:native.frames,at});
      assert.deepEqual(expected,actual);mirrorChecks.push({id:r.id,poses:at.length,exactAllPointsIncludingScarfAndState:true});
    }
    await mirror.close();
  }
  // Exercise every comparison in the primary study through the actual UI.
  let comparisons=0;
  for(const cell of manifest.cells){
    await page.evaluate(c=>{
      for(const [key,value]of Object.entries({passage:c.caseId,budget:c.budget,seed:c.seed,'right-method':c.method}))document.getElementById(key).value=String(value);
      document.getElementById('right-method').dispatchEvent(new Event('change'));
    },cell);
    await page.waitForFunction(()=>!document.getElementById('play').disabled&&document.querySelectorAll('.shape-choice').length>0);
    assert.match(await page.locator('#status').textContent(),/replay verified/);comparisons++;
  }
  await page.selectOption('#passage',manifest.plan.cases[0].id);await page.selectOption('#left-method','arcs');await page.selectOption('#right-method','paired');
  await page.waitForFunction(()=>!document.getElementById('play').disabled);
  await page.locator('#beats button').nth(1).click();const beatTime=await page.locator('#time').textContent();
  await page.selectOption('#right-method','scattered');await page.waitForFunction(()=>!document.getElementById('play').disabled);
  assert.equal(await page.locator('#time').textContent(),beatTime);
  await page.locator('#play').click();await page.waitForTimeout(600);await page.locator('#play').click();
  assert.ok(parseFloat(await page.locator('#time').textContent())>parseFloat(beatTime)+.3);
  const paused=await page.locator('#time').textContent();await page.waitForTimeout(100);assert.equal(await page.locator('#time').textContent(),paused);
  await page.selectOption('#right-method','paired');await page.waitForFunction(()=>!document.getElementById('play').disabled);
  await page.selectOption('#view','overview');await page.selectOption('#view','follow');
  const out=arg('out');mkdirSync(dirname(out),{recursive:true});
  await page.screenshot({path:out+'.desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.locator('.shape-choice[data-method=scallops]').click();
  await page.waitForFunction(()=>!document.getElementById('play').disabled);
  assert.equal(await page.locator('#right-method').inputValue(),'scallops');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const visible=await page.locator('.shape-choice[data-method=scallops]').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;});assert.ok(visible);
  await page.screenshot({path:out+'.mobile.png',fullPage:true});
  const corrupt=await browser.newPage();await corrupt.route('**/'+manifest.cells[0].path,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+' '});});
  await corrupt.goto(`${origin}/motion-gallery/?data=/${paths[0]}`);await corrupt.waitForFunction(()=>document.getElementById('status').textContent.includes('Checksum mismatch'));
  assert.equal(await corrupt.locator('#panels canvas').count(),0);
  assert.deepEqual(errors,[]);
  const identity=JSON.parse(readFileSync('generated/motion-gallery-renderer/identity.json'));
  const result={schema:'line.gallery-native-checks.v1',studies:studies.map(s=>({path:s.path,sha256:hash(readFileSync(s.path))})),renderer:identity,
    replayRuns:rows.length,maxBodyPointError:Math.max(...rows.map(r=>r.maxError)),meanReplayMs:rows.reduce((n,r)=>n+r.replayMs,0)/rows.length,maxReplayMs:Math.max(...rows.map(r=>r.replayMs)),
    mirrorChecks,uiComparisons:comparisons,rejectsReplayDrift:true,rejectsAcceleration:true,rejectsCorruptArtifact:true,preservesTimeOnStyleChange:true,playPause:true,mobileSelectionVisible:true,mobileOverflow:false,errors,rows};
  const body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',hash(body)+'\n');
  console.log({runs:rows.length,maxBodyPointError:result.maxBodyPointError,uiComparisons:comparisons,mirrorChecks});
}finally{await browser.close();}
