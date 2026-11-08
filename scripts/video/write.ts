/** Scene + look → a finished MP4, in one pass: the picture (picture.js) is drawn in a headless browser frame by frame at song
 * time t = from + i/60, each frame goes once, losslessly, to one FFmpeg, and the song's own audio is encoded once in the same
 * FFmpeg. Nothing is encoded twice and nothing is delayed: frame 0 is song time `from`, the first audio sample too.
 *
 * Every video is written under the one encoding standard (encoding.ts). Each written video is checked: frame count, size, rate
 * and tags as declared, and the audio within 1 ms of the song (measured by cross-correlation on a second that carries sound). */
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {execFile, execFileSync, spawn} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {promisify} from 'node:util';
import {chromium} from 'playwright';
import type {Scene} from './scene.ts';
import type {Look} from './look.js';
import {AUDIO, CONVERT, VIDEO} from './encoding.ts';

const ROOT = resolve(import.meta.dirname, '../..');
export const FPS = 60;
/** Seconds of the recording decoded before `from` and dropped. After a seek an MP3 decoder lacks the earlier frames its first
 * frame borrows bits from (the bit reservoir), so the first 25–40 ms of a video starting mid-song came out wrong; decoding from
 * earlier and trimming gives the song's own samples. */
const PREROLL = 0.5;

/** The vendored renderer bundle (scripts/gallery/build_renderer.mjs: native.js, worker.js), built once per process from the
 * current sources, without blocking the event loop the concurrent writers of a process share. */
let bundle: Promise<Map<string, Buffer>> | undefined;
const rendererBundle = () => bundle ??= (async () => {
  const dir = mkdtempSync(join(tmpdir(), 'line-renderer-'));
  try {
    await promisify(execFile)(process.execPath, ['scripts/gallery/build_renderer.mjs', `--out=${dir}`], {cwd: ROOT});
    return new Map(['native.js', 'worker.js'].map(name => [name, readFileSync(join(dir, name))] as const));
  } finally {rmSync(dir, {recursive: true, force: true});}
})().catch(error => {bundle = undefined; throw error;});
export type WriteOptions = {
  scene: Scene; look: Look; out: string;
  /** Song seconds; the whole ride by default. */
  from?: number; to?: number;
  /** Frame width in pixels (the picture is 9:16), 1080 by default. */
  width?: number;
  log?: (message: string) => void;
};

/** Frame size for a 9:16 picture `width` pixels wide; both even. */
export function frameSize(width: number) {
  const height = width * 16 / 9;
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || width % 2 || height % 2) throw new Error(`No 9:16 frame of even size is ${width} px wide`);
  return {width, height};
}
/** The frames of [from, to): frame i shows song time from + i/FPS. */
export function frameCount(from: number, to: number) {
  if (!(Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from)) throw new Error(`Invalid time range ${from}–${to}`);
  const count = Math.round((to - from) * FPS);
  if (count < 1) throw new Error(`The time range ${from}–${to} is shorter than one frame`);
  return count;
}

const PAGE = `<!doctype html><canvas></canvas><script type="module">
import * as N from './renderer/native.js';
import {createPicture} from './video/picture.js';
window.render = async ({look, from, count, width, height}) => {
  const scene = await (await fetch('scene.json')).json();
  const canvas = document.querySelector('canvas'); canvas.width = width; canvas.height = height;
  const [replay, sheet] = await Promise.all([N.replay(scene.track, scene.trace), N.loadSheet('bosh.svg')]);
  const picture = createPicture(canvas, scene, replay, sheet, N.riderPainter());
  for (let i = 0; i < count; i++) {
    picture.draw(from + i / ${FPS}, look);
    const blob = await new Promise((done, fail) => canvas.toBlob(b => b ? done(b) : fail(new Error('Frame capture failed')), 'image/png'));
    const response = await fetch('frame/' + i, {method: 'POST', body: blob});
    if (!response.ok) throw new Error(await response.text());
    if ((i + 1) % 300 === 0) await window.progress(i + 1);
  }
};
</script>`;

/** Write the video; returns the number of frames. The output appears only when complete and verified. */
export async function writeVideo({scene, look, out, from = 0, to = scene.duration, width = 1080, log = console.log}: WriteOptions): Promise<number> {
  const {height} = frameSize(width), count = frameCount(from, to), began = performance.now();
  const output = resolve(out);
  mkdirSync(dirname(output), {recursive: true});
  const scratch = mkdtempSync(join(dirname(output), '.video-')), movie = join(scratch, 'video.mp4');
  const token = '/' + randomUUID() + '/', assets = new Map<string, {type: string; bytes: Buffer}>();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined, encoder: ReturnType<typeof spawn> | undefined;
  let received = 0, failure: Error | undefined;
  const server = createServer(async (req, res) => {
    try {
      const asset = req.method === 'GET' ? assets.get(req.url!) : undefined;
      if (asset) {res.setHeader('Content-Type', asset.type); res.end(asset.bytes); return;}
      if (req.method !== 'POST' || req.url !== `${token}frame/${received}` || received >= count) {res.writeHead(404).end(); return;}
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) {size += chunk.length; if (size > width * height * 5 + 65536) throw new Error('Oversized video frame'); chunks.push(chunk);}
      if (failure) throw failure;
      const png = Buffer.concat(chunks);
      if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height)
        throw new Error('Invalid video frame');
      await new Promise<void>((done, fail) => encoder!.stdin!.write(png, error => error ? fail(error) : done()));
      received++; res.end('ok');
    } catch (error) {failure = error as Error; res.writeHead(500).end(String(error));}
  });
  try {
    const file = (path: string, type = 'text/javascript') => ({type, bytes: readFileSync(path)});
    assets.set(token, {type: 'text/html', bytes: Buffer.from(PAGE)});
    assets.set(token + 'scene.json', {type: 'application/json', bytes: Buffer.from(JSON.stringify(scene))});
    assets.set(token + 'bosh.svg', file(join(ROOT, 'mirror/_v2153.0/bosh-sprite.svg'), 'image/svg+xml'));
    for (const [name, bytes] of await rendererBundle()) assets.set(token + 'renderer/' + name, {type: 'text/javascript', bytes});
    for (const name of ['picture.js', 'camera.js', 'intensity.js', 'palettes.js']) assets.set(token + 'video/' + name, file(join(ROOT, 'scripts/video', name)));
    // the audio is decoded from PREROLL before `from` and trimmed back to `from`, so its first samples are the song's own
    const start = Math.max(0, from - PREROLL);
    encoder = spawn('ffmpeg', ['-v', 'error', '-xerror', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', 'pipe:0',
      '-ss', String(start), '-t', String(to - start), '-i', resolve(ROOT, scene.audio),
      '-map', '0:v', '-map', '1:a', '-vf', CONVERT, ...VIDEO, '-af', `atrim=start=${from - start},asetpts=PTS-STARTPTS,apad`, ...AUDIO,
      '-t', String(count / FPS), '-movflags', '+faststart', movie], {stdio: ['pipe', 'ignore', 'pipe']});
    let encoderErrors = '';
    encoder.stderr!.on('data', data => {encoderErrors = (encoderErrors + data).slice(-8192);});
    encoder.stdin!.on('error', error => {failure = error;});
    const complete = new Promise<void>((done, fail) => {
      encoder!.once('error', fail);
      encoder!.once('close', code => code === 0 ? done() : fail(new Error(`FFmpeg exited ${code}: ${encoderErrors}`)));
    });
    void complete.catch(error => {failure = error;}); // startup and pipe failures can come before the browser is ready
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const port = (server.address() as {port: number}).port;
    const env = {...process.env};
    // a stale SSH-forwarded DISPLAY makes Chromium's headless rendering try X and fail
    if (env.LR_SCRUB_DISPLAY === '1' || (env.LR_KEEP_DISPLAY !== '1' && /^(localhost|127\.0\.0\.1|\[?::1\]?):/.test(env.DISPLAY ?? ''))) {delete env.DISPLAY; delete env.XAUTHORITY;}
    browser = await chromium.launch({env, args: ['--mute-audio']});
    const page = await browser.newPage(), errors: string[] = [], refused: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if (response.status() >= 400) refused.push(`${response.status()} ${response.url()}`);});
    await page.exposeFunction('progress', (frames: number) => log(`frames ${frames}/${count} · ${((performance.now() - began) / 1000).toFixed(0)} s`));
    await page.goto(`http://127.0.0.1:${port}${token}`);
    // a picture that cannot load says why (a script error, a missing module), not only that the wait timed out
    await page.waitForFunction(() => 'render' in window).catch(error => {throw new Error(['The picture did not load', ...errors, ...refused, error.message].join('\n'));});
    await page.evaluate(options => (window as any).render(options), {look, from, count, width, height});
    if (errors.length) throw new Error(errors.join('\n'));
    if (failure) throw failure;
    if (received !== count) throw new Error(`Incomplete video: ${received}/${count} frames`);
    encoder.stdin!.end(); await complete;
    verifyVideo(movie, {width, height, frames: count});
    const lag = audioLag(movie, resolve(ROOT, scene.audio), from);
    if (lag !== null && Math.abs(lag) > 1) throw new Error(`Audio is ${lag.toFixed(2)} ms off the song`);
    renameSync(movie, output);
    log(`${output} · ${count} frames · audio ${lag === null ? 'not measured (silent, or too short)' : `${lag.toFixed(2)} ms`} · ${((performance.now() - began) / 1000).toFixed(0)} s`);
    return count;
  } finally {
    await browser?.close().catch(() => {});
    encoder?.kill(); server.closeAllConnections(); server.close();
    rmSync(scratch, {recursive: true, force: true});
  }
}

/** Check a written video against the standard: size, rate, frame count, pixel format and colour tags, and an audio stream. */
export function verifyVideo(path: string, expected: {width: number; height: number; frames: number}) {
  const {streams} = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-show_entries',
    'stream=codec_type,width,height,avg_frame_rate,nb_read_packets,pix_fmt,color_space,color_primaries,color_transfer,color_range', '-of', 'json', path], {encoding: 'utf8'}));
  const v = streams.find((s: any) => s.codec_type === 'video'), wrong = [];
  if (!v) throw new Error(`${path}: no video stream`);
  if (v.width !== expected.width || v.height !== expected.height) wrong.push(`size ${v.width}×${v.height}`);
  if (v.avg_frame_rate !== `${FPS}/1`) wrong.push(`rate ${v.avg_frame_rate}`);
  if (Number(v.nb_read_packets) !== expected.frames) wrong.push(`${v.nb_read_packets} frames`);
  for (const [key, want] of [['pix_fmt', 'yuv420p'], ['color_space', 'bt709'], ['color_primaries', 'bt709'], ['color_transfer', 'bt709'], ['color_range', 'tv']])
    if (v[key] !== want) wrong.push(`${key} ${v[key]}`);
  if (!streams.some((s: any) => s.codec_type === 'audio')) wrong.push('no audio');
  if (wrong.length) throw new Error(`${path} does not match the video standard: ${wrong.join(', ')}`);
}

const RATE = 48000;
const pcm = (path: string, from: number, seconds: number) => {
  const bytes = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0, from)), '-t', String(seconds), '-i', path, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], {maxBuffer: 1 << 28});
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length >> 2);
};
/** The lag (ms; positive = late) at which `clip` best matches `song`, searched within ±`range` samples of zero. */
export function bestLag(clip: Float32Array, song: Float32Array, range: number): number {
  let best = 0, bestDot = -Infinity;
  for (let lag = -range; lag <= range; lag++) {
    let dot = 0; for (let i = 0; i < clip.length; i++) dot += clip[i] * song[i + range - lag];
    if (dot > bestDot) {bestDot = dot; best = lag;}
  }
  return best * 1000 / RATE;
}
/** How late the video's audio is against the song, in ms, measured on one second of it: its middle, or, when that second is
 * silent, the second a quarter or three quarters of the way in. null when all three are silent (nothing to align) or the video
 * is under 0.3 s (too little to align). */
export function audioLag(video: string, song: string, from: number): number | null {
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], {encoding: 'utf8'}));
  const window = Math.min(1, duration - 0.2), range = Math.round(0.05 * RATE), pad = range / RATE;
  if (!(window >= 0.1)) return null;
  for (const where of [0.5, 0.25, 0.75]) {
    const at = (duration - window) * where, clip = pcm(video, at, window);
    if (clip.reduce((sum, v) => sum + v * v, 0) / clip.length < 1e-7) continue;
    const song0 = from + at - pad, reference = pcm(song, song0, window + 2 * pad);
    // before the song's start there is nothing to decode: shift the reference so index `range` is still song time from + at
    const missing = Math.round(Math.max(0, -song0) * RATE), aligned = new Float32Array(clip.length + 2 * range);
    aligned.set(reference.subarray(0, aligned.length - missing), missing);
    return bestLag(clip, aligned, range);
  }
  return null;
}
