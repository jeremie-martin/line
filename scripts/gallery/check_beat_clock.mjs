/** Instrument the existing player in the browser; never modifies shipped playback. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const origin = process.env.REVIEW_ORIGIN ?? 'http://127.0.0.1:8767';
const out = process.env.REVIEW_OUT ?? 'generated/beat-salience-20261001';
mkdirSync(out, {recursive: true});
const original = readFileSync('motion-gallery/production.js', 'utf8');
const end = ' });\n}\nfunction passageLink';
assert.ok(original.includes(end));
const instrumented = original.replace('function draw(){', 'window.__beatClock=[];\nfunction draw(){\n const auditStart=performance.now(),auditAudio=audio.currentTime;')
  .replace(end, ` });
 if(playing)window.__beatClock.push({wall:performance.now(),audioStart:auditAudio,audioEnd:audio.currentTime,visualTime:seconds,drawMs:performance.now()-auditStart});
}
function passageLink`);
assert.notEqual(instrumented, original);
const browser = await chromium.launch({headless: true}), rows = [], errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.setDefaultTimeout(60000); page.on('pageerror', e => errors.push(e.message));
  await page.route('**/motion-gallery/production.js', route => route.fulfill({body: instrumented, contentType: 'text/javascript'}));
  await page.goto(origin + '/motion-gallery/production.html');
  await page.waitForFunction(() => !document.getElementById('play').disabled);
  // Four songs, both sides visible; initial play and a seek into the song for each.
  for (const index of [0, 3, 6, 9]) {
    await page.locator('#library button').nth(index).click();
    await page.waitForFunction(() => !document.getElementById('play').disabled);
    const title = await page.locator('#result-title').textContent();
    for (const start of [0, 9.425]) {
      await page.locator('#seek').evaluate((e, t) => {e.value = String(t); e.dispatchEvent(new Event('input'));}, start);
      await page.evaluate(() => window.__beatClock = []);
      await page.locator('#play').click();
      await page.waitForFunction(t => document.getElementById('audio').currentTime >= t + 4, start);
      await page.locator('#play').click();
      rows.push({title, start, samples: await page.evaluate(() => window.__beatClock)});
    }
  }
  assert.deepEqual(errors, []);
  const q = (a, p) => [...a].sort((x,y) => x-y)[Math.max(0,Math.ceil(a.length*p)-1)];
  const summary = rows.map(({title, start, samples}) => ({title, start, draws: samples.length,
    visualMinusAudioMs: {min: Math.min(...samples.map(s => (s.visualTime-s.audioStart)*1000)), max: Math.max(...samples.map(s => (s.visualTime-s.audioStart)*1000))},
    drawMsP95: q(samples.map(s=>s.drawMs),.95), drawMsMax: Math.max(...samples.map(s=>s.drawMs)),
    drawIntervalMsP95: q(samples.slice(1).map((s,i)=>s.wall-samples[i].wall),.95),
    drawIntervalMsMax: Math.max(...samples.slice(1).map((s,i)=>s.wall-samples[i].wall)),
  }));
  const artifact = {schema:'line.beat-clock-audit.v1',origin,playerSha256:createHash('sha256').update(original).digest('hex'),
    limitation:'Headless Chromium on this host. Measures media-clock/draw scheduling, not physical speaker, Bluetooth or display latency on the user device.',summary,rows,errors};
  const bytes=JSON.stringify(artifact)+'\n';writeFileSync(out+'/browser-clock.json',bytes);
  writeFileSync(out+'/browser-clock.json.sha256',createHash('sha256').update(bytes).digest('hex')+'\n');
  console.log(JSON.stringify(summary,null,2));
}finally{await browser.close();}
