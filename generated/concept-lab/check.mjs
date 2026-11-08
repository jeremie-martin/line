// Phone-size live check: loads, plays muted each preset for 2 s, reports frame intervals and errors.
import {chromium} from 'playwright';
const b = await chromium.launch({args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']});
const errors = [];
try {
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3});
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/?song=los&t=18');
  await p.waitForFunction(() => document.querySelectorAll('#presets button').length > 0 && !document.getElementById('status').textContent, null, {timeout: 60000});
  const n = await p.locator('#presets button').count();
  for (let i = 0; i < n; i++) {
    await p.locator('#presets button').nth(i).click();
    await p.locator('#play').click();
    const gaps = await p.evaluate(() => new Promise(res => {const g = []; let last; const f = ts => {if (last) g.push(ts - last); last = ts; g.length < 120 ? requestAnimationFrame(f) : res(g);}; requestAnimationFrame(f);}));
    await p.locator('#play').click();
    gaps.sort((a, b) => a - b);
    console.log((await p.locator('#presets button').nth(i).textContent()).padEnd(18), 'median', gaps[60].toFixed(1), 'ms  p95', gaps[114].toFixed(1), 'ms  time', await p.locator('#time').textContent());
  }
  await p.locator('#mixtoggle').click();
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log('overflow', overflow); if (overflow) errors.push('horizontal overflow at 390 px'); // a layout break must fail the check, not only print
  await p.screenshot({path: 'generated/concept-lab/phone.png', fullPage: true});
} finally {await b.close();}
if (errors.length) {console.error(errors); process.exit(1);}
