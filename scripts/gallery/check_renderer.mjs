/** Browser checks for native gallery playback. Run npm run gallery:renderer first.
 * Usage: node scripts/gallery/check_renderer.mjs MANIFEST... --out=generated/check.json
 * Optional --mirror-origin=http://127.0.0.1:8765 checks against the full app too.
 * --mirror-cases=all checks one seed of every case/method instead of four examples.
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
const reference=arg('contacts')?JSON.parse(readFileSync(arg('contacts'))):null;
if(reference)assert.equal(hash(readFileSync(arg('contacts'))),readFileSync(arg('contacts')+'.sha256','utf8').trim());
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/motion-gallery/?data=/${paths[0]}`);
  await page.waitForFunction(()=>document.getElementById('panels').dataset.state==='ready');
  const rows=[];
  // Retain one worker, discard each engine after its display frames are copied.
  await page.evaluate(()=>{window.checkWorker=new Worker('/generated/motion-gallery-renderer/worker.js',{type:'module'});});
  async function replay(record,includeFrames=false){return page.evaluate(({r,includeFrames})=>new Promise((resolve,reject)=>{
    const w=window.checkWorker;w.onerror=e=>reject(new Error(e.message));w.onmessage=({data})=>{const {frames,...rest}=data;resolve({...rest,frameCount:frames?.length,...(includeFrames?{frames}:{})});};
    w.postMessage({request:1,track:r.track,trace:r.trace});
  }),{r:record,includeFrames});}
  for(const {path,manifest} of studies){
    for(const cell of manifest.cells){
      const bytes=readFileSync(resolve(dirname(path),cell.path));assert.equal(hash(bytes),cell.sha256);
      const record=JSON.parse(bytes),native=await replay(record);
      assert.equal(native.error,undefined,cell.id);assert.equal(native.frameCount,record.trace.frames.length);
      if(reference){const expected=reference.rows.find(r=>r.id===cell.id);assert.ok(expected);assert.equal(expected.artifactSha256,cell.sha256);assert.equal(hash(JSON.stringify(native.contacts.map(ids=>[...new Set(ids)].sort((a,b)=>a-b)))),expected.contactsSha256,`collision mismatch: ${cell.id}`);}
      rows.push({id:cell.id,frames:native.frameCount,maxError:native.maxError,replayMs:native.replayMs});
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
    const mirrorCells=arg('mirror-cases')==='all'
      ?manifest.cells.filter((c,i,cells)=>cells.findIndex(other=>other.caseId===c.caseId&&other.method===c.method)===i)
      :manifest.plan.methods.slice(0,4).map(method=>manifest.cells.find(c=>c.method===method)).filter(Boolean);
    for(const cell of mirrorCells){
      const r=JSON.parse(readFileSync(resolve(dirname(path),cell.path))),native=await replay(r,true);
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
  const out=arg('out');mkdirSync(dirname(out),{recursive:true});
  let comparisons=0,guideChoiceControls=null;
  if(manifest.plan.kind==='guide-choice'){
    const {checkGuideChoiceUI}=await import('./check_guide_choice_ui.mjs');
    guideChoiceControls=await checkGuideChoiceUI(page,manifest,out);comparisons=guideChoiceControls.comparisons;
  }else{
  // Exercise every comparison in the primary study through the actual UI.
  for(const cell of manifest.cells){
    await page.evaluate(c=>{
      for(const [key,value]of Object.entries({passage:c.caseId,budget:c.budget,seed:c.seed,'right-method':c.method}))document.getElementById(key).value=String(value);
      document.getElementById('right-method').dispatchEvent(new Event('change'));
    },cell);
    await page.waitForFunction(()=>document.getElementById('panels').dataset.state==='ready'&&document.querySelectorAll('.shape-choice').length>0);
    assert.match(await page.locator('#status').textContent(),/replay verified/);comparisons++;
  }
  const left=manifest.plan.methods.includes('arcs')?'arcs':manifest.plan.methods[0];
  const right=manifest.plan.methods.includes('paired')?'paired':manifest.plan.methods[1]??left;
  await page.selectOption('#passage',manifest.plan.cases[0].id);await page.selectOption('#left-method',left);await page.selectOption('#right-method',right);
  await page.waitForFunction(()=>document.getElementById('panels').dataset.state==='ready');
  await page.locator('#beats button').nth(1).click();const beatTime=await page.locator('#time').textContent();
  const alternate=manifest.plan.methods.find(m=>m!==right)??right;
  await page.selectOption('#right-method',alternate);await page.waitForFunction(()=>document.getElementById('panels').dataset.state==='ready');
  assert.equal(await page.locator('#time').textContent(),beatTime);
  await page.locator('#play').click();await page.waitForTimeout(600);await page.locator('#play').click();
  assert.ok(parseFloat(await page.locator('#time').textContent())>parseFloat(beatTime)+.3);
  const paused=await page.locator('#time').textContent();await page.waitForTimeout(100);assert.equal(await page.locator('#time').textContent(),paused);
  await page.selectOption('#right-method',right);await page.waitForFunction(()=>document.getElementById('panels').dataset.state==='ready');
  await page.selectOption('#view','overview');await page.selectOption('#view','follow');
  assert.equal(await page.locator('#inspect').isChecked(),false);
  await page.locator('#seek').fill('0');await page.locator('#seek').dispatchEvent('input');
  await page.locator('#inspect').check();assert.ok(await page.locator('.contact-inspection').first().isVisible());
  await page.locator('.contact-navigation button').nth(1).click();
  assert.match(await page.locator('.contact-now').first().textContent(),/guide: [1-9]/);
  assert.ok(parseFloat(await page.locator('#seek').inputValue())>0);
  const selectedId=await page.locator('.details a').first().evaluate(a=>new URL(a.href).pathname.split('/').at(-1).slice(0,-5));
  if(reference)assert.equal(+(await page.locator('#seek').inputValue()),reference.rows.find(r=>r.id===selectedId).firstGuideContactFrame/40);
  await page.locator('#inspect').uncheck();assert.equal(await page.locator('.contact-inspection').first().isVisible(),false);
  await page.locator('#inspect').check();
  await page.screenshot({path:out+'.desktop.png',fullPage:true});
  const mobileMethod=manifest.plan.methods.at(-1);
  await page.setViewportSize({width:390,height:844});await page.locator(`.shape-choice[data-method=${mobileMethod}]`).click();
  await page.waitForFunction(()=>document.getElementById('panels').dataset.state==='ready');
  assert.equal(await page.locator('#right-method').inputValue(),mobileMethod);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const visible=await page.locator(`.shape-choice[data-method=${mobileMethod}]`).evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;});assert.ok(visible);
  await page.screenshot({path:out+'.mobile.png',fullPage:true});
  }
  const corruptCell=manifest.plan.kind==='guide-choice'?manifest.cells.find(c=>c.id===manifest.portfolios[0].preferences[0].best):manifest.cells[0];
  const corrupt=await browser.newPage();await corrupt.route('**/'+corruptCell.path,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+' '});});
  await corrupt.goto(`${origin}/motion-gallery/?data=/${paths[0]}`);await corrupt.waitForFunction(()=>document.getElementById('status').textContent.includes('Checksum mismatch'));
  assert.equal(await corrupt.locator('#panels canvas').count(),0);
  assert.deepEqual(errors,[]);
  const identity=JSON.parse(readFileSync('generated/motion-gallery-renderer/identity.json'));
  const result={schema:'line.gallery-native-checks.v1',studies:studies.map(s=>({path:s.path,sha256:hash(readFileSync(s.path))})),renderer:identity,
    replayRuns:rows.length,maxBodyPointError:Math.max(...rows.map(r=>r.maxError)),meanReplayMs:rows.reduce((n,r)=>n+r.replayMs,0)/rows.length,maxReplayMs:Math.max(...rows.map(r=>r.replayMs)),
    mirrorChecks,contactReference:reference?{path:arg('contacts'),sha256:hash(readFileSync(arg('contacts'))),matched:rows.length}:null,contactToggleAndNavigation:true,guideChoiceControls,uiComparisons:comparisons,rejectsReplayDrift:true,rejectsAcceleration:true,rejectsCorruptArtifact:true,...(!guideChoiceControls?{preservesTimeOnStyleChange:true,mobileSelectionVisible:true}:{}),playPause:true,mobileOverflow:false,errors,rows};
  const body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',hash(body)+'\n');
  console.log({runs:rows.length,maxBodyPointError:result.maxBodyPointError,uiComparisons:comparisons,mirrorChecks});
}finally{await browser.close();}
