/** Run against npm run serve; uses synthetic signed artifacts, no production audio.
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE can select an already installed browser. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const origin = process.argv[2] ?? 'http://127.0.0.1:8767';
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const sha = b => createHash('sha256').update(b).digest('hex');
function deferred() {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};}
const wav = Buffer.alloc(44 + 16000);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40);
function fixture(id) {
  const c = {id, title: id, durationFrames: 40, audioPath: `async-fixture/${id}.wav`, audioSha256: sha(wav)};
  const record = {case: c, planSha256: id, trace: {frames: Array(41).fill({})}};
  const data = JSON.stringify(record);
  const manifest = {planSha256: id, plan: {cases: [c]}, cells: [{id, method: 'production', path: `${id}.json`, sha256: sha(data),
    seed: 101, valid: true, score: {score: 1}, compileMs: 1, physicalFrames: 1, allowance: 10,
    production: {qualified: true, realization: {sections: [], fulfilledSections: 0, requested: 0}, plan: {phrases: [], requests: [], policy: 'fixture'}}}]};
  const video = {identity: {planSha256: id, cellSha256: sha(data)}, full: {path: 'video.mp4'}};
  return {[`${id}.json`]: data, [`${id}-manifest.json`]: JSON.stringify(manifest), [`${id}.video.json`]: JSON.stringify(video)};
}
const files = {...fixture('first'), ...fixture('second')};
const checks = [];
try {
  for (const mode of ['overlap', 'superseded', 'bad-audio']) {
    const page = await browser.newPage(), errors = [], requested = [], audioGate = deferred(), replayGate = deferred();
    page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/repertoire/catalog', route => route.fulfill({json: {songs: [], constructions: []}}));
    await page.route('**/api/repertoire/jobs', route => route.fulfill({json: {jobs: []}}));
    await page.route('**/motion-gallery/production-library.json', route => route.fulfill({json: {entries: ['first','second'].map(id => ({title: id, manifest: `/async-fixture/${id}-manifest.json`}))}}));
    await page.route('**/motion-gallery/replay.js', route => route.fulfill({contentType: 'text/javascript', body:
      `export async function prepareView(r){await fetch('/async-fixture/replay-'+r.case.id);return {view:{draw(){}}};}` }));
    await page.route('**/async-fixture/*', async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1); requested.push(name);
      if (name === 'replay-first') {if (mode === 'overlap') await replayGate.promise; await route.fulfill({body: 'ok'}); return;}
      if (name.startsWith('replay-')) {await route.fulfill({body: 'ok'}); return;}
      if (name.endsWith('.wav')) {
        if (name === 'first.wav' && mode !== 'bad-audio') await audioGate.promise;
        await route.fulfill({contentType: 'audio/wav', body: mode === 'bad-audio' ? Buffer.from('changed recording') : wav}); return;
      }
      const isHash = name.endsWith('.sha256'), content = files[isHash ? name.slice(0, -7) : name];
      await route.fulfill(content ? {body: isHash ? sha(content) : content, contentType: isHash ? 'text/plain' : 'application/json'} : {status: 404, body: 'fixture unavailable'});
    });
    await page.goto(origin + '/motion-gallery/production.html');
    // These requests must start even while native preparation or audio is blocked.
    await page.waitForFunction(() => document.querySelectorAll('#library button').length === 2);
    for (let i = 0; i < 150 && !requested.includes('first.wav'); i++) await page.waitForTimeout(20);
    assert(requested.includes('first.wav'), 'audio starts without waiting for replay');
    if (mode === 'overlap') {
      for (let i = 0; i < 150 && !requested.includes('replay-first'); i++) await page.waitForTimeout(20);
      assert(requested.includes('replay-first')); replayGate.resolve();
      await page.waitForFunction(() => !document.getElementById('movie').hidden);
      assert.equal(requested.filter(x => x === 'first.video.json').length, 1, 'video metadata fetched once');
      assert.equal(await page.locator('#play').isDisabled(), true, 'music remains pending');
      audioGate.resolve();
      await page.waitForFunction(() => !document.getElementById('play').disabled);
    } else if (mode === 'superseded') {
      await page.locator('#library button').nth(1).click();
      await page.waitForFunction(() => document.getElementById('play').dataset.source === 'async-fixture/second.wav');
      audioGate.resolve(); await page.waitForTimeout(100);
      assert.equal(await page.locator('#play').getAttribute('data-source'), 'async-fixture/second.wav');
      assert.match(await page.locator('#movie').getAttribute('src'), /async-fixture\/video.mp4/);
      assert.match(await page.locator('#result-title').textContent(), /second/);
    } else {
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('Music does not match'));
      assert.equal(await page.locator('#play').isDisabled(), true);
      assert.equal(await page.locator('#seek').isDisabled(), false);
      await page.waitForFunction(() => !document.getElementById('movie').hidden);
    }
    assert.deepEqual(errors, []); checks.push(mode); audioGate.resolve(); replayGate.resolve(); await page.close();
  }
  {
    const page = await browser.newPage(), analysisGate = deferred(), audioStarted = deferred(), errors = [];
    page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/spec-notes**', route => route.fulfill({json: {notes: [], notesPath: 'test-only'}}));
    await page.route('**/productions/luna_bala_44s/*.json', async route => {await analysisGate.promise; await route.continue();});
    await page.route('**/productions/luna_bala_44s/audio.mp3', async route => {audioStarted.resolve(); await route.fulfill({contentType: 'audio/wav', body: wav});});
    await page.goto(origin + '/spec-dashboard/?spec=productions/luna_bala_44s/spec.ts');
    let timer;
    try {
      await Promise.race([audioStarted.promise, new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('audio waited for analysis')), 10000);})]);
      // Let audio decoding finish while analysis is still pending.
      await page.waitForTimeout(100);
      assert.deepEqual(errors, []);
    } finally {clearTimeout(timer); analysisGate.resolve();}
    await page.waitForFunction(() => document.getElementById('timeline').children.length > 0);
    assert.deepEqual(errors, []); checks.push('dashboard-audio-analysis'); await page.close();
  }
  console.log(JSON.stringify({passed: checks, fixtures: 'synthetic signed JSON and generated PCM WAV; renderer stub isolates loading order'}));
} finally {await browser.close();}
