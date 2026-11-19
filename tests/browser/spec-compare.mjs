/** Run against a local review server: node tests/browser/spec-compare.mjs [URL] [song] [screenshot.png].
 * The comparison page: the readings of a song as buttons, each with its film loaded; a digit changes the film shown and
 * the spec drawn without moving the clock; the films follow the sound; best, verdict and words are sent (intercepted
 * here, so the owner's records are not touched); one screen at 1920×1080 and 1440×900. */
import {chromium} from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:8767', song = process.argv[3] ?? 'short_believer', shot = process.argv[4];
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--autoplay-policy=no-user-gesture-required']});
const context = await browser.newContext();
const check = (ok, why) => {if (!ok) throw Error(why);};
const errors = [], posts = [];
await context.route('**/api/spec-review', async route => {
  if (route.request().method() !== 'POST') return route.continue();
  const body = route.request().postDataJSON(); posts.push(body);
  return route.fulfill({json: 'pick' in body ? {picks: body.pick ? {[body.spec.split('/').slice(0, 2).join('/')]: body.spec} : {}} : {reading: {path: body.spec, ...('verdict' in body ? {verdict: body.verdict, changed: false} : {note: body.note})}}});
});
try {
  for (const [width, height] of [[1920, 1080], [1440, 900]]) {
    const page = await context.newPage(); await page.setViewportSize({width, height});
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/spec-compare/?song=${song}`);
    await page.waitForFunction(() => document.querySelectorAll('#stage video').length >= 2 && [...document.querySelectorAll('#stage video')].every(v => v.readyState >= 2), null, {timeout: 60000});
    const names = await page.$$eval('#versions button', bs => bs.map(b => b.textContent.replace(/^\d/, '').replace('★', '').trim()));
    check(names[0] === 'main' && names.length >= 4, `readings: ${names}`);
    check(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), `one screen at ${width}×${height}`);
    if (width !== 1920) {await page.close(); continue;}
    await page.keyboard.press('Space'); await page.waitForTimeout(2500);
    const before = await page.evaluate(() => document.getElementById('audio').currentTime);
    check(before > 1.5, `the sound plays: ${before}`);
    await page.keyboard.press('3');
    const state = await page.evaluate(() => ({on: [...document.querySelectorAll('#stage video')].findIndex(v => v.classList.contains('on')), t: document.getElementById('audio').currentTime,
      v: document.querySelector('#stage video.on').currentTime, playing: !document.querySelector('#stage video.on').paused, name: document.querySelector('#versions button.on').textContent}));
    check(state.on === 2 && state.name.includes(names[2]), `3 shows the third reading: ${JSON.stringify(state)}`);
    check(state.t - before < 0.5 && Math.abs(state.v - state.t) < 0.3 && state.playing, `the change is at the same instant, the film already there: ${JSON.stringify(state)} from ${before}`);
    check(/\w/.test(await page.textContent('#intention')), 'the intention is shown');
    await page.keyboard.press('b'); await page.keyboard.press('l');
    await page.waitForFunction(() => document.getElementById('best').classList.contains('on') && document.querySelector('#verdict button.on'));
    await page.keyboard.press('c'); await page.keyboard.type('the float here'); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Saved');
    check(posts.some(p => p.pick === true) && posts.some(p => p.verdict === 'love') && posts.some(p => p.note === 'the float here'), `best, verdict and words are sent: ${JSON.stringify(posts)}`);
    await page.keyboard.press('m'); await page.keyboard.press('Space');
    check(await page.evaluate(() => document.getElementById('ghost').checked), 'M puts the approved reading behind');
    await page.waitForTimeout(300);
    if (shot) await page.screenshot({path: shot});
    await page.close();
  }
  check(!errors.length, `page errors: ${errors}`);
  console.log('spec compare: readings switched at the same instant; best, verdict, words; one screen at 1920×1080 and 1440×900');
} finally {await browser.close();}
