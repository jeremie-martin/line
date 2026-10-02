/** Native dashboard stills for the named interaction study; no video encoding.
 * Start scripts/serve.ts first. Raw screenshots stay in generated/.
 */
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const origin = arg('origin', 'http://localhost:8767');
const out = arg('out', 'generated/tiki-interactions-20261002');
mkdirSync(out, {recursive: true});
const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
const errors = [], shots = [];
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 1150}, deviceScaleFactor: 1});
  page.on('pageerror', e => errors.push(e.message));
  for (const [seed, times] of [[101, [14.050, 14.250, 14.850, 14.950, 14.975]], [303, [7.975, 12.450, 13.950, 14.025]]]) {
    const manifest = `/generated/intentional-motion/library-candidate-8/tiki_tiki_48s-${seed}/manifest.json`;
    await page.goto(`${origin}/motion-gallery/production.html?data=${manifest}&t=${times[0]}`);
    await page.waitForFunction(() => !document.getElementById('play').disabled, null, {timeout: 60_000});
    await page.locator('#zoom').evaluate(e => {e.value = '3'; e.dispatchEvent(new Event('input'));});
    for (const time of times) {
      await page.locator('#seek').evaluate((e, t) => {e.value = String(t); e.dispatchEvent(new Event('input'));}, time);
      assert.equal(await page.locator('#time').textContent(), time.toFixed(2) + ' s');
      const name = `detail-${seed}-${time.toFixed(3)}.png`;
      const bytes = await page.locator('#production').screenshot({path: join(out, name)});
      shots.push({seed, time, manifest, name, sha256: createHash('sha256').update(bytes).digest('hex')});
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(join(out, 'browser-detail-check.json'), JSON.stringify({errors, zoom: 3, nativeRenderer: true, shots}, null, 2) + '\n');
  console.log(JSON.stringify({nativeStills: shots.length, errors}));
} finally {await browser.close();}
