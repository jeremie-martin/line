/** Use the real tools end to end, as a person would: unit tests and parity cannot
 * see a broken workflow, page or missing asset.
 *
 *   npm run check:smoke
 *
 * Times a small paired comparison against HEAD with perf:engine, compiles one ride
 * with the production command, and opens it in real Chromium: a deep link must land
 * on its time, and no page may fail. Needs local song audio and a Chromium; set
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE to use one Playwright did not install. */
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url)), out = join(root, 'generated/smoke'), BUDGET = 150000;
const CELL = `canonical-music_luna_bala_44s-automatic#101@${BUDGET}`, PORT = 8791, base = `http://127.0.0.1:${PORT}`;
const run = (...args: string[]) => execFileSync(process.execPath, args, {cwd: root, stdio: ['ignore', 'ignore', 'inherit'], env: {...process.env, LR_ENGINE: 'wasm'}});

/** The newest Chromium Playwright downloaded, when its pinned build is not the installed one. */
function chromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const cache = join(homedir(), '.cache/ms-playwright');
  const builds = existsSync(cache) ? readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9))) : [];
  return builds.map(name => join(cache, name, 'chrome-linux64/chrome')).find(existsSync);
}

/** Identical sources, unless this checkout has changes: the wide margin keeps timing
 * noise out of the question, which is whether the workflow still completes. */
function timingWorkflow() {
  run('tools/measure/engine_ab.ts', '--against=HEAD', `--cells=${CELL}`, '--rounds=8', '--confirm-rounds=8', '--margin-pct=50', `--out=${join(out, 'timing')}`);
  const result = JSON.parse(readFileSync(join(out, 'timing/result.json'), 'utf8'));
  assert.equal(result.complete, true, 'timing comparison did not complete');
  assert.equal(result.samples.length, 16, 'timing comparison lost samples');
}

async function pages() {
  const server = spawn(process.execPath, ['scripts/serve.ts'], {cwd: root, stdio: 'ignore', env: {...process.env, PORT: String(PORT), LR_ENGINE: 'wasm'}});
  const browser = await chromium.launch({executablePath: chromiumPath()});
  try {
    for (let attempt = 0; ; attempt++) {
      try {await fetch(base); break;} catch (error) {
        assert(attempt < 100, `review server did not start: ${error}`);
        await new Promise(done => setTimeout(done, 100));
      }
    }
    const open = async (path: string, ready: (page: import('playwright').Page) => Promise<unknown>, optional = /\.video\.json$/) => {
      const page = await browser.newPage(), failures: string[] = [];
      page.on('pageerror', error => failures.push(error.message));
      // Rides probe for an optional movie record; everything else must exist.
      page.on('response', r => {if (r.status() >= 400 && !optional.test(r.url())) failures.push(`${r.status()} ${r.url()}`);});
      await page.goto(base + path);
      await ready(page);
      assert.deepEqual(failures, [], `${path}: page failures`);
      return page;
    };
    const manifest = '/generated/smoke/ride/manifest.json';
    const ride = await open(`/motion-gallery/production.html?data=${manifest}&t=2.5`, page =>
      page.waitForFunction(() => (document.getElementById('seek') as HTMLInputElement).value === '2.5', undefined, {timeout: 30000}));
    assert.match(await ride.locator('#time').textContent() ?? '', /^2\.50 \/ /, 'deep link missed its time');
    await open('/spec-dashboard/?spec=productions/luna_bala_44s/spec.ts', page => page.waitForLoadState('networkidle'));
    // Study clips are local data, not on every machine; the page's own code must load.
    await open('/motion-gallery/pairs.html', page => page.waitForLoadState('networkidle'), /generated\/label-studies|api\/labels/);
  } finally {
    await browser.close();
    server.kill();
  }
}

rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});
assert(chromiumPath(), 'no Chromium: run `npx playwright install chromium` or set PLAYWRIGHT_CHROMIUM_EXECUTABLE');
assert(existsSync(join(root, 'productions/luna_bala_44s/audio.mp3')), 'smoke checks need local song audio');
timingWorkflow();
run('scripts/gallery/build_renderer.mjs');
run('scripts/produce/automatic.ts', '--song=luna_bala_44s', '--seed=101', `--budget=${BUDGET}`, `--out=${join(out, 'ride')}`);
await pages();
console.log('PASS  smoke: timing comparison, production compile, review pages');
