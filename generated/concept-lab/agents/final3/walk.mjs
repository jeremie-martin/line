import {chromium} from 'playwright';
const SP = process.argv[2];
const b = await chromium.launch({args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']});
const errs = [];
try {
  const p = await (await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true, isMobile: true})).newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/morning.html'); await p.waitForTimeout(500);
  await p.screenshot({path: SP + '/phone/morning.png', fullPage: true});
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/?q=1');
  const idle = () => p.waitForFunction(() => !document.getElementById('status').textContent && document.getElementById('concept').textContent, null, {timeout: 60000});
  for (let i = 0; i < 7; i++) {
    await p.waitForFunction(n => document.getElementById('qprogress').textContent.startsWith(`Question ${n}`), i + 1, {timeout: 60000}); await idle();
    await p.waitForTimeout(600);
    const m = await p.evaluate(() => {
      const r = id => {const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)];};
      return {stage: r('stage'), play: r('play'), presets: r('presets'), moments: r('moments'), pick: r('qpick'), note: r('qnote'), next: r('qnext'), docH: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth > innerWidth, line: document.getElementById('line').innerText};
    });
    console.log('Q' + (i + 1), JSON.stringify(m));
    await p.screenshot({path: `${SP}/phone/q${i + 1}.png`, fullPage: true});
    // moment chips: click each, play 1.2 s, read time
    const mc = await p.locator('#moments button').count();
    for (let j = 0; j < mc; j++) {
      const label = await p.locator('#moments button').nth(j).textContent();
      await p.locator('#moments button').nth(j).click(); await p.waitForTimeout(100); await idle(); await p.waitForTimeout(300);
      const t0 = await p.locator('#time').textContent();
      const pr = await p.locator('#qprogress').textContent();
      console.log('   chip', label, '->', t0, '|', pr, '| playing?', await p.locator('#play').textContent());
    }
    await p.locator('#qnext').click();
  }
  await p.waitForFunction(() => !document.getElementById('qsummary').hidden);
  await p.screenshot({path: `${SP}/phone/done.png`, fullPage: true});
  console.log(await p.locator('#qsummary').inputValue());
} finally {await b.close();}
console.log('errors', errs);
