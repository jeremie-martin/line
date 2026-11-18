/** Run against a local review server: node tests/browser/spec-listening.mjs [URL].
 * Notes are intercepted, so this check cannot change the owner's annotations. */
import {chromium} from 'playwright';
const base=process.argv[2]??'http://10.77.77.1:8770';
const browser=await chromium.launch(), page=await browser.newPage();
const check=(ok,why)=>{if(!ok)throw Error(why);};
const notes=new Map(), errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/spec-notes**',async route=>{
 const body=route.request().method()==='POST'?route.request().postDataJSON():null;
 if(body?.note)notes.set(body.note.id,body.note);
 const now=n=>n&&{...n,current:true};  // written on the reading as it stands
 await route.fulfill({json:{notes:[...notes.values()].map(now),note:now(body?.note),notesPath:'test-only'}});
});
// Every click oscillator, its start time, and whether it was cut short (stop() with no time).
await page.addInitScript(()=>{const oscs=window.__oscs=[],{start,stop}=OscillatorNode.prototype;
 OscillatorNode.prototype.start=function(at=0){this.at=at;oscs.push(this);return start.call(this,at);};
 OscillatorNode.prototype.stop=function(at){if(at===undefined)this.cut=true;return stop.call(this,at);};});
const songTime=()=>page.locator('#time-now').textContent().then(s=>{const [m,t]=s.split(':').map(Number);return m*60+t;});
const near=async(t,why)=>{await page.waitForTimeout(80);const now=await songTime();check(Math.abs(now-t)<.02,`${why}: ${now} vs ${t}`);};
const playLabel=()=>page.locator('#play').textContent();
const ready=()=>page.waitForFunction(()=>document.querySelector('#music-meta')?.textContent.includes('Circus'));
try{
 await page.goto(base+'/spec-dashboard/?spec=productions/circus_minimus_77s/variants/voice-led.ts');await ready();
 await page.locator('#scrub').evaluate(e=>{e.step='any';e.value=String(38/77.09);e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#timeline').focus();await page.keyboard.press('v');await page.waitForTimeout(150);
 check([...notes.values()].some(n=>Math.abs(n.t-38)<.02&&n.tags.includes('voice')),'V marks selected song time');
 await page.locator('#listening-rate').fill('0.5');await page.locator('#play').click();await page.waitForTimeout(250);
 const start=await songTime();await page.waitForTimeout(1000);const end=await songTime();
 check(end-start>.3&&end-start<.7,'half speed advances half a song second');
 await page.locator('#timeline').focus();await page.keyboard.press('i');await page.waitForTimeout(150);
 check([...notes.values()].some(n=>n.tags.includes('impact')&&n.t>38.3&&n.t<39.5),'I uses heard song time while playing');
 check(await page.locator('#play').textContent()==='Pause','mark does not interrupt playback');
 await page.locator('#listening-rate').fill('2');await page.waitForTimeout(200);const faster=await songTime();await page.waitForTimeout(500);
 check(await songTime()-faster>.75,'rate changes during playback');
 await page.locator('#play').click();const paused=await songTime();await page.locator('#timeline').focus();await page.keyboard.press('m');await page.waitForTimeout(150);
 check([...notes.values()].some(n=>n.tags.includes('mark')&&Math.abs(n.t-paused)<.03),'paused mark does not use a stale selected anchor');
 await page.keyboard.press('s');await page.waitForTimeout(150);
 check([...notes.values()].some(n=>n.tags.includes('strong')&&!n.tags.includes('mark')&&Math.abs(n.t-paused)<.03),'S makes the mark there the strong one');
 check(await page.locator('[data-note-tag="strong"]').count()===1,'a strong mark is drawn as one');
 const count=notes.size;await page.locator('#note-text').focus();await page.keyboard.type('vim c');check(notes.size===count,'typing is not a shortcut');
 check(await page.locator('#toggle-clicks').getAttribute('aria-pressed')==='true','typing c does not toggle clicks');await page.locator('#note-text').fill('');await page.waitForTimeout(500);
 // Seeking keys while paused, with focus left on the scrub slider (a slider takes no text).
 await page.locator('#scrub').focus();await page.keyboard.press('Home');await near(0,'Home goes to the start');
 await page.keyboard.press('ArrowRight');await near(1,'Right seeks 1 s');
 await page.keyboard.press('Shift+ArrowRight');await near(6,'Shift+Right seeks 5 s');
 await page.keyboard.press('ArrowLeft');await near(5,'Left seeks back 1 s');
 await page.keyboard.press(',');await near(4.9,'comma steps back 0.1 s');
 await page.keyboard.press('.');await page.keyboard.press('.');await near(5.1,'period steps 0.1 s');
 await page.locator('#listening-rate-reset').click();await page.keyboard.press('>');
 check(await page.locator('#listening-rate-value').textContent()==='1.25×','> steps the speed up');await page.keyboard.press('<');
 // Space toggles playback, also with focus left on the Play button (exactly once, not twice).
 await page.keyboard.press(' ');await page.waitForTimeout(300);check(await playLabel()==='Pause','Space plays');
 await page.keyboard.press(' ');await page.waitForTimeout(100);check(await playLabel()==='Play','Space pauses');
 await page.locator('#play').click();await page.waitForTimeout(300);await page.keyboard.press(' ');await page.waitForTimeout(100);
 check(await playLabel()==='Play','Space on the focused Play button pauses once');
 // Clicks: C mid-playback silences those already scheduled, and none follow.
 await page.locator('#timeline').focus();await page.keyboard.press(' ');
 const cut=await page.evaluate(()=>new Promise(done=>{const poll=()=>{const ahead=window.__oscs.filter(o=>o.at>o.context.currentTime);
  if(!ahead.length)return requestAnimationFrame(poll);
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'c'}));done(ahead.every(o=>o.cut));};poll();}));
 check(cut,'C stops clicks already scheduled');
 check(await page.locator('#toggle-clicks').getAttribute('aria-pressed')==='false'&&(await page.locator('#toggle-clicks').textContent()).startsWith('Clicks off'),'clicks state visible');
 const started=await page.evaluate(()=>window.__oscs.length);await page.waitForTimeout(1200);
 check(await page.evaluate(()=>window.__oscs.length)===started,'no clicks while off');check(await playLabel()==='Pause','C does not stop the music');
 await page.keyboard.press(' ');
 await page.reload();await ready();check((await page.locator('#notes-marks').textContent()).includes('('+notes.size+' mark'),'marks survive reload');  // marks without words are counted, not listed
 check(await page.locator('#toggle-clicks').getAttribute('aria-pressed')==='false','clicks off survives reload');
 await page.locator('#toggle-clicks').click();check(await page.locator('#toggle-clicks').getAttribute('aria-pressed')==='true','Clicks button turns them back on');
 await page.setViewportSize({width:390,height:844});check(await page.locator('[data-quick-mark="voice"]').isVisible(),'touch mark control available');
 check(errors.length===0,errors.join("\n"));console.log("PASS: speed, live/paused marking, strong marks, typing, saved notes, touch controls, transport keys, clicks toggle");
}finally{await browser.close();}
