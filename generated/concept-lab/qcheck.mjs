// Walk the morning questions at phone size: switch every option while playing, pick one, reach the summary.
import {chromium} from 'playwright';
const b = await chromium.launch({args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']});
const errors = [];
try {
  const p = await (await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3})).newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/?q=1');
  const total = +(await (async () => {await p.waitForFunction(() => /of \d+/.test(document.getElementById('qprogress').textContent), null, {timeout: 60000}); return (await p.locator('#qprogress').textContent()).match(/of (\d+)/)[1];})());
  for (let i = 0; i < total; i++) {
    await p.waitForFunction(n => document.getElementById('qprogress').textContent.startsWith(`Question ${n}`) && !document.getElementById('status').textContent, i + 1, {timeout: 60000});
    await p.locator('#play').click(); await p.waitForTimeout(300);
    const n = await p.locator('#presets button').count();
    for (let j = 0; j < n && await p.locator('#presets').isVisible(); j++) {await p.locator('#presets button').nth(j).click(); await p.waitForTimeout(250);}
    const t = await p.locator('#time').textContent();
    if (await p.locator('#qpick').isVisible()) await p.locator('#qpick button').nth(n - 1).click();
    await p.fill('#qnote', 'note ' + (i + 1));
    // try every moment chip (some switch songs), then come back
    const mc = await p.locator('#moments button').count();
    for (let j = mc - 1; j >= 0; j--) {await p.locator('#moments button').nth(j).click(); await p.waitForFunction(() => !document.getElementById('status').textContent, null, {timeout: 60000}); await p.waitForTimeout(200);}
    if (i === 1) await p.screenshot({path: 'generated/concept-lab/q-phone.png', fullPage: true});
    console.log(await p.locator('#concept').textContent(), '|', n, 'options |', mc, 'moments | time', t, '| pick:', await p.locator('#qpicklabel').textContent());
    await p.locator('#qnext').click();
  }
  await p.waitForFunction(() => !document.getElementById('qsummary').hidden);
  console.log(await p.locator('#qsummary').inputValue());
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log('overflow', overflow); if (overflow) errors.push('horizontal overflow at 390 px'); // a layout break must fail the check, not only print
} finally {await b.close();}
if (errors.length) {console.error(errors); process.exit(1);}
