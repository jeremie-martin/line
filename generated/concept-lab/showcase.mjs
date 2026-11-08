// A film of many themes over one ride: node generated/concept-lab/showcase.mjs set=twelve|seventeen|… [layout=solo|wall]
//   [song=circus] [from=0 to=…] [out=FILE.mp4]
// The frames are composed in showcase.html from the video renderer's own picture (served by the review server, :8770) and
// encoded once here, under the repository's encoding standard, then checked like every video (frames, size, tags, audio
// within 1 ms). The themes play without their drop (a cut inside a drop treatment would show neither). The cuts: the song in
// equal parts, each cut on a section start when one is near, otherwise on the strongest hit near its place.
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
const layout = a.layout ?? 'solo', song = a.song ?? 'circus', set = a.set ?? 'twelve';
if (!['wall', 'solo'].includes(layout)) throw new Error(`layout=wall|solo, not ${layout}`);
// The sets, in the order shown: light and dark alternating, a strong look first.
const SETS = {
  twelve: ['hokusai', 'plum', 'celadon', 'oldrose', 'wisteria', 'ultramarine', 'paper', 'dune', 'aubergine', 'aconite', 'prussian', 'black'],
  seventeen: ['hokusai', 'plum', 'seashell', 'oldrose', 'celadon', 'apricot', 'kraft', 'ultramarine', 'peony', 'cyanotype', 'wisteria', 'aconite',
    'dune', 'black', 'prussian', 'aubergine', 'paper'],
};
const themes = SETS[set]; if (!themes) throw new Error(`set=${Object.keys(SETS).join('|')}`);
if (layout === 'wall' && themes.length > 12) throw new Error('the wall holds twelve miniatures; use layout=solo');
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
/** n cuts over [from, to): every part's start on a section start within a third of a part, else the strongest hit there. */
function cutsFor(n) {
  const a0 = scene.account, o = scene.timing.offset, part = (to - from) / n, near = part / 3;
  const hits = a0.matches.map(m => ({t: a0.events[m.event].peak / 40 - o, s: a0.events[m.event].strength}));
  return Array.from({length: n}, (_, k) => {
    if (k === 0) return from;
    const want = from + k * part, section = scene.phases.find(p => Math.abs(p.t0 - want) < near);
    const at = section ? section.t0 : want, hit = hits.filter(h => Math.abs(h.t - at) < (section ? 0.15 : near)).sort((x, y) => y.s - x.s)[0];
    return +(hit ? hit.t : at).toFixed(3);
  });
}
const title = scene.title.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
Object.assign(config, {song, fps: FPS, from, to, cuts: cutsFor(themes.length), tiles: themes, kicker: `${title} · one ride, ${themes.length} looks`});

const out = resolve(a.out ?? join(LAB, 'showcase', `${song}-${set}-${layout}.mp4`)), count = Math.round((to - from) * FPS);
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
