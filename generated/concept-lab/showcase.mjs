// A film of many themes over one ride: node generated/concept-lab/showcase.mjs [set=collection | themes=KEY,KEY,…] [layout=solo|wall]
//   [song=circus] [from=0 to=…] [bar=1.6] [out=FILE.mp4]
// The frames are composed in showcase.html from the video renderer's own picture (served by the review server, :8770) and
// encoded once here, under the repository's encoding standard, then checked like every video (frames, size, tags, audio
// within 1 ms). The themes play without their drop (a cut inside a drop treatment would show neither).
// set=collection (the default): every production theme, cut on the music (see collection()). themes=…: a hand list, the song
// in equal parts, each cut on a section start when one is near, otherwise on the strongest hit near its place.
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdirSync, readFileSync, renameSync, rmSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {AUDIO, CONVERT, VIDEO} from '../../scripts/video/encoding.ts';
import {FPS, audioLag, verifyVideo} from '../../scripts/video/write.ts';
import {THEMES} from '../../scripts/video/look.js';
import {SCHEMES} from '../../scripts/video/palettes.js';
import {toOklch} from '../../scripts/video/colour.js';
import {dropSpan} from '../../scripts/video/theme.js';

const ROOT = resolve(import.meta.dirname, '../..'), LAB = import.meta.dirname;
const a = Object.fromEntries(process.argv.slice(2).map(s => {const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)];}));
const layout = a.layout ?? 'solo', song = a.song ?? 'circus', set = a.themes ? 'hand' : a.set ?? 'collection';
if (!['wall', 'solo'].includes(layout)) throw new Error(`layout=wall|solo, not ${layout}`);
if (set !== 'hand' && set !== 'collection') throw new Error('set=collection, or themes=KEY,KEY,…');
const scene = JSON.parse(readFileSync(join(LAB, 'data', `${song}.json`), 'utf8'));
const from = a.from === undefined ? scene.span[0] : +a.from, to = a.to === undefined ? scene.span[1] : +a.to;
if (!(from >= scene.span[0] && to <= scene.span[1] && to > from)) throw new Error(`${from}–${to} s is outside the song span ${scene.span.join('–')} s`);
const hits = scene.account.matches.map(m => ({t: scene.account.events[m.event].peak / 40 - scene.timing.offset, s: scene.account.events[m.event].strength}));
/** The strongest hit within `w` s of t, else t. */
const snap = (t, w = 0.15) => +(hits.filter(h => Math.abs(h.t - t) < w).sort((x, y) => y.s - x.s)[0]?.t ?? t).toFixed(3);

/** n cuts over [from, to): every part's start on a section start within a third of a part, else the strongest hit there. */
function cutsFor(n) {
  const part = (to - from) / n, near = part / 3;
  return Array.from({length: n}, (_, k) => {
    if (k === 0) return from;
    const want = from + k * part, section = scene.phases.find(p => Math.abs(p.t0 - want) < near);
    return snap(section ? section.t0 : want, section ? 0.15 : near);
  });
}

// The collection film: every production theme at least once, on the song's own grid.
// · The cuts: section starts and the drop's edges (the renderer's own, dropSpan), each part then cut every two bars, every bar in
//   the drop (it moves faster), each cut on the strongest hit within 0.15 s. Circus Minimus: 150 BPM, a bar is 1.6 s.
// · Only dark themes (paper OKLab L < 0.5) in the drop; with a sun, the rider sits lower (camera.js), so a cut between a sun
//   and no sun jumps. The themes without a sun open the film (the first section) and close it (the last eight bars, ending on
//   the one it opened with); the themes with a sun fill the middle, the dark ones the drop: two jumps, both on section starts.
// · Within a group, each next theme is the one most unlike the one before (paper and bars, OKLab), so every cut shows.
function collection() {
  const bar = +(a.bar ?? {circus: 1.6}[song]), drop = dropSpan(scene.drop, hits)?.map(t => +t.toFixed(3));
  if (!(bar > 0) || !drop) throw new Error('set=collection needs the song\'s drop and bar=SECONDS');
  const edges = [from, ...scene.phases.map(p => snap(p.t0)), ...drop].filter(t => t >= from && t < to - bar).sort((x, y) => x - y)
    .filter((t, i, all) => i === 0 || t - all[i - 1] > bar / 2);
  const inDrop = t => t >= drop[0] && t < drop[1], cuts = [];
  edges.forEach((e, i) => {
    const end = edges[i + 1] ?? to, step = (inDrop(e) ? 1 : 2) * bar;
    for (let t = e; t < end - step / 2; t += step) cuts.push(t === e ? e : snap(t));
  });
  const scheme = id => SCHEMES[THEMES[id].look.scheme], dark = id => toOklch(scheme(id).paper).L < 0.5, sun = id => THEMES[id].look.top === 'sun';
  const lab = hex => {const {L, C, h} = toOklch(hex); return [L, C * Math.cos(h), C * Math.sin(h)];};
  const seen = id => [scheme(id).paper, scheme(id).mass].flatMap(lab), apart = (x, y) => {const q = seen(y); return Math.hypot(...seen(x).map((v, i) => v - q[i]));};
  const unlike = ids => {const out = ids.slice(0, 1), rest = ids.slice(1); while (rest.length) out.push(rest.splice(rest.reduce((b, x, i) => apart(x, out.at(-1)) > apart(rest[b], out.at(-1)) ? i : b, 0), 1)[0]); return out;};
  const keys = Object.keys(THEMES), plain = unlike(keys.filter(k => !sun(k)).sort((x, y) => dark(x) - dark(y)));
  const darkSun = unlike(keys.filter(k => sun(k) && dark(k))), dropSlots = cuts.filter(inDrop).length;
  const middle = unlike(keys.filter(k => sun(k) && !dark(k))).concat(darkSun.slice(dropSlots));
  const closes = to - 8 * bar - bar / 2, opens = snap(scene.phases[1].t0), count = {plain: 0, middle: 0, drop: 0};
  const tiles = cuts.map((t, i) => {
    if (i === cuts.length - 1 && plain.length) return plain[0];
    if (t < opens || t >= closes) return count.plain++ === 0 ? plain[0] : plain[1 + (count.plain - 2) % (plain.length - 1)];
    if (inDrop(t)) return darkSun[count.drop++ % darkSun.length];
    return middle[count.middle++ % middle.length];
  });
  const missing = keys.filter(k => !tiles.includes(k)), light = tiles.filter((id, i) => inDrop(cuts[i]) && !dark(id));
  if (missing.length || light.length) throw new Error(`collection: missing ${missing}, light in the drop ${light}`);
  cuts.forEach((t, i) => console.log(`${t.toFixed(3).padStart(7)} s  ${inDrop(t) ? 'drop' : '    '}  ${sun(tiles[i]) ? 'sun ' : '    '}  ${dark(tiles[i]) ? 'dark ' : 'light'}  ${tiles[i]}`
    + (i && sun(tiles[i]) !== sun(tiles[i - 1]) ? '  ← jump (sun ↔ no sun)' : '')));
  return {cuts, tiles};
}
const film = set === 'collection' ? collection() : {tiles: a.themes.split(','), cuts: cutsFor(a.themes.split(',').length)};
for (const id of film.tiles) if (!Object.hasOwn(THEMES, id)) throw new Error(`Unknown theme ${id} (themes: ${Object.keys(THEMES).join(', ')})`);
if (layout === 'wall' && film.tiles.length > 12) throw new Error('the wall holds twelve miniatures; use layout=solo');

// the wall, on 3840 × 2160: the large picture full height on the left; on the right a header and two rows of six miniatures
const W = 3840, H = 2160, M = 72, bigH = H - 2 * M, bigW = bigH * 9 / 16, gx = M + bigW + 110, gw = W - M - gx;
const cols = 6, gap = 36, tw = Math.floor((gw - (cols - 1) * gap) / cols / 2) * 2, th = tw * 16 / 9, gapY = 100, gridY = H - M - (2 * th + gapY + 64);
const config = layout === 'wall'
  ? {layout, width: W, height: H, big: {x: M, y: M, w: bigW, h: bigH}, tile: {w: tw, h: th}, cols,
    grid: {x: gx, y: gridY, gap, gapY}, header: {x: gx, y: M, w: cols * tw + (cols - 1) * gap, h: gridY - M - 40}}
  : {layout, width: 1080, height: 1920, big: {x: 0, y: 0, w: 1080, h: 1920}};
const title = scene.title.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
Object.assign(config, {song, fps: FPS, from, to, ...film, kicker: `${title} · one ride, ${new Set(film.tiles).size} looks`});

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
