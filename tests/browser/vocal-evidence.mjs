/** Read-only cross-song dashboard check. Run against npm run serve. */
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:8771';
const songs = ['circus_minimus_77s', 'trouble_50s', 'valhalla_40s', 'luna_bala_44s', 'tiki_tiki_48s'];
const check = (ok, message) => { if (!ok) throw Error(message); };
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1440, height: 1100}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  for (const song of songs) {
    const spec = `productions/${song}/spec.ts`;
    const response = await page.request.get(`${base}/api/spec-view?spec=${spec}`);
    const data = await response.json();
    check(data.music.vocalEvidenceUrl && !data.music.vocalEvidenceError, `${song}: provenance valid`);
    const evidence = JSON.parse(readFileSync(`productions/${song}/vocal-evidence.json`, 'utf8'));
    const events = JSON.parse(readFileSync(`productions/${song}/events.json`, 'utf8')).events;
    await page.goto(`${base}/spec-dashboard/?spec=${spec}`);
    await page.waitForSelector('[data-evidence-series="rms"]');
    const offset = data.music.offset;
    const inRange = t => t + offset >= 0 && t + offset <= data.spec.duration;
    check(await page.locator('[data-evidence-series]').count() === 2, `${song}: both continuous measurements`);
    for (const source of ['drums', 'bass', 'vocals', 'other']) {
      const expected = events.filter(e => e.sources[source] && inRange(e.sources[source].t)).length;
      check(await page.locator(`[data-event-source="${source}"]`).count() === expected, `${song}: every ${source} observation preserved`);
    }
    const count = evidence.candidates.filter(c => inRange(c.t)).length;
    check(await page.locator('[data-vocal-candidate]').count() === count, `${song}: all candidate types preserved`);
    check(await page.locator('[data-acoustic-landmarks]').count() === count, `${song}: candidate landmarks available`);
    const context = JSON.parse(await page.locator('#agent-json').textContent());
    check(context.evidence.vocalWindow.bandFlux.length === 3, `${song}: band measurements available to author`);
    console.log(`PASS ${song}: sources preserved, ${count} candidates visible, two measurement traces`);
    if (song === songs[0]) {
      await page.screenshot({path: '/tmp/vocal-evidence-desktop.png', fullPage: true});
      await page.setViewportSize({width: 390, height: 844});
      await page.screenshot({path: '/tmp/vocal-evidence-mobile.png', fullPage: true});
      await page.setViewportSize({width: 1440, height: 1100});
    }
  }
  check(!errors.length, errors.join('\n'));
} finally { await browser.close(); }
