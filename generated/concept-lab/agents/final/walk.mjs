import {chromium} from 'playwright';
const OUT = 'generated/concept-lab/agents/final/shots/';
const B = 'http://127.0.0.1:8770';
const b = await chromium.launch({args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']});
const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
const p = await ctx.newPage();
const log = [];
p.on('pageerror', e => log.push('pageerror ' + e.message));
p.on('console', m => {if (m.type() === 'error' || m.type() === 'warning') log.push('console ' + m.text());});
p.on('response', r => {if (r.status() >= 400) log.push('HTTP ' + r.status() + ' ' + r.url());});
await p.goto(B + '/generated/concept-lab/morning.html');
await p.screenshot({path: OUT + 'morning.png'});
await p.screenshot({path: OUT + 'morning-full.png', fullPage: true});
for (const a of await p.locator('a').all()) log.push('link ' + await a.getAttribute('href'));
// questions
await p.goto(B + '/generated/concept-lab/?q=1');
for (let i = 0; i < 7; i++) {
  await p.waitForFunction(n => document.getElementById('qprogress').textContent.startsWith(`Question ${n}`) && !document.getElementById('status').textContent, i + 1, {timeout: 90000});
  await p.waitForTimeout(800);
  await p.screenshot({path: OUT + `q${i + 1}-top.png`});
  await p.screenshot({path: OUT + `q${i + 1}-full.png`, fullPage: true});
  const n = await p.locator('#presets button').count();
  const moments = await p.locator('#moments button').allTextContents();
  log.push(`Q${i + 1} ${await p.locator('#concept').textContent()} opts=${n} time=${await p.locator('#time').textContent()} moments=${JSON.stringify(moments)}`);
  // per-option, at loop start + 1.5s, 3s: canvas capture
  for (const dt of [0, 1.5, 3]) {
    for (let j = 0; j < n; j++) {
      await p.locator('#presets button').nth(j).click();
      await p.evaluate(dt => {const s = document.getElementById('seek'); s.value = +s.value + 0; }, dt);
      await p.waitForTimeout(150);
      await p.locator('#stage').screenshot({path: OUT + `q${i + 1}-o${j}-t${dt}.png`});
    }
    // advance by playing
    if (dt < 3) {await p.locator('#play').click(); await p.waitForTimeout(1500); await p.locator('#play').click(); await p.waitForTimeout(200);}
    log.push(`  after dt ${dt} time=${await p.locator('#time').textContent()}`);
  }
  await p.locator('#qpick button').first().click();
  await p.locator('#qnext').click();
}
await p.waitForTimeout(500);
await p.screenshot({path: OUT + 'q-done.png', fullPage: true});
// films
await p.goto(B + '/motion-gallery/video-compare.html?collection=/generated/concept-lab/films.json');
await p.waitForTimeout(4000);
await p.screenshot({path: OUT + 'films.png'});
await p.screenshot({path: OUT + 'films-full.png', fullPage: true});
log.push('films vids ' + JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('video')].map(v => [v.currentSrc || v.src, v.readyState, v.error && v.error.code]))));
// free lab
await p.goto(B + '/generated/concept-lab/');
await p.waitForFunction(() => !document.getElementById('status').textContent, null, {timeout: 90000});
await p.waitForTimeout(800);
await p.screenshot({path: OUT + 'lab.png'});
await p.screenshot({path: OUT + 'lab-full.png', fullPage: true});
console.log(log.join('\n'));
await b.close();
