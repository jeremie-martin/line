// Reviewer walk at 390x844: per question, viewport + full-page screenshots, every option and moment chip, then Copy.
import {chromium} from 'playwright';
const D = 'generated/concept-lab/agents/final2/shots';
const b = await chromium.launch({args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']});
const errors = [];
const idle = p => p.waitForFunction(() => !document.getElementById('status').textContent, null, {timeout: 90000});
try {
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true, isMobile: true});
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: 'http://127.0.0.1:8770'});
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror ' + e.message));
  p.on('console', m => {if (m.type() === 'error') errors.push('console ' + m.text());});
  p.on('requestfailed', r => errors.push('reqfail ' + r.url()));
  p.on('response', r => {if (r.status() >= 400) errors.push(r.status() + ' ' + r.url());});
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/morning.html');
  await p.screenshot({path: `${D}/morning.png`, fullPage: true});
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/?q=1');
  for (let i = 0; i < 8; i++) {
    await p.waitForFunction(n => document.getElementById('qprogress').textContent.startsWith(`Question ${n}`), i + 1, {timeout: 90000});
    await idle(p);
    await p.waitForTimeout(400);
    await p.screenshot({path: `${D}/q${i + 1}-view.png`});
    await p.screenshot({path: `${D}/q${i + 1}-full.png`, fullPage: true});
    const info = await p.evaluate(() => ({
      ask: document.getElementById('concept').textContent, why: document.getElementById('line').textContent,
      time: document.getElementById('time').textContent, h: document.documentElement.scrollHeight,
      opts: [...document.querySelectorAll('#presets button')].map(x => x.textContent),
      moments: [...document.querySelectorAll('#moments button')].map(x => x.textContent),
      momentsTop: document.getElementById('moments').getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth > innerWidth}));
    console.log(`Q${i + 1}`, JSON.stringify({...info, whyWords: info.why.split(/\s+/).length}));
    // each option: shot of stage
    const n = info.opts.length;
    for (let j = 0; j < n; j++) {await p.locator('#presets button').nth(j).click(); await p.waitForTimeout(300);
      await p.locator('#stagewrap').screenshot({path: `${D}/q${i + 1}-opt${j}.png`});}
    // moment chips
    for (let j = 0; j < info.moments.length; j++) {
      await p.locator('#moments button').nth(j).click(); await idle(p); await p.waitForTimeout(300);
      const st = await p.evaluate(() => ({time: document.getElementById('time').textContent, ask: document.getElementById('concept').textContent, opt: document.querySelector('#presets button.on')?.textContent}));
      console.log('   moment', info.moments[j], '->', JSON.stringify(st));
      await p.locator('#stagewrap').screenshot({path: `${D}/q${i + 1}-m${j}.png`});
    }
    await p.locator('#qpick button').first().click();
    await p.locator('#qnext').click();
  }
  await p.waitForFunction(() => !document.getElementById('qsummary').hidden);
  await p.screenshot({path: `${D}/end-full.png`, fullPage: true});
  await p.locator('#qcopy').click(); await p.waitForTimeout(300);
  console.log('copy button:', await p.locator('#qcopy').textContent());
  console.log('clipboard:', JSON.stringify(await p.evaluate(() => navigator.clipboard.readText())));
} finally {await b.close();}
console.log('errors', JSON.stringify(errors, null, 1));
