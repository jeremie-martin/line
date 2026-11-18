/** Run against a local review server: node tests/browser/spec-layout.mjs [URL] [spec].
 * The spec dashboard as one screen (no page scroll at 1920×1080 and 1440×900, the timeline spanning its panel, the
 * video whole), and its range: drag to select, drag an edge, loop it (L), note it, Esc. Notes, verdicts and the
 * reading's note are intercepted (kept in this script), so this check cannot change the owner's words. */
import {chromium} from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:8767';
const specPath = process.argv[3] ?? 'productions/short_montagem_tomada_slowed/spec.ts';
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const context = await browser.newContext();
const check = (ok, why) => {if (!ok) throw Error(why);};
const errors = [], notes = new Map(), posts = [];
const songTime = (page) => page.locator('#time-now').textContent().then(s => {const [m, t] = s.split(':').map(Number); return m * 60 + t;});
const rangeOf = (page) => page.locator('#range-length').textContent().then(s => s.split(' · ')[0].split('–').map(x => {const [m, t] = x.split(':').map(Number); return m * 60 + t;}));
await context.route('**/api/spec-notes**', async route => {
  const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
  if (body?.note) notes.set(body.note.id, body.note);
  if (body?.note === null) notes.delete(body.id);
  await route.fulfill({json: {notes: [...notes.values()], note: body?.note ?? null, notesPath: 'test-only'}});
});
await context.route('**/api/spec-review', async route => {
  const listing = await (await context.request.get(base + '/api/spec-review')).json();
  if (route.request().method() !== 'POST') return route.fulfill({json: listing});
  const body = route.request().postDataJSON(); posts.push(body);
  const reading = listing.readings.find(r => r.path === body.spec);
  return route.fulfill({json: {reading: {...reading, ...('verdict' in body ? {verdict: body.verdict, changed: false} : {}), ...('note' in body ? {note: body.note} : {})}}});
});
try {
  for (const [width, height] of [[1920, 1080], [1440, 900]]) {
    const page = await context.newPage({viewport: {width, height}});
    await page.setViewportSize({width, height});
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
    await page.goto(`${base}/spec-dashboard/?spec=${specPath}`);
    await page.waitForFunction(() => !document.querySelector('#spec-subtitle').textContent.startsWith('Loading') && document.querySelector('#timeline').children.length > 0);
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const box = (e) => e.getBoundingClientRect();
      const svg = box(document.querySelector('#timeline')), wrap = box(document.querySelector('#timeline-wrap'));
      const side = document.querySelector('.inspector'), video = document.querySelector('#video-player');
      return {scrollH: document.documentElement.scrollHeight, scrollW: document.documentElement.scrollWidth, innerH: innerHeight, innerW: innerWidth,
        svg: [svg.left, svg.right], wrap: [wrap.left, wrap.right], sideScroll: side.scrollHeight - side.clientHeight,
        video: video.hidden ? null : [box(video).top, box(video).bottom, box(video).left, box(video).right, video.videoWidth, video.videoHeight],
        agent: document.body.textContent.toLowerCase().includes('agent context')};
    });
    check(m.scrollH <= m.innerH && m.scrollW <= m.innerW, `${width}×${height}: the page fits (${m.scrollW}×${m.scrollH})`);
    check(Math.abs(m.svg[0] - m.wrap[0]) <= 1 && Math.abs(m.svg[1] - m.wrap[1]) <= 1, `${width}×${height}: the timeline spans its panel ${m.svg} vs ${m.wrap}`);
    check(m.sideScroll <= 0, `${width}×${height}: the side column fits`);
    if (m.video) check(m.video[0] >= 0 && m.video[1] <= m.innerH && m.video[3] <= m.innerW, `${width}×${height}: the video is whole on screen`);
    check(!m.agent, 'no agent context');
    console.log(`${width}×${height}: fits; timeline ${Math.round(m.svg[1] - m.svg[0])} px wide; video ${m.video ? `${Math.round(m.video[3] - m.video[2])}×${Math.round(m.video[1] - m.video[0])}` : 'none'}`);
    if (width !== 1920) {await page.close(); continue;}

    // a range: press and drag across the spectrogram
    const svg = await page.locator('#timeline').boundingBox();
    const y = svg.y + 120, x0 = svg.x + 72 + (svg.width - 86) * 0.30, x1 = svg.x + 72 + (svg.width - 86) * 0.36;
    await page.mouse.move(x0, y); await page.mouse.down(); await page.mouse.move(x0 + 40, y, {steps: 4}); await page.mouse.move(x1, y, {steps: 4}); await page.mouse.up();
    check(await page.locator('#range-bar').isVisible(), 'a drag selects a range and shows its bar');
    const [a0, a1] = await rangeOf(page);
    check(a1 - a0 > 1, `the range covers the drag: ${a0}–${a1}`);
    check(await page.locator('#scope-tabs .active').textContent() === 'Range', 'the note editor takes the range');
    // its end edge, dragged further right
    const edge = await page.locator('[data-range-edge="t1"]').boundingBox();
    await page.mouse.move(edge.x + edge.width / 2, y); await page.mouse.down(); await page.mouse.move(edge.x + 80, y, {steps: 5}); await page.mouse.up();
    const [b0, b1] = await rangeOf(page);
    check(Math.abs(b0 - a0) < 1e-6 && b1 > a1 + 0.5, `the end edge moves alone: ${a0}–${a1} → ${b0}–${b1}`);
    // a drag starting on a contact's impact dot also selects
    const dot = await page.locator('[data-mark-kind="contactImpact"]').nth(40).boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2); await page.mouse.down();
    await page.mouse.move(dot.x + 60, dot.y + dot.height / 2, {steps: 5}); await page.mouse.up();
    const [c0] = await rangeOf(page);
    check(c0 !== b0, 'a drag from a contact selects a new range');
    // a click outside clears it and places the cursor; Esc clears a range
    await page.mouse.click(svg.x + 72 + (svg.width - 86) * 0.8, y);
    check(await page.locator('#range-bar').isHidden() && await page.locator('.svg-selection').count() === 0, 'a click outside the range clears it');
    await page.mouse.move(x0, y); await page.mouse.down(); await page.mouse.move(x1, y, {steps: 6}); await page.mouse.up();
    await page.keyboard.press('Escape');
    check(await page.locator('#range-bar').isHidden(), 'Esc clears the range');

    // loop: playback stays within the range, starting over at its end
    await page.mouse.move(x0, y); await page.mouse.down(); await page.mouse.move(x0 + 70, y, {steps: 6}); await page.mouse.up();
    const [l0, l1] = await rangeOf(page);
    await page.keyboard.press('l');
    check(await page.locator('#range-loop').getAttribute('aria-pressed') === 'true', 'L loops the range');
    const seen = [];
    for (let i = 0; i < 40; i++) {await page.waitForTimeout(75); seen.push(await songTime(page));}
    check(seen.every(t => t >= l0 - 0.02 && t <= l1 + 0.06), `looping stays within ${l0}–${l1}: ${seen.join(' ')}`);
    check(seen.some((t, i) => i > 0 && t < seen[i - 1] - 0.3), 'looping starts over');
    await page.keyboard.press(' ');
    await page.keyboard.press('Escape');
    check(await page.locator('#range-loop').getAttribute('aria-pressed') === 'false' || await page.locator('#range-bar').isHidden(), 'Esc ends the loop');

    // a note on a range, from its bar
    await page.mouse.move(x0, y); await page.mouse.down(); await page.mouse.move(x1, y, {steps: 6}); await page.mouse.up();
    const [n0, n1] = await rangeOf(page);
    await page.locator('#range-note').click();
    check(await page.evaluate(() => document.activeElement.id) === 'note-text', 'Note focuses the note field');
    await page.keyboard.type('flat here'); await page.waitForTimeout(700);
    check([...notes.values()].some(n => n.scope === 'range' && n.text === 'flat here' && Math.abs(n.t0 - n0) < 0.01 && Math.abs(n.t1 - n1) < 0.01), 'a range note is saved');
    await page.locator('#timeline').focus(); await page.keyboard.press('Escape');

    // marks, verdicts, the stem, the reading's note, the video's switch
    await page.mouse.click(svg.x + 72 + (svg.width - 86) * 0.5, y);
    for (const [key, tag] of [['m', 'mark'], ['v', 'voice'], ['i', 'impact'], ['s', 'strong']]) {
      await page.keyboard.press(key); await page.waitForTimeout(150);
      check([...notes.values()].some(n => n.tags.includes(tag)), `${key.toUpperCase()} marks`);
    }
    for (const [key, verdict] of [['1', 'love'], ['2', 'good'], ['3', 'needs-work']]) {
      await page.keyboard.press(key); await page.waitForTimeout(250);
      check(posts.at(-1)?.verdict === verdict, `${key} gives ${verdict}`);
    }
    if (await page.locator('#hear').isVisible()) {
      await page.locator('[data-hear="vocals"]').click();
      check(await page.locator('[data-hear="vocals"]').getAttribute('aria-pressed') === 'true', 'the stem switch');
      await page.locator('[data-hear="mix"]').click();
    }
    await page.locator('#reading-note').fill('a test reading note'); await page.locator('#timeline').focus(); await page.waitForTimeout(300);
    check(posts.some(p => p.note === 'a test reading note'), 'the reading note saves');
    await page.locator('#help-toggle').click();
    check(await page.locator('#help-panel').isVisible() && (await page.locator('#help-panel').textContent()).includes('loop the selected range'), '? shows the keys');
    await page.keyboard.press('Escape');
    check(await page.locator('#help-panel').isHidden(), 'Esc closes the keys');
    await page.locator('#cursor-details summary').click(); await page.waitForTimeout(100);
    check(await page.locator('#cursor-grid .detail').count() >= 5, 'the cursor details open');
    await page.close();
  }
  check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
  console.log('spec layout: one screen at 1920×1080 and 1440×900; range drag, edge, loop, note, Esc; marks, verdicts, stem, reading note');
} finally {
  await browser.close();
}
