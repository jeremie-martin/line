/** Run against a local review server: node tests/browser/spec-review.mjs [URL].
 * The spec dashboard's menu and verdicts. Verdict saves are intercepted (kept in this script), so this check cannot change
 * the owner's verdicts; the listing itself is the server's. */
import {chromium} from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:8767';
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const context = await browser.newContext(), page = await context.newPage();
const check = (ok, why) => {if (!ok) throw Error(why);};
const errors = [], verdicts = new Map(), changed = new Set();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
// the check's own verdicts stand in for the owner's, which it neither shows nor changes
const overlay = r => ({...r, verdict: verdicts.get(r.path) ?? null, changed: changed.has(r.path)});
await page.route('**/api/spec-review', async route => {
  const listing = await (await context.request.get(base + '/api/spec-review')).json();
  if (route.request().method() === 'POST') {
    const {spec, verdict} = route.request().postDataJSON();
    verdict ? verdicts.set(spec, verdict) : verdicts.delete(spec); changed.delete(spec);
    return route.fulfill({json: {reading: overlay(listing.readings.find(r => r.path === spec))}});
  }
  await route.fulfill({json: {...listing, readings: listing.readings.map(overlay)}});
});
const loaded = () => page.waitForFunction(() => !document.querySelector('#spec-subtitle').textContent.startsWith('Loading'));
const spec = () => new URL(page.url()).searchParams.get('spec');
const chips = () => page.locator('#picker-list .reading').evaluateAll(es => es.map(e => e.dataset.path));
const open = async () => {if (await page.locator('#picker-panel').isHidden()) await page.locator('#spec-picker').click();};
try {
  await page.goto(base + '/spec-dashboard/'); await loaded();
  await open();
  const production = await chips(), titles = await page.locator('#picker-list .song-name b').allTextContents();
  check(production.length > 0 && production.every(p => /^productions\/short_/.test(p)), 'the menu shows the production set by default');
  check(titles.every(t => !t.startsWith('short_')), 'production songs are named by their title');
  check(spec() === production[0], 'the first production reading opens');
  check(/^\d+ of \d+ readings reviewed/.test(await page.locator('#review-summary').textContent()), 'the summary says where he stands');

  // the library, remembered in this browser; a reading opened by its address still opens
  await page.locator('[data-set="library"]').click();
  const library = await chips();
  check(library.length > 0 && library.every(p => !/^productions\/short_/.test(p)), 'the switch shows the library');
  await page.reload(); await loaded(); await open();
  check((await chips()).every(p => !/^productions\/short_/.test(p)), 'the library choice is remembered');
  await page.locator('[data-set="production"]').click();
  await page.goto(base + '/spec-dashboard/?spec=' + library[0]); await loaded();
  check(spec() === library[0] && (await page.locator('#picker-label').textContent()).length > 0, 'a library reading opens by address');
  await open();
  check((await chips())[0] === production[0], 'the menu still shows the production set');
  await page.goto(base + '/spec-dashboard/'); await loaded();
  check(spec() === production[0], 'without an address, the first production reading opens');

  // verdicts: one click or 1 2 3, the same again clears; a verdict given before a change is shown as such
  await page.locator('[data-verdict="love"]').click();
  await page.waitForFunction(() => document.querySelector('[data-verdict="love"]').classList.contains('chosen'));
  check(verdicts.get(production[0]) === 'love', 'Love is saved');
  check(await page.locator('#picker-mark').getAttribute('class') === 'mark love', 'the menu marks it');
  check((await page.locator('#review-summary').textContent()).startsWith('1 of '), 'the summary counts it');
  await page.locator('#timeline').focus();
  await page.keyboard.press('2'); await page.waitForTimeout(150);
  check(verdicts.get(production[0]) === 'good', '2 gives Good');
  await page.keyboard.press('2'); await page.waitForTimeout(150);
  check(!verdicts.has(production[0]), '2 again clears it');
  await page.keyboard.press('3'); await page.waitForTimeout(150);
  check(verdicts.get(production[0]) === 'needs-work', '3 gives Needs work');
  changed.add(production[0]);
  await page.reload(); await loaded();
  check(await page.locator('#verdict-changed').isVisible(), 'a verdict older than the spec says so');
  check(await page.locator('[data-verdict="needs-work"]').evaluate(e => e.classList.contains('was')), 'the old verdict is outlined');
  check(await page.locator('#picker-mark').getAttribute('class') === 'mark needs-work changed', 'the menu marks it as changed');
  await page.locator('[data-verdict="needs-work"]').click(); await page.waitForTimeout(150);
  check(verdicts.get(production[0]) === 'needs-work' && await page.locator('#verdict-changed').isHidden(), 'the same verdict again confirms it');

  // N, P and U move through the menu's readings
  await page.locator('#timeline').focus();
  await page.keyboard.press('n'); await loaded();
  check(spec() === production[1], 'N goes to the next reading');
  await page.keyboard.press('p'); await loaded();
  check(spec() === production[0], 'P goes back');
  verdicts.set(production[1], 'good');
  await page.reload(); await loaded(); await page.locator('#timeline').focus();
  await page.keyboard.press('u'); await loaded();
  check(spec() === production[2], 'U skips the readings with a verdict');
  await page.locator('#spec-picker').click();
  await page.locator(`#picker-list .reading[data-path="${production[0]}"]`).click(); await loaded();
  check(spec() === production[0] && await page.locator('#picker-panel').isHidden(), 'a click in the menu opens that reading');
  check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
  console.log(`spec review: ${production.length} production readings, ${library.length} in the library, verdicts and keys work`);
} finally {
  await page.unrouteAll({behavior: 'ignoreErrors'});
  await browser.close();
}
