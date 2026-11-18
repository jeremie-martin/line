/** Run against a local review server: node tests/browser/spec-changes.mjs [URL] [spec with a note on what changed]
 *   [spec of a song with two readings] [its other reading] [directory for screenshots]
 * What changed in a reading (the author's note in productions/<song>/revisions.json: the header's control, its panel, the
 * changes lane) and his words on a reading by version (each reading its own; earlier ones quoted, the field for new ones).
 * Reads the server's files; his words are intercepted (kept in this script), so this check cannot change them. */
import {chromium} from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:8767';
const changed = process.argv[3] ?? 'productions/short_luna_bala_slowed/spec.ts';
const [main, other] = [process.argv[4] ?? 'productions/short_valhalla/spec.ts', process.argv[5] ?? 'productions/short_valhalla/variants/march.ts'];
const shots = process.argv[6];
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const context = await browser.newContext();
const check = (ok, why) => {if (!ok) throw Error(why);};
const errors = [], posts = [];
const seconds = (s) => {const [m, t] = s.split(':').map(Number); return m * 60 + t;};
await context.route('**/api/spec-notes**', route => route.request().method() === 'POST' ? route.fulfill({json: {notes: []}}) : route.fallback());
// `crowd`: words left on three earlier versions of the other reading, long ones, to see that they fit
let crowd = false;
const long = 'The voice should lead here, and the drums after it; the snare hits are too even and the big hit at the drop is weak, ';
await context.route('**/api/spec-review', async route => {
  if (route.request().method() !== 'POST') {
    if (!crowd) return route.fallback();
    const listing = await (await context.request.get(base + '/api/spec-review')).json();
    return route.fulfill({json: {...listing, readings: listing.readings.map(r => r.path !== other ? r
      : {...r, earlierNotes: [1, 2, 3].map(i => ({note: long.repeat(i), at: `2026-11-1${i}T10:00:00.000Z`, sha256: String(i)}))})}});
  }
  const body = route.request().postDataJSON(), listing = await (await context.request.get(base + '/api/spec-review')).json();
  posts.push(body);
  return route.fulfill({json: {reading: {...listing.readings.find(r => r.path === body.spec), ...body}}});
});
const listing = await (await context.request.get(base + '/api/spec-review')).json();
const reading = (path) => listing.readings.find(r => r.path === path);
const revision = reading(changed).revisions.filter(r => r.current).at(-1);
check(revision?.points?.length >= 2, `${changed} needs a note on its present version with points`);
try {
  for (const [width, height] of [[1920, 1080], [1440, 900]]) {
    const page = await context.newPage();
    await page.setViewportSize({width, height});
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
    const open = async (spec) => {
      await page.goto(`${base}/spec-dashboard/?spec=${spec}`);
      await page.waitForFunction(() => !document.querySelector('#spec-subtitle').textContent.startsWith('Loading') && document.querySelector('#timeline').children.length > 0);
    };
    const fits = () => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth
      && document.querySelector('.inspector').scrollHeight <= document.querySelector('.inspector').clientHeight);

    // the note on this version: the control, its panel, a point selecting its range
    await open(changed);
    check(await page.locator('#changes-toggle').isVisible(), 'What changed shows when this version has a note');
    check(await page.locator('#changes-toggle').evaluate(e => e.classList.contains('fresh')), 'and stands out');
    await page.locator('#changes-toggle').click();
    const panel = page.locator('#changes-panel');
    check(await panel.isVisible(), 'the control opens its panel');
    check((await panel.locator('.change').first().textContent()).includes(revision.summary.slice(0, 40)), 'the panel shows the summary');
    check(await panel.locator('.change').first().locator('.change-points li').count() === revision.points.length, 'and its points');
    const earlier = reading(changed).revisions.length - 1;
    if (earlier) check(await panel.locator('details.change-earlier .change').count() === earlier && !(await panel.locator('details.change-earlier').evaluate(e => e.open)),
      'earlier notes are under it, collapsed');
    check(await fits(), `${width}×${height}: the page fits with the panel open`);
    if (width === 1920 && shots) await page.screenshot({path: `${shots}/what-changed-1920.png`});
    const range = revision.points.find(p => p.to != null), moment = revision.points.find(p => p.to == null);
    await panel.locator(`button[data-from="${range.from}"]`).first().click();
    check(await panel.isHidden(), 'a point closes the panel');
    const [t0, t1] = (await page.locator('#range-length').textContent()).split(' · ')[0].split('–').map(seconds);
    check(Math.abs(t0 - range.from) < 0.011 && Math.abs(t1 - range.to) < 0.011, `a range point selects it: ${t0}–${t1}`);

    // the changes lane: one mark a point, words on hover, a click selecting its place
    await page.keyboard.press('Escape');
    const marks = page.locator('.svg-change');
    check(await marks.count() === revision.points.length, 'the changes lane draws every point');
    const index = revision.points.indexOf(moment ?? range), box = await marks.nth(index).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    check(await page.locator('#note-card').isVisible() && (await page.locator('#note-card').textContent()).includes((moment ?? range).text.slice(0, 30)), 'hovering a change shows its words');
    if (width === 1920 && shots) await page.screenshot({path: `${shots}/changes-lane-1920.png`});
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    if (moment) check(Math.abs(seconds(await page.locator('#time-now').textContent()) - moment.from) < 0.011, 'a click on a moment puts the cursor there');
    check(await page.locator('#notes-list li').evaluateAll(lis => lis.every(li => !li.textContent.includes('changed'))), 'changes are not listed among his notes');

    // a reading without a note shows nothing
    await open(main);
    check(await page.locator('#changes').isHidden() && await page.locator('.svg-change').count() === 0, 'a reading without a note on what changed shows nothing');

    // his words: each reading its own; words on an earlier version quoted above an empty field
    const words = async (path) => {
      const r = reading(path), quotes = await page.locator('#earlier-words li').allTextContents();
      check(await page.locator('#reading-note').inputValue() === r.note, `${path}: the field holds its words on this version`);
      check(quotes.length === r.earlierNotes.length && r.earlierNotes.every((w, i) => quotes[i].startsWith('Earlier, ') && quotes[i].includes(w.note.trim().slice(0, 30))),
        `${path}: its earlier words are quoted (${quotes.length})`);
      return quotes;
    };
    const mainQuotes = await words(main);
    await page.locator('#spec-picker').click();
    await page.locator(`#picker-list .reading[data-path="${other}"]`).click();
    await page.waitForFunction(() => !document.querySelector('#spec-subtitle').textContent.startsWith('Loading'));
    const otherQuotes = await words(other);
    check(mainQuotes.join() !== otherQuotes.join() || !mainQuotes.length, 'the two readings show their own words');
    check(await fits(), `${width}×${height}: the page fits with earlier words`);
    if (width === 1920 && shots) await page.locator('.inspector').screenshot({path: `${shots}/earlier-words-1920.png`});
    if (width === 1920) {
      await page.locator('#reading-note').fill('new words on this version');
      await page.locator('#timeline').focus();
      await page.waitForFunction(() => document.querySelector('#reading-note-state').textContent.startsWith('Saved'));
      check(posts.at(-1).spec === other && posts.at(-1).note === 'new words on this version', 'new words save on the reading');
      check(await page.locator('#earlier-words li').count() === otherQuotes.length, 'the earlier words stay quoted');
    }
    crowd = true;
    await open(other);
    check(await page.locator('#earlier-words li').count() === 3 && await fits(), `${width}×${height}: three long earlier words fit`);
    if (width === 1920 && shots) await page.locator('.inspector').screenshot({path: `${shots}/earlier-words-crowded-1920.png`});
    crowd = false;
    console.log(`${width}×${height}: what changed and his words by version work`);
    await page.close();
  }
  check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
} finally {
  await browser.close();
}
