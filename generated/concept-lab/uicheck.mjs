// Interaction suite for the concept lab: question mode, ride sets, free lab and blind test, at phone size
// (390×844, touch, .tap()) and desktop. It asserts STATE (what is selected, stored, drawn, where things are), not just "no errors".
// Usage (with the lab served on :8770): /usr/bin/node generated/concept-lab/uicheck.mjs   Exit code 1 on any failed check.
import {chromium} from 'playwright';

const BASE = 'http://127.0.0.1:8770/generated/concept-lab/';
const PHONE = {viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true};
const DESK = {viewport: {width: 1400, height: 900}};
const results = []; let section = '';
const check = (ok, what, detail = '') => {results.push({section, ok: !!ok, what, detail}); console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}${!ok && detail ? '  — ' + detail : ''}`);};
const begin = name => {section = name; console.log('\n' + name);};
// each section records its own crash and the suite moves on: one broken area must not hide the others
async function run(name, fn) {begin(name); try {await fn();} catch (e) {check(false, 'section crashed', e.message.split('\n')[0]);} finally {for (const c of b.contexts()) await c.close().catch(() => {});}}
const b = await chromium.launch({args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']});
const pageErrors = [];

async function open(url, opts = PHONE, {before} = {}) {
  const ctx = await b.newContext(opts), p = await ctx.newPage();
  p.on('pageerror', e => pageErrors.push(`${section}: ${e.message}`));
  if (before) await before(p, ctx);
  await p.goto(BASE + url);
  return p;
}
const st = p => p.evaluate(() => window.__labState());
// settled: nothing loading, the loaded ride is the one asked for, and (in question mode) the question is rendered
async function settled(p) {
  await p.waitForFunction(() => {const s = window.__labState?.(); return s && !document.getElementById('status').textContent && s.loaded === s.song;}, null, {timeout: 90000});
  await p.waitForTimeout(150);
}
const tap = async (p, sel, i = 0) => {await p.locator(sel).nth(i).tap();};
const onLabels = p => p.locator('#qpick button.on').allTextContents();
// page y (not viewport y: a tap may scroll the page)
const y = (p, sel) => p.evaluate(s => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// the colour of the paper as drawn: the top-left canvas pixel (nothing else is drawn there in these looks)
const cornerPixel = p => p.evaluate(() => {const c = document.getElementById('stage'); return [...c.getContext('2d').getImageData(3, 3, 1, 1).data].slice(0, 3);});
const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const url = p => new URL(p.url()).searchParams;
const QMOMENTS_TOP = ['Petrunko 34 s', 'Tomada 37 s', 'On Dune', 'On Café (dark)', 'On Hokusai'];

try {
  // ── 1. question mode at phone size: layout, picks, overrides ───────────────────────────────────────────────
  await run('Question mode, phone: layout and options', async () => {
    const p = await open('?qtest=1&q=2');
    await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
    check(await p.locator('#qprogress').textContent().then(t => t.startsWith('Question 2')), 'opens on question 2');
    // nothing covers the picture or the controls: every control's centre hits that control
    const covered = await p.evaluate(() => [...document.querySelectorAll('#qpick button, #presets button, #moments button, #qnext, #qprev, #play, #stagewrap')].filter(el => {
      el.scrollIntoView({block: 'center'}); const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !(hit === el || el.contains(hit));
    }).map(el => el.id || el.textContent));
    await p.evaluate(() => scrollTo(0, 0));
    check(covered.length === 0, 'no control is covered by another element (e.g. the "All rounds" link)', covered.join(', '));
    const overlaps = await p.evaluate(() => {
      const link = document.querySelector('.homelink'), hits = [], ov = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      for (const sy of [0, 300, 600, 900]) {scrollTo(0, sy); const r = link.getBoundingClientRect();
        for (const el of document.querySelectorAll('button, #stagewrap, textarea, input')) if (el.offsetParent && ov(r, el.getBoundingClientRect())) hits.push(`${el.id || el.textContent}@${sy}`);}
      scrollTo(0, 0); return hits;
    });
    check(overlaps.length === 0, 'the "All rounds" link overlaps nothing at any scroll position', overlaps.join(', '));
    const sizes = await p.evaluate(() => [...document.querySelectorAll('#qpick button')].map(b => [b.offsetWidth, b.offsetHeight]));
    check(sizes.every(([w, h]) => w >= 44 && h >= 40), 'answer buttons are at least 44×40 px', JSON.stringify(sizes));
    const ta = await p.evaluate(() => ({ta: parseFloat(getComputedStyle(document.getElementById('qnote')).fontSize), btn: getComputedStyle(document.querySelector('#qpick button')).touchAction}));
    check(ta.ta >= 16, 'note box text ≥ 16 px (no iOS zoom on focus)', ta.ta + 'px');
    check(ta.btn === 'manipulation', 'buttons disable double-tap zoom', ta.btn);

    // the answer row never moves when switching options, moments or picks
    const y0 = await y(p, '#qpick'), ys = [];
    for (let i = 0; i < 3; i++) {await tap(p, '#presets button', i); ys.push(await y(p, '#qpick'));}
    for (let j = 0; j < 5; j++) {await tap(p, '#moments button', j); await settled(p); ys.push(await y(p, '#qpick'));}
    await tap(p, '#qpick button', 1); ys.push(await y(p, '#qpick'));
    check(ys.every(v => Math.abs(v - y0) < 0.5), 'answer row y is constant across options, moments and picks', JSON.stringify([y0, ...ys]));

    // multi-choice: B then C both stay selected (labels with commas)
    await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
    await tap(p, '#qpick button', 1); await tap(p, '#qpick button', 2);
    check(JSON.stringify(await onLabels(p)) === '["B","C"]', 'tapping B then C selects both', JSON.stringify(await onLabels(p)));
    await tap(p, '#qpick button', 3); // None of these
    check(JSON.stringify(await onLabels(p)) === '["None of these"]', '"None of these" clears the picks', JSON.stringify(await onLabels(p)));
    await tap(p, '#qpick button', 3);
    check((await onLabels(p)).length === 0, '"None of these" toggles off again');
    await tap(p, '#qpick button', 0); await tap(p, '#qpick button', 0);
    check((await onLabels(p)).length === 0, 'tapping A twice unpicks it');

    // a moment's palette override survives every way of switching option, and is what is drawn
    await tap(p, '#moments button', QMOMENTS_TOP.indexOf('On Dune')); await settled(p);
    const dune = hex('#efe2cd');
    let s = await st(p);
    check(s.mix.scheme === 'dune' && s.qmoment === 2, 'On Dune applies the Dune scheme', s.mix.scheme);
    check(await p.locator('#moments button.on').textContent() === 'On Dune', 'the active moment chip is marked');
    await tap(p, '#presets button', 1); s = await st(p);
    check(s.mix.scheme === 'dune' && s.mix.top === 'sun', 'option chip B keeps the Dune override', `${s.mix.scheme} ${s.mix.top}`);
    check(near(await cornerPixel(p), dune, 18), 'the drawn paper is Dune after switching option', String(await cornerPixel(p)));
    // swipe on the picture (used to drop the override)
    const box = await p.locator('#stagewrap').boundingBox();
    await p.evaluate(({x, y}) => {const el = document.getElementById('stagewrap'), o = {pointerId: 1, bubbles: true, pointerType: 'touch'};
      el.dispatchEvent(new PointerEvent('pointerdown', {...o, clientX: x + 200, clientY: y})); el.dispatchEvent(new PointerEvent('pointerup', {...o, clientX: x + 60, clientY: y + 5}));}, {x: box.x, y: box.y + 200});
    s = await st(p);
    check(s.qopt === 2 && s.mix.scheme === 'dune' && s.mix.top === 'title', 'a swipe moves to C and keeps the Dune override', `${s.qopt} ${s.mix.scheme} ${s.mix.top}`);
    check(near(await cornerPixel(p), dune, 18), 'the drawn paper is still Dune after the swipe', String(await cornerPixel(p)));
    const flag = await p.locator('#optflag').textContent();
    check(flag === 'C · The title · On Dune', 'the label on the picture says what is drawn', flag);
    // another moment without an override returns to the option's own palette
    await tap(p, '#moments button', 0); await settled(p); s = await st(p);
    check(s.mix.scheme === 'graphite' && s.momentExtra === null && !(await p.locator('#optflag').textContent()).includes('Dune'), 'a moment without override clears it (state and label)');
    check(Math.abs(s.loop - 33.6) < 1e-6 && s.loopLen === 5, 'the moment sets the loop', `${s.loop} ${s.loopLen}`);
    await p.context().close();
  });

  // ── 2. persistence: reload mid-question, prev/next, legacy saves, URL ─────────────────────────────────────
  await run('Question mode: persistence and address', async () => {
    const p = await open('?qtest=1&q=2');
    await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
    await tap(p, '#qpick button', 1); await tap(p, '#qpick button', 2);
    await p.locator('#qnote').fill('top note, with a comma');
    await tap(p, '#presets button', 1); await tap(p, '#moments button', 2); await settled(p);
    const q = url(p);
    check(q.get('q') === '2' && q.get('opt') === 'B' && q.get('mo') === '3', 'address carries question, option and moment', p.url());
    await p.reload(); await settled(p); await p.waitForTimeout(300);
    let s = await st(p);
    check(JSON.stringify(await onLabels(p)) === '["B","C"]', 'reload restores the picks', JSON.stringify(await onLabels(p)));
    check(await p.locator('#qnote').inputValue() === 'top note, with a comma', 'reload restores the note');
    check(s.qopt === 1 && s.qmoment === 2 && s.mix.scheme === 'dune', 'reload restores option B on Dune', `${s.qopt} ${s.qmoment} ${s.mix.scheme}`);
    check(await p.locator('#optflag').textContent() === 'B · A sun, a little higher · On Dune', 'reload restores the picture label', await p.locator('#optflag').textContent());
    // next then back: picks and note kept, option/moment back to the question's start
    await tap(p, '#qnext'); await settled(p);
    s = await st(p);
    check(s.qi === 2 && s.momentExtra === null && s.mix.scheme === 'graphite' && !url(p).has('opt') && !url(p).has('mo'), 'next question starts clean (no override, no opt/mo in the address)');
    await tap(p, '#qprev'); await settled(p);
    check(JSON.stringify(await onLabels(p)) === '["B","C"]' && await p.locator('#qnote').inputValue() === 'top note, with a comma', 'back keeps picks and note');
    await p.context().close();
  });

  await run('Question mode: summary', async () => {
    const p = await open('?qtest=1&q=1');
    await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
    await tap(p, '#qpick button', 3); // D · None (an option called None)
    await p.locator('#qnote').fill('band note');
    await tap(p, '#qnext'); await settled(p);
    await tap(p, '#qpick button', 1); await tap(p, '#qpick button', 2);
    await tap(p, '#qnext'); await settled(p);
    await tap(p, '#qpick button', 3); // None of these
    for (let i = 3; i <= 7; i++) {await tap(p, '#qnext'); await settled(p);} // to 4, 5, 6, 7, then done
    await p.waitForFunction(() => !document.getElementById('qsummary').hidden);
    const lines = (await p.locator('#qsummary').inputValue()).split('\n');
    check(lines.length === 7, 'summary has one line per question', String(lines.length));
    check(lines[0] === '1. The band, compared fairly → D · None — band note', 'option "None" reads as D · None, with the note', lines[0]);
    check(lines[1] === '2. What at the top of the frame? → B · A sun, a little higher + C · The title', 'multi picks listed exactly', lines[1]);
    check(lines[2] === '3. The line → None of these', '"None of these" spelled out', lines[2]);
    check(lines.slice(3).every(l => l.endsWith('→ (skipped)')), 'unanswered questions say skipped', lines.slice(3).join(' | '));
    check(await p.locator('#optflag').isHidden(), 'no option label on the done page');
    await tap(p, '#qnext'); await settled(p); // start again
    check((await st(p)).qi === 0 && await p.locator('#qcopy').isHidden(), 'start again returns to question 1');
    await p.context().close();
  });

  // ── 3. races: switching faster than rides load ────────────────────────────────────────────────────────────
  await run('Question mode: races while loading', async () => {
    // slow every ride's data so loads overlap
    const slow = async p => p.route(/\/data\/\w+\.json$/, async r => {await new Promise(res => setTimeout(res, 900)); await r.continue();});
    let p = await open('?qtest=1&q=1', PHONE, {before: slow});
    await settled(p);
    // moments on three songs tapped in quick succession: the last one wins, consistently
    await tap(p, '#moments button', 1); await tap(p, '#moments button', 2); await tap(p, '#moments button', 3);
    await settled(p); await p.waitForTimeout(1500); let s = await st(p);
    check(s.song === 'batidao' && s.loaded === 'batidao' && s.qmoment === 3 && Math.abs(s.loop - 14.5) < 1e-6, 'rapid moments: the last moment\'s ride and loop win', JSON.stringify({song: s.song, loaded: s.loaded, qm: s.qmoment, loop: s.loop}));
    check(await p.locator('#moments button.on').textContent() === 'Batidão 15 s', 'rapid moments: the marked chip is the last one');
    // a moment on another song, then Next before it loads: the stale moment must not overwrite question 2
    await tap(p, '#moments button', 2); await tap(p, '#qnext');
    await settled(p); await p.waitForTimeout(1500); s = await st(p);
    check(s.qi === 1 && s.song === 'petrunko' && s.loaded === 'petrunko' && s.mix.top === 'none' && Math.abs(s.loop - 33.6) < 1e-6 && s.qmoment === null,
      'moment then Next: question 2 shows its own option A and loop', JSON.stringify({qi: s.qi, song: s.song, top: s.mix.top, loop: s.loop, qm: s.qmoment}));
    // Next, Next quickly (petrunko → tomada → lua): ends on question 4 with its own loop
    await tap(p, '#qnext'); await tap(p, '#qnext');
    await settled(p); await p.waitForTimeout(1500); s = await st(p);
    check(s.qi === 3 && s.song === 'lua' && s.loaded === 'lua' && Math.abs(s.loop - 36.5) < 1e-6 && s.loopLen === 6 && s.mix.scheme === 'kraft',
      'Next, Next: question 4 with its ride, loop and option', JSON.stringify({qi: s.qi, song: s.song, loaded: s.loaded, loop: s.loop, len: s.loopLen, scheme: s.mix.scheme}));
    check((await p.locator('#qprogress').textContent()).startsWith('Question 4 of 7 · Lua'), 'progress line matches', await p.locator('#qprogress').textContent());
    // option switching while a moment loads: the option survives and the override is added on arrival
    await tap(p, '#qprev'); await settled(p); await tap(p, '#qprev'); await settled(p); // question 2
    await tap(p, '#moments button', 1); await tap(p, '#presets button', 2); // Tomada (loads), then option C during the load
    await settled(p); await p.waitForTimeout(500); s = await st(p);
    check(s.qi === 1 && s.qopt === 2 && s.mix.top === 'title' && s.loaded === 'tomada', 'an option picked during a moment\'s load is kept', JSON.stringify({qopt: s.qopt, top: s.mix.top, loaded: s.loaded}));
    check(pageErrors.length === 0, 'no page errors during the races', pageErrors.join(' | '));
    await p.context().close();
  });

  // ── 4. old rides: a moment can play the round 1–5 ride, and the next moment returns to the current one ─────────
  await run('Question mode: old rides', async () => {
    const p = await open('?qtest=1&q=3');
    await settled(p);
    await tap(p, '#moments button', 3); await settled(p); let s = await st(p);
    check(s.rides === 'old' && s.drawnRides === 'old' && s.loaded === 'los' && Math.abs(s.loop - 10) < 1e-6, 'the old-rides moment loads the round-5 ride', JSON.stringify({rides: s.rides, drawn: s.drawnRides, loaded: s.loaded, loop: s.loop}));
    check((await p.locator('#optflag').textContent()).endsWith('· Los Voltaje 10 s, round 5'), 'the picture label says it is the round-5 ride', await p.locator('#optflag').textContent());
    await tap(p, '#moments button', 0); await settled(p); s = await st(p);
    check(s.rides === '' && s.drawnRides === '' && s.loaded === 'tomada', 'the next moment returns to the current ride', JSON.stringify({rides: s.rides, loaded: s.loaded}));
    await p.context().close();
  });

  // ── 4b. an option on another ride set: switched in place, at the same moment, playing on ─────────────────────
  await run('Question mode: an option on another ride set', async () => {
    const p = await open('?qtest=1&q=7');
    await settled(p); let s = await st(p);
    check(s.drawnRides === '' && s.loaded === 'lua', 'the question opens on the lab’s rides', JSON.stringify({drawn: s.drawnRides, loaded: s.loaded}));
    await tap(p, '#play'); await p.waitForFunction(() => window.__labState().playing, null, {timeout: 10000});
    await tap(p, '#presets button', 1);
    await p.waitForFunction(() => window.__labState().drawnRides === 'old', null, {timeout: 30000}); s = await st(p);
    check(s.playing && s.loaded === 'lua' && s.seconds >= 36.5 && s.seconds < 41.6, 'B switches to the round-5 ride at the same moment, still playing', JSON.stringify({playing: s.playing, loaded: s.loaded, seconds: s.seconds}));
    await tap(p, '#presets button', 0); await p.waitForFunction(() => window.__labState().drawnRides === '', null, {timeout: 30000});
    check(true, 'A returns to the lab’s ride');
    await tap(p, '#moments button', 1); await settled(p); await tap(p, '#presets button', 0); await p.waitForTimeout(300); s = await st(p);
    check(s.drawnRides === 'old' && s.loaded === 'los', 'a moment’s ride set wins over the option’s', JSON.stringify({drawn: s.drawnRides, loaded: s.loaded}));
    await tap(p, '#moments button', 0); await settled(p); s = await st(p);
    check(s.drawnRides === '' && s.loaded === 'lua', 'the next moment returns to the option’s ride set', JSON.stringify({drawn: s.drawnRides, loaded: s.loaded}));
    await p.context().close();
  });

  // ── 4c. the viewing aid: multiplies the hit effects while set, never saved, back to ×1 on the next question ───────
  await run('Question mode: exaggerate the hit effects', async () => {
    const p = await open('?qtest=1&q=1');
    await settled(p);
    await p.locator('#exagx').fill('3'); let s = await st(p);
    check(s.exaggerate === 3 && (await p.locator('#exagval').textContent()) === '×3', 'the slider sets ×3 and says so', String(s.exaggerate));
    check(!url(p).toString().includes('exag'), 'the aid is not in the address');
    await tap(p, '#qnext'); await settled(p); s = await st(p);
    check(s.exaggerate === 1 && (await p.locator('#exagx').inputValue()) === '1', 'the next question starts at ×1', String(s.exaggerate));
    await p.context().close();
  });

  // ── 5. desktop keyboard ─────────────────────────────────────────────────────────────────────────────────────
  await run('Question mode, desktop keyboard', async () => {
    const p = await open('?qtest=1&q=2', DESK);
    await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
    await p.locator('#qpick button').nth(1).click();
    await p.keyboard.press('Space'); await p.waitForTimeout(200);
    check(JSON.stringify(await onLabels(p)) === '["B"]', 'Space with a pick focused does not toggle the pick');
    await p.keyboard.press('Space');
    await p.locator('#moments button').nth(2).click(); await settled(p);
    await p.keyboard.press('ArrowRight'); let s = await st(p);
    check(s.qopt === 1 && s.mix.scheme === 'dune', 'ArrowRight keeps the moment override', `${s.qopt} ${s.mix.scheme}`);
    await p.keyboard.press('3'); s = await st(p);
    check(s.qopt === 2 && s.mix.scheme === 'dune', 'number keys pick the option (as the hint says)', `${s.qopt} ${s.mix.scheme}`);
    await p.locator('#qnote').click(); await p.keyboard.type('12 ');
    check((await st(p)).qopt === 2 && await p.locator('#qnote').inputValue() === '12 ', 'typing in the note does not switch options');
    // loop: off, then on again returns to the moment's passage and length
    await p.locator('#loop').click(); s = await st(p);
    check(s.loop === null, 'loop off');
    await p.locator('#seek').fill('10'); await p.locator('#loop').click(); s = await st(p);
    check(Math.abs(s.loop - 33.6) < 1e-6 && s.loopLen === 5 && await p.locator('#loop').textContent() === 'Loop 5 s', 'loop on again returns to the moment (5 s) and says so', `${s.loop} ${s.loopLen}`);
    await p.context().close();
  });

  // ── 6. free lab ─────────────────────────────────────────────────────────────────────────────────────────────
  await run('Free lab', async () => {
    const slow = async p => p.route(/\/data\/\w+\.json$/, async r => {await new Promise(res => setTimeout(res, 700)); await r.continue();});
    const p = await open('?song=petrunko&t=12', PHONE, {before: slow});
    await settled(p);
    await p.locator('#presets button', {hasText: 'Hokusai'}).tap();
    await p.locator('#mixtoggle').tap();
    await p.locator('#mix .row').filter({hasText: 'At the drop'}).locator('button', {hasText: 'Night'}).first().tap();
    let q = url(p);
    check(q.get('c') === 'hokusai' && (q.get('m') ?? '').includes('drop:night'), 'the address carries preset and adjustments', p.url());
    await p.reload(); await settled(p); let s = await st(p);
    check(s.mix.scheme === 'hokusai' && s.mix.drop === 'night' && (await p.locator('#concept').textContent()) === 'Hokusai · adjusted', 'reload restores preset and adjustments');
    // rapid song switching
    // by name, not position, so adding a song never breaks the check
    for (const name of ['Lua na Praça', 'Los Voltaje', 'Let the World Burn']) await p.locator('#songs button', {hasText: name}).tap();
    await settled(p); await p.waitForTimeout(1200); s = await st(p);
    check(s.song === 'burn' && s.loaded === 'burn' && (await p.locator('#songs button.on').textContent()) === 'Let the World Burn', 'rapid song taps end on the last song', `${s.song} ${s.loaded}`);
    check(s.mix.scheme === 'hokusai' && s.mix.drop === 'night', 'switching songs keeps the look');
    // 'Ending' seeks to 4 s before the end. The page opened at 12 s, so the old test (seconds > 0) passed even if the chip did nothing.
    await p.locator('#moments button', {hasText: 'Ending'}).tap(); s = await st(p); const dur = await p.evaluate(() => +document.getElementById('seek').max);
    check(dur > 20 && Math.abs(s.seconds - (dur - 4)) < 0.01, 'a moment chip seeks', `${s.seconds} of ${dur}`);
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    await p.context().close();
  });

  await run('Intensity caption: the look on screen', async () => {
    // A fixed round exercises the same candidate/moment path as the live intensity rounds, without changing their files.
    const before = p => p.route('**/candidates-intensity-check.json', r => r.fulfill({json: {drafts: [{
      id: 'caption', name: 'Colour response', source: 'Interaction test', line: '', song: 'circus', t: 44.65,
      variants: [
        {label: 'Contrast', look: {paper: 'contrast'}, note: ''},
        {label: 'Vibrance', look: {paper: 'vibranceSoftHalfPaper'}, note: ''},
      ],
      moments: [['As designed', 44.65], ['Plain at the same moment', 44.65, 'circus', {paper: 'plain'}]],
    }]}}));
    const p = await open('?set=intensity-check&q=1', PHONE, {before}); await settled(p);
    const caption = () => p.locator('#level').textContent();
    const contrast = await caption();
    check(await p.locator('#level').isVisible() && /^Intensity \d\.\d{2} · colour response \d+ %$/.test(contrast),
      'contrast is labelled colour response, not vibrance', contrast);
    await tap(p, '#presets button', 1); const vibrance = await caption();
    check(vibrance !== contrast && vibrance.split(' · ')[0] === contrast.split(' · ')[0],
      'switching response changes its amount at the same ride intensity', vibrance);
    await tap(p, '#moments button', 1); await settled(p);
    check((await st(p)).mix.paper === 'plain' && await caption() === contrast.split(' · ')[0],
      'a plain moment override removes the response amount');
    await tap(p, '#presets button', 0);
    check(await caption() === contrast.split(' · ')[0], 'the caption keeps the moment override when switching options');
    await tap(p, '#moments button', 0); await settled(p);
    check(await caption() === contrast, 'returning to the original moment restores its response amount');
    await p.goto(BASE + '?set=intensity-check&song=circus&t=44.65&m=paper:contrast'); await settled(p);
    check(await caption() === contrast, 'the free lab reports the same response as the question');
    await p.goto(BASE + '?song=circus&t=44.65'); await settled(p);
    check(await p.locator('#level').isHidden(), 'ordinary theme review does not show intensity diagnostics');
    await p.context().close();
  });

  // ── 7. blind test ───────────────────────────────────────────────────────────────────────────────────────────
  await run('Blind test', async () => {
    const p = await open('?feel=1', {...PHONE, colorScheme: 'dark'});
    await p.waitForFunction(() => !document.getElementById('feel').hidden && document.getElementById('qprogress').textContent.startsWith('Pair'), null, {timeout: 90000});
    await p.evaluate(() => localStorage.removeItem('concept-lab-feel-r4'));
    const before = JSON.stringify((await st(p)).mix);
    const box = await p.locator('#stagewrap').boundingBox();
    await p.evaluate(({x, y}) => {const el = document.getElementById('stagewrap'), o = {pointerId: 1, bubbles: true, pointerType: 'touch'};
      el.dispatchEvent(new PointerEvent('pointerdown', {...o, clientX: x + 250, clientY: y})); el.dispatchEvent(new PointerEvent('pointerup', {...o, clientX: x + 40, clientY: y}));}, {x: box.x, y: box.y + 200});
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('3');
    check(JSON.stringify((await st(p)).mix) === before, 'swipes and keys cannot change the blind test\'s look');
    check(!url(p).has('c') && !url(p).has('m'), 'the blind test\'s address carries no look', p.url());
    await p.locator('#feelpick button').nth(0).tap();
    const c = await p.evaluate(() => {const b = document.querySelector('#feelpick button.on'), s = getComputedStyle(b); return [s.color, s.backgroundColor];});
    check(c[0] !== c[1], 'the chosen answer is readable in dark mode', c.join(' on '));
    await p.locator('#feelnote').fill('why');
    await p.locator('#feelnext').tap(); await p.locator('#feelprev').tap();
    check(await p.locator('#feelpick button.on').textContent() === 'A' && await p.locator('#feelnote').inputValue() === 'why', 'back keeps the answer and the note');
    await p.context().close();
  });
} finally {
  await b.close();
}
section = 'all'; check(pageErrors.length === 0, 'no uncaught page errors anywhere', pageErrors.join(' | '));
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {console.log('\nFailed:'); for (const f of failed) console.log(`- [${f.section}] ${f.what}${f.detail ? ': ' + f.detail : ''}`); process.exit(1);}
