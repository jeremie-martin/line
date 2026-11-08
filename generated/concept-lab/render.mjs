// Render a concept film: node generated/concept-lab/render.mjs song=los c=together [m=...] out=FILE.mp4 [from=0 to=dur]
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync, renameSync, rmSync} from 'node:fs';
import {dirname} from 'node:path';
const a = Object.fromEntries(process.argv.slice(2).map(s => {const i = s.indexOf('='); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];}));
const song = a.song ?? 'petrunko', c = a.c ?? 'today', out = a.out ?? `generated/concept-lab/films/${song}-${c}.mp4`;
// Written under a temporary name and moved into place only when complete: a failed render must never leave a film that the
// films*.sh scripts would then keep as "existing".
const part = out + '.part';
mkdirSync(dirname(out), {recursive: true});
const b = await chromium.launch({args: ['--mute-audio']});
const started = Date.now();
let ff = null, ok = false;
try {
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=${song}&c=${c}&t=0${a.m ? '&m=' + a.m : ''}${a.rides ? '&rides=' + a.rides : ''}`);
  await p.waitForFunction(() => window.__ready === true || !!window.__loadError, null, {timeout: 60000});
  const meta = await p.evaluate(() => ({duration: window.__duration, audio: window.__audio, error: window.__loadError, state: window.__labState()}));
  if (meta.error) throw new Error(`${song}: ${meta.error}`);
  // The lab quietly falls back to the first look and to Petrunko, and drops unknown m= options; a film must show what its name says.
  const wrong = [meta.state.preset !== c && `c=${c} (no such look)`, meta.state.song !== song && `song=${song}`,
    ...(a.m ?? '').split(',').filter(Boolean).map(kv => {const [k, v] = kv.split(':'); return meta.state.mix[k] !== v && `m ${kv}`;})].filter(Boolean);
  if (wrong.length) throw new Error('not in the lab: ' + wrong.join(', '));
  const from = +(a.from ?? 0), to = Math.min(+(a.to ?? meta.duration), meta.duration);
  const frames = Math.round((to - from) * 60);
  ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-',
    '-ss', String(from), '-t', String(to - from), '-i', meta.audio.replace(/^\//, ''),
    '-map', '0:v', '-map', '1:a', '-af', 'apad', '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '192k', '-t', String(to - from), '-movflags', '+faststart', '-f', 'mp4', part], {stdio: ['pipe', 'inherit', 'inherit']});
  const done = new Promise((res, rej) => {ff.on('error', rej); ff.on('close', code => code ? rej(new Error('ffmpeg ' + code)) : res());});
  for (let i = 0; i < frames; i++) {
    const url = await p.evaluate(t => window.__renderAt(t), from + i / 60);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done;
  if (errors.length) throw new Error(errors.join('\n'));
  renameSync(part, out); ok = true;
  console.log(`${out}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
} finally {
  if (!ok) {ff?.kill('SIGKILL'); rmSync(part, {force: true});}
  await b.close();
}
