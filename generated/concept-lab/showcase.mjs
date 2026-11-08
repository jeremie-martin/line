// A film of many themes over one ride: node generated/concept-lab/showcase.mjs layout=wall|solo [song=circus] [from=0 to=…] out=FILE.mp4
// The frames are composed in showcase.html from the video renderer's own picture (served by the review server, :8770) and
// encoded once here, under the repository's encoding standard, then checked like every video (frames, size, tags, audio
// within 1 ms). The cuts, by hand: each on a hit, on the song's section starts where one is near (CUTS).
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdirSync, readFileSync, renameSync, rmSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {AUDIO, CONVERT, VIDEO} from '../../scripts/video/encoding.ts';
import {FPS, audioLag, verifyVideo} from '../../scripts/video/write.ts';

const ROOT = resolve(import.meta.dirname, '../..'), LAB = import.meta.dirname;
const a = Object.fromEntries(process.argv.slice(2).map(s => {const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)];}));
const layout = a.layout ?? 'wall', song = a.song ?? 'circus';
if (!['wall', 'solo'].includes(layout)) throw new Error(`layout=wall|solo, not ${layout}`);
// Circus Minimus: twelve looks, one per cut. The cuts sit on hits: the section starts (verse 12.87, groove 25.70, hook 38.47,
// full groove 51.30) and, between them, the strongest hit within 1.2 s of every 6.4 s. The drop (38.5–51.3) goes to the two
// themes whose drop shows (Night; the switch to espresso); light and dark otherwise alternate.
const PLANS = {
  circus: {kicker: 'Circus Minimus · one ride, twelve looks',
    cuts: [0, 5.27, 12.87, 19.27, 25.695, 32.12, 38.47, 44.87, 51.295, 57.695, 64.12, 70.47],
    themes: ['hokusai', 'plum', 'celadon', 'oldrose', 'wisteria', 'ultramarine', 'paper', 'dune', 'aubergine', 'aconite', 'prussian', 'black']},
};
const plan = PLANS[song]; if (!plan) throw new Error(`no cut plan for ${song}`);
const scene = JSON.parse(readFileSync(join(LAB, 'data', `${song}.json`), 'utf8'));
const from = a.from === undefined ? scene.span[0] : +a.from, to = a.to === undefined ? scene.span[1] : +a.to;
if (!(from >= scene.span[0] && to <= scene.span[1] && to > from)) throw new Error(`${from}–${to} s is outside the song span ${scene.span.join('–')} s`);

// the wall, on 3840 × 2160: the large picture full height on the left; on the right a header and two rows of six miniatures
const W = 3840, H = 2160, M = 72, bigH = H - 2 * M, bigW = bigH * 9 / 16, gx = M + bigW + 110, gw = W - M - gx;
const cols = 6, gap = 36, tw = Math.floor((gw - (cols - 1) * gap) / cols / 2) * 2, th = tw * 16 / 9, gapY = 100, gridY = H - M - (2 * th + gapY + 64);
const config = layout === 'wall'
  ? {layout, width: W, height: H, big: {x: M, y: M, w: bigW, h: bigH}, tile: {w: tw, h: th}, cols,
    grid: {x: gx, y: gridY, gap, gapY}, header: {x: gx, y: M, w: cols * tw + (cols - 1) * gap, h: gridY - M - 40}}
  : {layout, width: 1080, height: 1920, big: {x: 0, y: 0, w: 1080, h: 1920}};
Object.assign(config, {song, fps: FPS, from, to, cuts: plan.cuts, tiles: plan.themes, kicker: plan.kicker});

const out = resolve(a.out ?? join(LAB, 'showcase', `${song}-${layout}.mp4`)), count = Math.round((to - from) * FPS);
mkdirSync(dirname(out), {recursive: true});
const movie = out + '.partial.mp4', PREROLL = 0.5, start = Math.max(0, from - PREROLL);
const encoder = spawn('ffmpeg', ['-v', 'error', '-xerror', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', 'pipe:0',
  '-ss', String(start), '-t', String(to - start), '-i', resolve(ROOT, scene.audio), '-map', '0:v', '-map', '1:a', '-vf', CONVERT, ...VIDEO,
  '-af', `atrim=start=${from - start},asetpts=PTS-STARTPTS,apad`, ...AUDIO, '-t', String(count / FPS), '-movflags', '+faststart', movie],
  {stdio: ['pipe', 'ignore', 'inherit']});
const encoded = new Promise((done, fail) => encoder.once('close', code => code === 0 ? done() : fail(new Error(`FFmpeg exited ${code}`))));
let received = 0;
// the frame sink: the page (on :8770) posts each frame here, in order; CORS lets it
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method === 'GET' && req.url === '/config.json') {res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(config));}
  if (req.method !== 'POST' || req.url !== `/frame/${received}`) return res.writeHead(404).end(`expected frame ${received}`);
  const chunks = []; for await (const c of req) chunks.push(c);
  await new Promise((done, fail) => encoder.stdin.write(Buffer.concat(chunks), e => e ? fail(e) : done()));
  received++; res.end('ok');
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({args: ['--mute-audio']}), began = performance.now();
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.exposeFunction('progress', (n, total) => console.log(`frames ${n}/${total} · ${((performance.now() - began) / 1000).toFixed(0)} s`));
  await page.goto(`http://127.0.0.1:8770/generated/concept-lab/showcase.html?sink=http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.ready === true || false, null, {timeout: 120000}).catch(e => {throw new Error([...errors, e.message].join('\n'));});
  await page.evaluate(() => window.render());
  if (errors.length) throw new Error(errors.join('\n'));
  if (received !== count) throw new Error(`incomplete film: ${received}/${count} frames`);
  encoder.stdin.end(); await encoded;
  verifyVideo(movie, {width: config.width, height: config.height, frames: count});
  const lag = audioLag(movie, resolve(ROOT, scene.audio), from);
  if (lag !== null && Math.abs(lag) > 1) throw new Error(`audio ${lag.toFixed(2)} ms off the song`);
  renameSync(movie, out);
  console.log(`${out} · ${count} frames · audio ${lag?.toFixed(2)} ms · ${((performance.now() - began) / 1000).toFixed(0)} s`);
} finally {
  await browser.close(); encoder.kill(); server.close(); rmSync(movie, {force: true});
}
