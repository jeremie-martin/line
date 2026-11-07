import {chromium} from 'playwright';
const b = await chromium.launch({args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']});
const errs = [];
try {
  const p = await (await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true, isMobile: true})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  const idle = () => p.waitForFunction(() => !document.getElementById('status').textContent && document.getElementById('concept').textContent, null, {timeout: 60000});
  const sample = async (ms, n=6) => {const o = []; for (let i = 0; i < n; i++) {o.push(await p.evaluate(() => [document.getElementById('seek').value, document.getElementById('play').textContent].join(' '))); await p.waitForTimeout(ms);} return o;};
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/?q=7'); await p.waitForFunction(() => document.getElementById('qprogress').textContent.startsWith('Question 7')); await idle(); await p.waitForTimeout(500);
  await p.locator('#moments button').nth(1).click(); await p.waitForTimeout(300);
  await p.locator('#play').click();
  console.log('Q7 ending loop', await sample(800, 7));
  await p.locator('#moments button').nth(2).click(); await p.waitForTimeout(100); await idle(); await p.waitForTimeout(800);
  console.log('Q7 chip Lua ending while playing', await sample(800, 6));
  await p.locator('#qprev').click(); await p.waitForTimeout(100); await idle(); await p.waitForTimeout(800);
  console.log('after Back to Q6:', await p.locator('#qprogress').textContent(), await sample(300, 2));
  await p.locator('#play').click(); await p.waitForTimeout(600); await p.locator('#presets button').nth(4).click();
  console.log('Q6 night', await sample(400, 3), await p.locator('#line').innerText());
  // switch option while on other-song chip then Next
  await p.locator('#moments button').nth(2).click(); await p.waitForTimeout(100); await idle(); await p.waitForTimeout(800);
  console.log('Q6 Burn chip, option kept?', await p.locator('#presets button.on').textContent(), await sample(400,2));
  await p.locator('#qnext').click(); await p.waitForTimeout(100); await idle(); await p.waitForTimeout(800);
  console.log('Next ->', await p.locator('#qprogress').textContent(), await p.locator('#presets button.on').textContent(), await sample(300,2));
  // page reload retains?
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/?q=3'); await p.waitForFunction(() => document.getElementById('qprogress').textContent.startsWith('Question 3')); await idle();
  await p.locator('#qpick button').nth(1).click(); await p.locator('#qpick button').last().click();
  console.log('pick none after B', await p.locator('#qpick button.on').allTextContents());
  await p.locator('#qpick button').nth(2).click();
  console.log('then C', await p.locator('#qpick button.on').allTextContents());
} finally {await b.close();}
console.log('errors', errs);
