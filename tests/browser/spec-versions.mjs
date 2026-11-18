/** Run against a local review server: node tests/browser/spec-versions.mjs [URL] [spec of a song with several readings].
 * The readings of one song in the header: one button each, the current one marked; a click or ] and [ go to another
 * reading at the same moment and view, and a song with one reading shows none. Writes are intercepted. */
import {chromium} from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:8767';
const specPath = process.argv[3] ?? 'productions/short_circus_minimus/spec.ts';
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const context = await browser.newContext();
const check = (ok, why) => {if (!ok) throw Error(why);};
const errors = [];
for (const api of ['spec-notes**', 'spec-review', 'spec-video**']) await context.route(`**/api/${api}`, route => route.request().method() === 'POST'
  ? route.fulfill({status: 409, json: {error: 'test only'}}) : route.continue());
const loaded = page => page.waitForFunction(() => !document.querySelector('#spec-subtitle').textContent.startsWith('Loading') && document.querySelector('#timeline').children.length > 0);
try {
  const page = await context.newPage({viewport: {width: 1920, height: 1080}});
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/spec-dashboard/?spec=${specPath}`); await loaded(page);
  const names = await page.$$eval('#versions button', bs => bs.map(b => b.textContent.trim()));
  check(names.length >= 2 && names[0] === 'main', `the song's readings are in the header: ${names}`);
  check(await page.$eval('#versions button.on', b => b.textContent.trim()) === 'main', 'the current reading is marked');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const clock = () => page.$eval('#time-now', e => e.textContent);
  const before = await clock();
  await page.keyboard.press(']'); await page.waitForFunction(p => new URLSearchParams(location.search).get('spec') !== p, specPath); await loaded(page);
  check(await page.$eval('#versions button.on', b => b.textContent.trim()) === names[1], '] goes to the next reading of the song');
  check(await clock() === before, `the moment is kept: ${before} → ${await clock()}`);
  await page.click('#versions button:first-child'); await page.waitForFunction(p => new URLSearchParams(location.search).get('spec') === p, specPath); await loaded(page);
  check(await clock() === before, 'a click keeps the moment too');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the header still fits');
  check(!errors.length, `page errors: ${errors}`);
  console.log(`spec versions: ${names.join(', ')}; switched at ${before || 'the same moment'}`);
} finally {await browser.close();}
