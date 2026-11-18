/** Run against a local review server: node tests/browser/spec-layout.mjs [URL] [spec] [spec with earlier notes and a video]
 * [spec of a song without a drop].
 * The spec dashboard as one screen (no page scroll at 1920×1080 and 1440×900, the timeline spanning its panel, the
 * video whole), and its range: drag to select, drag an edge, loop it (L), note it, Esc. Then notes on earlier versions
 * (the server's, read only: the toggle, hover, the quote, noting again), Watch the loop (gapless: the sound recorded across
 * the join, the picture restarting on time), and the drop band. Notes, verdicts
 * and the reading's note are intercepted (kept in this script), so this check cannot change the owner's words. */
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
  // the check starts from readings without a verdict or words: the owner's own are neither shown nor changed
  listing.readings = listing.readings.map(r => ({...r, verdict: null, changed: false, note: '', earlierNotes: []}));
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
  // Notes on earlier versions: the server's own notes are read; what the page writes is kept in this script.
  {
    const page = await context.newPage({viewport: {width: 1920, height: 1080}});
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
    const posted = new Map(), deleted = [];
    await page.route('**/api/spec-notes**', async route => {
      const request = route.request();
      if (request.method() !== 'POST') {
        const real = await (await context.request.get(request.url())).json();
        return route.fulfill({json: {...real, notes: [...real.notes, ...[...posted.values()].map(n => ({...n, current: true}))]}});
      }
      const body = request.postDataJSON();
      if (body.note) posted.set(body.note.id, body.note); else deleted.push(body);
      return route.fulfill({json: {ok: true, note: body.note ? {...body.note, current: true} : null, notesPath: 'test-only'}});
    });
    const open = async (spec) => {
      await page.goto(`${base}/spec-dashboard/?spec=${spec}`);
      await page.waitForFunction(() => !document.querySelector('#spec-subtitle').textContent.startsWith('Loading') && document.querySelector('#timeline').children.length > 0);
      await page.waitForTimeout(500);
    };
    const earlierSpec = process.argv[4] ?? 'productions/short_circus_minimus/spec.ts';
    await open(earlierSpec);
    await page.evaluate(() => localStorage.removeItem('spec-dashboard.listening'));
    await open(earlierSpec);
    const label = await page.locator('#earlier-toggle').textContent(), count = Number(/\((\d+)\)/.exec(label)?.[1]);
    check(await page.locator('#earlier-toggle').isVisible() && count > 0, `the Notes panel offers its earlier notes: "${label.trim()}"`);
    check(!await page.locator('#toggle-earlier').isChecked() && await page.locator('#notes-list li.earlier').count() === 0, 'earlier notes are off by default');
    // off: hovering one shows its words; clicking it quotes it, read only
    const mark = page.locator('.svg-note-earlier').nth(3);
    await mark.hover();
    const card = await page.locator('#note-card').evaluate(e => e.hidden ? '' : e.textContent);
    check(card.includes('earlier version'), `hovering an earlier note shows it: "${card}"`);
    await mark.click();
    check(await page.locator('#earlier-ref').isVisible() && await page.locator('#note-text').isHidden() && await page.locator('#delete-note').isHidden(),
      'clicking an earlier note quotes it, with no editor');
    check((await page.locator('#earlier-head').textContent()).startsWith('Written ') && (await page.locator('#earlier-text').textContent()).length > 0, 'the quote has its date and words');
    // on: drawn outlined, all listed with their dates, remembered
    await page.locator('#toggle-earlier').check();
    check(await page.locator('#notes-list li.earlier').count() === count, `all ${count} earlier notes are listed`);
    check(await page.locator('.svg-note-earlier').first().getAttribute('stroke-dasharray') === '3 2', 'earlier notes are outlined on the timeline');
    check(/· \d+ \w+|· \w+ \d+/.test(await page.locator('#notes-list li.earlier .note-scope').first().textContent()), 'each listed earlier note has its date');
    await open(earlierSpec);
    check(await page.locator('#toggle-earlier').isChecked(), 'the choice is remembered');
    // "Note this again": a current note at the same place with the words; the earlier one stays
    const worded = page.locator('#notes-list li.earlier button').filter({hasText: /[a-z]{4,} [a-z]{3,}/}).first();
    await worded.click();
    const words = (await page.locator('#earlier-text').textContent()).trim();
    await page.locator('#note-again').click(); await page.waitForTimeout(400);
    check([...posted.values()].some(n => n.text.includes(words)), `noting again posts a current note with "${words}"`);
    check(deleted.length === 0, 'noting again deletes nothing');
    check(await page.locator('#notes-list li.earlier').count() === count, 'the earlier note stays');
    check(await page.locator('#note-text').isVisible() && (await page.locator('#note-text').inputValue()).includes(words), 'the new note is in the editor');
    await page.locator('#toggle-earlier').uncheck();
    await open(earlierSpec);
    check(!await page.locator('#toggle-earlier').isChecked(), 'off is remembered too');

    // Watch the loop: the film by itself, with its sound, looping from a few seconds before its end, without a gap: the
    // sound (Web Audio, looping to the sample) is recorded across the join and aligned to the film's own sound; the frames
    // presented by both video elements show the picture restarting at once. Then slaved again.
    const film = () => page.evaluate(() => {
      const shown = [...document.querySelectorAll('.ride-video video')].filter(v => !v.hidden);
      const v = shown[0] ?? document.querySelector('#video-player');
      return {t: v.currentTime, d: v.duration, muted: v.muted, loop: v.loop, paused: v.paused, shown: shown.length, id: v.id};
    });
    await page.waitForFunction(() => document.querySelector('#video-player').readyState >= 1);
    // the loop's sound: every looping buffer source started on the page, tapped by a recorder when it starts
    await page.evaluate(() => {
      const taps = window.__loopTaps = [];
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        if (this.loop) {
          const rec = this.context.createScriptProcessor(1024, 2, 2), sink = this.context.createGain(), chunks = [];
          sink.gain.value = 0; rec.onaudioprocess = e => chunks.push(Float32Array.from(e.inputBuffer.getChannelData(0)));
          this.connect(rec); rec.connect(sink); sink.connect(this.context.destination);
          taps.push({source: this, chunks, sink});
        }
        return start.apply(this, args);
      };
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (to, ...rest) {
        if (this instanceof AudioBufferSourceNode && this.loop && to instanceof GainNode && !window.__loopTaps.some(t => t.sink === to)) window.__loopOut ??= to;
        return connect.call(this, to, ...rest);
      };
      // what is on screen at each animation frame: the element shown and the last frame it presented
      const last = {}, screen = window.__loopScreen = [];
      for (const v of document.querySelectorAll('.ride-video video')) {
        const on = (now, meta) => {last[v.id] = meta.mediaTime; v.requestVideoFrameCallback(on);};
        v.requestVideoFrameCallback(on);
      }
      const tick = () => {const v = [...document.querySelectorAll('.ride-video video')].find(e => !e.hidden); if (v && v.id in last) screen.push({id: v.id, media: last[v.id]}); requestAnimationFrame(tick);};
      requestAnimationFrame(tick);
    });
    await page.locator('#watch-loop').click();
    await page.waitForFunction(() => window.__loopTaps.length > 0, null, {timeout: 20000}); await page.waitForTimeout(700);
    let f = await film();
    check(f.muted && !f.loop && !f.paused && f.t > f.d - 6 && f.shown === 1, `the loop plays (muted picture, its sound on Web Audio), near its end, one picture: ${JSON.stringify(f)}`);
    check(await page.locator('#watch-loop').textContent() === 'Back to the spec' && await page.locator('#play').textContent() === 'Pause', 'the mode shows');
    check(Math.abs(await songTime(page) - f.t) < 0.5, 'the cursor follows the film');
    // past the join
    await page.waitForFunction(() => {const v = [...document.querySelectorAll('.ride-video video')].find(e => !e.hidden); return v && v.currentTime > 1.5 && v.currentTime < 5;}, null, {timeout: 12000});
    const seam = await page.evaluate(() => {
      const {source, chunks} = window.__loopTaps[0], buffer = source.buffer, length = source.loopEnd || buffer.duration;
      const got = new Float32Array(chunks.reduce((n, c) => n + c.length, 0)); let o = 0; for (const c of chunks) {got.set(c, o); o += c.length;}
      const ref = buffer.getChannelData(0), end = Math.round(length * buffer.sampleRate), W = 4800;
      // where a 100 ms piece of the film's sound sits in what was heard (normalised correlation)
      const find = (from) => {let best = -Infinity, at = -1; for (let lag = 0; lag + W <= got.length; lag++) {let d = 0, e = 0, f = 0; for (let i = 0; i < W; i += 2) {d += got[lag + i] * ref[from + i]; e += got[lag + i] ** 2; f += ref[from + i] ** 2;} const c = d / Math.sqrt(e * f + 1e-12); if (c > best) {best = c; at = lag;}} return {at, c: best};};
      const before = find(end - W - 480), after = find(480);
      // the picture: how many animation frames the film's last frame stays on screen before the first frame shows
      const sh = window.__loopScreen, k = sh.findIndex((x, i) => i && x.media < sh[i - 1].media - 1);
      let held = 0; if (k > 0) for (let i = k - 1; i >= 0 && sh[i].media === sh[k - 1].media && sh[i].id === sh[k - 1].id; i--) held++;
      return {gapMs: ((after.at - 480) - (before.at + W + 480)) / buffer.sampleRate * 1000, corr: [before.c, after.c],
        held, firstMedia: k > 0 ? sh[k].media : null, swapped: k > 0 && sh[k].id !== sh[k - 1].id, screen: k > 0 ? sh.slice(k - 3, k + 4).map(x => x.media.toFixed(3)) : []};
    });
    check(seam.corr[0] > 0.99 && seam.corr[1] > 0.99 && Math.abs(seam.gapMs) <= 5, `the sound runs straight through the join: ${JSON.stringify(seam)}`);
    check(seam.firstMedia !== null && seam.firstMedia < 0.05 && seam.held <= 3, `the picture restarts within a frame or two: ${JSON.stringify(seam)}`);
    const fits = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && [...document.querySelectorAll('.ride-video video')].filter(v => !v.hidden).length === 1);
    check(fits, 'the page still fits, one picture shown');
    console.log(`Watch the loop: sound gap ${seam.gapMs.toFixed(2)} ms at the join; the film's last frame on screen for ${seam.held} animation frame(s), then its first${seam.swapped ? ' (the waiting element)' : ''}`);
    await page.locator('#timeline').focus(); await page.keyboard.press(' '); await page.waitForTimeout(150);
    check((await film()).paused && await page.locator('#play').textContent() === 'Play', 'Space pauses the film');
    await page.keyboard.press(' '); await page.waitForTimeout(250);
    check(!(await film()).paused, 'Space plays it again');
    await page.locator('#music-volume').evaluate(e => {e.value = '0.3'; e.dispatchEvent(new Event('input', {bubbles: true}));}); await page.waitForTimeout(100);
    const gain = await page.evaluate(() => window.__loopOut?.gain.value);
    check(Math.abs(gain - 0.3) < 1e-6 && (await film()).shown === 1, `the volume control sets the loop's sound: ${gain}`);
    await page.locator('#music-volume').evaluate(e => {e.value = '1'; e.dispatchEvent(new Event('input', {bubbles: true}));});
    await page.locator('#loop-from-start').click(); await page.waitForTimeout(400);
    f = await film();
    check(f.t < 2 && !f.paused, `From the start plays the whole film: ${JSON.stringify(f)}`);
    await page.locator('#watch-loop').click(); await page.waitForTimeout(200);
    f = await film();
    check(f.muted && !f.loop && f.paused && f.id === 'video-player' && f.shown === 1 && await page.locator('#watch-loop').textContent() === 'Watch the loop', `Back to the spec mutes and pauses it: ${JSON.stringify(f)}`);
    await page.locator('#timeline').focus(); await page.keyboard.press(' '); await page.waitForTimeout(900);
    f = await film();
    check(!f.paused && f.muted && Math.abs(await songTime(page) - f.t) < 0.3, 'the video follows the dashboard again');
    await page.keyboard.press(' ');

    // the drop, on the timeline: shown for a song with one, absent for one without
    await open('productions/short_luna_bala_slowed/spec.ts');
    check(/^drop \d+(\.\d+)?–\d+(\.\d+)? s/.test(await page.locator('[data-drop] title').textContent()), 'the drop shows, its times on hover');
    await open(process.argv[5] ?? 'productions/bones_selection/spec.ts');
    check(await page.locator('[data-drop]').count() === 0, 'no drop band for a song without one');
    await page.close();
  }
  check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
  console.log('spec layout: one screen at 1920×1080 and 1440×900; range drag, edge, loop, note, Esc; marks, verdicts, stem, reading note; '
    + 'earlier notes (toggle, hover, quote, note again); Watch the loop; the drop');
} finally {
  await browser.close();
}
