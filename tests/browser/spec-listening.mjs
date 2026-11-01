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
 await route.fulfill({json:{notes:[...notes.values()],note:body?.note,notesPath:'test-only'}});
});
const songTime=()=>page.locator('#time-now').textContent().then(s=>{const [m,t]=s.split(':').map(Number);return m*60+t;});
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
 const count=notes.size;await page.locator('#note-text').focus();await page.keyboard.type('vim');check(notes.size===count,'typing is not a shortcut');await page.locator('#note-text').fill('');await page.waitForTimeout(500);
 await page.reload();await ready();check(await page.locator('#notes-list li').count()===notes.size,'marks survive reload');
 await page.setViewportSize({width:390,height:844});check(await page.locator('[data-quick-mark="voice"]').isVisible(),'touch mark control available');
 check(errors.length===0,errors.join('\n'));console.log('PASS: speed, live/paused marking, typing, saved notes and touch controls');
}finally{await browser.close();}
