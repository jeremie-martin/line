/** Run against a local review server: node tests/browser/spec-ride.mjs [URL] [spec with a current video] [spec whose ride
 * missed a landing].
 * How the video's ride stands against the spec, on the impact lane: the Ride toggle (off by default, remembered), the
 * delivered strength under each asked one, the hover card, a missed landing's mark, the quiet line under the video, a video of
 * an earlier version (nothing per landing, and why), and the one-screen layout with the layer on at 1920×1080 and 1440×900.
 * Notes, verdicts and the reading's note are intercepted, so this check cannot change the owner's words; it never makes a video. */
import {chromium} from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:8767';
const specPath = process.argv[3] ?? 'productions/short_circus_minimus/spec.ts';
const missedPath = process.argv[4] ?? 'productions/short_amor_na_praia_46s/spec.ts';
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const context = await browser.newContext();
const check = (ok, why) => {if (!ok) throw Error(why);};
const errors = [];
await context.route('**/api/spec-notes**', route => route.request().method() === 'POST'
  ? route.fulfill({json: {notes: [], note: null, notesPath: 'test-only'}}) : route.continue());
await context.route('**/api/spec-review', route => route.request().method() === 'POST' ? route.fulfill({json: {}}) : route.continue());
await context.route('**/api/spec-video**', route => route.request().method() === 'POST' ? route.fulfill({status: 409, json: {error: 'test only'}}) : route.continue());
const open = async (page, spec) => {
  await page.goto(`${base}/spec-dashboard/?spec=${spec}`);
  await page.waitForFunction(() => !document.querySelector('#spec-subtitle').textContent.startsWith('Loading') && document.querySelector('#timeline').children.length > 0);
  await page.waitForFunction(() => document.querySelector('#video-state').textContent.trim() !== '');
  await page.waitForTimeout(300);
};
const standing = async (spec) => (await (await context.request.get(`${base}/api/spec-video?spec=${encodeURIComponent(spec)}`)).json()).ride;
try {
  const page = await context.newPage({viewport: {width: 1920, height: 1080}});
  await page.setViewportSize({width: 1920, height: 1080});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  const ride = await standing(specPath);
  check(ride?.current && ride.landings?.length, `${specPath} has a ride of its present version`);

  // off by default: no layer, but the line under the video
  await open(page, specPath);
  check(!await page.locator('#toggle-ride').isChecked(), 'Ride is off by default');
  check(await page.locator('[data-ride]').count() === 0, 'no ride marks while Ride is off');
  const line = await page.locator('#ride-state').textContent();
  check(line === `Ride (seed ${ride.seed}): ${ride.summary.landings} landings, ${ride.summary.missed} missed, strength within ${ride.summary.meanStrengthDifference.toFixed(2)} on average.`, `the ride's line: ${line}`);

  // on: one mark per landing, kept after a reload; off again, kept off
  await page.locator('#toggle-ride').check();
  const marks = await page.locator('[data-ride]').count();
  check(marks === ride.landings.length, `one ride mark per landing: ${marks} of ${ride.landings.length}`);
  await open(page, specPath);
  check(await page.locator('#toggle-ride').isChecked() && await page.locator('[data-ride]').count() === marks, 'Ride stays on after a reload');
  check(await page.locator('.svg-ride-legend').count() > 0, 'the legend states the steps');

  // hover a landing: the card says what is asked and what was delivered, as the server says
  const index = Math.floor(ride.landings.length / 2), landing = ride.landings[index];
  const dot = await page.locator(`[data-mark-kind="contactImpact"][data-index="${index}"]`).boundingBox();
  await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2 + 6);
  await page.waitForTimeout(100);
  const words = await page.locator('[data-ride-words]').textContent();
  check(words.startsWith(`asked ${landing.asked.toFixed(2)} · ${landing.delivered === null ? 'missed' : `delivered ${landing.delivered.toFixed(2)}`}`), `hover shows asked and delivered: ${words}`);
  console.log(`hover on #${index}: ${words}`);

  // the asked dots stay the primary drawing: drawn after (over) the ride's marks
  check(await page.evaluate(() => {
    const all = [...document.querySelectorAll('#timeline [data-ride], #timeline [data-mark-kind="contactImpact"]')];
    return all.findIndex(e => e.dataset.markKind) > all.findIndex(e => e.dataset.ride);
  }), 'asked dots are drawn over the ride');

  await page.locator('#toggle-ride').uncheck();
  check(await page.locator('[data-ride]').count() === 0, 'Ride off hides the layer');
  await open(page, specPath);
  check(!await page.locator('#toggle-ride').isChecked(), 'Ride stays off after a reload');
  await page.locator('#toggle-ride').check();

  // a ride that missed a landing: a mark under it, and the line says so
  const missed = await standing(missedPath);
  check(missed?.summary?.missed > 0, `${missedPath}'s ride misses a landing`);
  await open(page, missedPath);
  const missedMarks = await page.locator('[data-ride="missed"]').count();
  check(missedMarks === missed.summary.missed, `missed landings marked: ${missedMarks} of ${missed.summary.missed}`);
  check((await page.locator('#ride-state').textContent()).includes(`${missed.summary.missed} missed`), 'the line says how many were missed');
  const first = missed.landings.findIndex(l => l.delivered === null);
  const box = await page.locator(`[data-mark-kind="contactImpact"][data-index="${first}"]`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 4);
  await page.waitForTimeout(100);
  check((await page.locator('[data-ride-words]').textContent()).endsWith('· missed'), 'hover on a missed landing says missed');

  // a video of an earlier version: nothing per landing, and the reason
  await page.route('**/api/spec-video**', async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    const status = await (await route.fetch()).json();
    await route.fulfill({json: {...status, video: {...status.video, current: false},
      ride: {current: false, why: 'The video is of an earlier version of the spec: its landings are not this version\'s.'}}});
  });
  await open(page, specPath);
  check(await page.locator('[data-ride]').count() === 0, 'no ride marks for a video of an earlier version');
  const why = await page.locator('#ride-state').textContent();
  check(/earlier version/.test(why), `it says why: ${why}`);
  check(/earlier version/.test(await page.locator('#toggle-ride-label').getAttribute('title')), 'the toggle says why too');
  await page.unroute('**/api/spec-video**');
  await page.close();

  // one screen with the layer on
  for (const [width, height] of [[1920, 1080], [1440, 900]]) {
    const p = await context.newPage({viewport: {width, height}});
    await p.setViewportSize({width, height});
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
    await open(p, specPath);
    const m = await p.evaluate(() => ({scrollH: document.documentElement.scrollHeight, scrollW: document.documentElement.scrollWidth, innerH: innerHeight, innerW: innerWidth,
      sideScroll: document.querySelector('.inspector').scrollHeight - document.querySelector('.inspector').clientHeight,
      marks: document.querySelectorAll('[data-ride]').length}));
    check(m.marks > 0, `${width}×${height}: the layer shows`);
    check(m.scrollH <= m.innerH && m.scrollW <= m.innerW, `${width}×${height}: the page fits (${m.scrollW}×${m.scrollH})`);
    check(m.sideScroll <= 0, `${width}×${height}: the side column fits`);
    console.log(`${width}×${height}: fits with the ride layer on`);
    await p.close();
  }
  check(errors.length === 0, `console errors: ${errors.join('\n')}`);
  console.log('spec ride: ok');
} finally {
  await browser.close();
}
