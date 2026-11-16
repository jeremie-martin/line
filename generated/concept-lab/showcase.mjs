// A showcase film: one ride, the theme changing on the music. Each part is an ordinary video of that theme over its span
// (scripts/video.ts), so the picture is production's; the parts are joined without re-encoding and the song laid under them.
//   node generated/concept-lab/showcase.mjs study=DIR cuts=0:paperPrint,6.9:hokusai,… [zoom=ID] [wider=1.1 | wider-near=1.1]
//     [width=1080] out=FILE.mp4
// cuts: song seconds and the theme from there on, in order; each is moved to the nearest video frame. Themes with a sun or a
// moon keep the rider at one height across cuts.
import {execFileSync, spawn} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {AUDIO} from '../../scripts/video/encoding.ts';
import {FPS, audioLag, verifyVideo, frameSize} from '../../scripts/video/write.ts';

const a = Object.fromEntries(process.argv.slice(2).map(s => {const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)];}));
if (!a.study || !a.cuts || !a.out) throw new Error('study=DIR cuts=T:THEME,… out=FILE.mp4');
const out = resolve(a.out), work = out.replace(/\.mp4$/, '.parts'), width = +(a.width ?? 1080);
const manifest = JSON.parse(readFileSync(join(a.study, 'manifest.json'), 'utf8')), cell = manifest.cells[0];
const record = JSON.parse(readFileSync(join(a.study, cell.path), 'utf8')), song = record.case.id, end = record.case.durationFrames / 40;
const frame = t => Math.round(t * FPS) / FPS;
const cuts = a.cuts.split(',').map(s => {const [t, theme] = s.split(':'); return {t: frame(+t), theme};});
cuts.forEach((c, i) => {if (!(c.t >= 0 && c.t < end && (i === 0 ? c.t === 0 : c.t > cuts[i - 1].t))) throw new Error(`cut ${i} at ${c.t} s: cuts start at 0 and rise, inside ${end} s`);});
rmSync(work, {recursive: true, force: true}); mkdirSync(work, {recursive: true});
const trial = [a.zoom ? `--zoom=${a.zoom}` : null, a.wider ? `--wider=${a.wider}` : null, a['wider-near'] ? `--wider-near=${a['wider-near']}` : null].filter(Boolean);
const part = (c, i) => new Promise((done, fail) => {
  const file = join(work, `${String(i).padStart(2, '0')}.mp4`), to = cuts[i + 1]?.t ?? end, log = [];
  const child = spawn(process.execPath, ['scripts/video.ts', `--study=${a.study}`, `--look=${c.theme}`, ...trial, `--from=${c.t}`, `--to=${to}`, `--width=${width}`, `--out=${file}`]);
  child.stdout.on('data', d => log.push(d)); child.stderr.on('data', d => log.push(d));
  child.on('exit', code => code ? fail(new Error(`${c.theme} ${c.t}–${to} s: ${Buffer.concat(log).toString().slice(-400)}`)) : done(file));
});
// a few at a time: each part runs its own browser
const files = []; for (let i = 0; i < cuts.length; i += 6) files.push(...await Promise.all(cuts.slice(i, i + 6).map((c, k) => part(c, i + k))));
writeFileSync(join(work, 'list.txt'), files.map(f => `file '${f}'`).join('\n') + '\n');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-i', `productions/${song}/audio.mp3`,
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...AUDIO, '-t', String(end), '-movflags', '+faststart', out]);
const size = frameSize(width);
verifyVideo(out, {width: size.width, height: size.height, frames: Math.round(end * FPS)});
const lag = audioLag(out, `productions/${song}/audio.mp3`, 0);
if (lag === null || Math.abs(lag) > 0.001) throw new Error(`the audio is ${lag} s from the song`);
writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({of: {study: resolve(a.study), id: cell.id}, cuts, zoom: a.zoom ?? null,
  ...(a.wider ? {wider: +a.wider} : {}), ...(a['wider-near'] ? {widerNear: +a['wider-near']} : {}), width}, null, 1) + '\n');
rmSync(work, {recursive: true, force: true});
console.log(`${out}: ${cuts.length} themes, ${end} s, audio ${(lag * 1000).toFixed(2)} ms from the song`);
