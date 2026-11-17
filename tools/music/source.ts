/** Where a song's excerpt sits in its full recording: writes productions/<song>/source.json.
 *
 *   node tools/music/source.ts --song=tiki_tiki_48s RECORDING [RECORDING …]
 *
 * A song's audio.mp3 is an excerpt of a longer recording. A video loops into the music that leads into the excerpt
 * (scripts/video/loop_audio.ts), which needs the full recording and the second where the excerpt starts. This finds that
 * second by matching the excerpt's sound inside each recording given, keeps the best, refuses when none is the same recording
 * at the same speed, links the recording into recordings/ (git-ignored) and writes the record. Nothing else reads the record
 * for this; a song without one still works and simply fades at its end. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {fft} from '../../scripts/video/loop_audio.ts';

const ROOT = resolve(import.meta.dirname, '../..'), RATE = 8000, PROBE = 20, SKIP = 0.5, ENOUGH = 0.6;
const mono = (path: string, start = 0, seconds?: number) => {
  const bytes = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(start), ...(seconds === undefined ? [] : ['-t', String(seconds)]), '-i', path, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
};
/** Where `probe` sits in `whole` (samples) and how well it matches there (1 = the same sound). */
export function locate(whole: Float32Array, probe: Float32Array): {at: number; match: number} {
  let size = 1; while (size < whole.length + probe.length) size <<= 1;
  const a = new Float64Array(size), ai = new Float64Array(size), b = new Float64Array(size), bi = new Float64Array(size);
  a.set(whole); b.set(probe);
  fft(a, ai); fft(b, bi);
  // correlation = inverse transform of A · conj(B); the inverse through the forward transform of the conjugate
  for (let i = 0; i < size; i++) {const re = a[i] * b[i] + ai[i] * bi[i], im = ai[i] * b[i] - a[i] * bi[i]; a[i] = re; ai[i] = -im;}
  fft(a, ai);
  const energy = new Float64Array(whole.length + 1); for (let i = 0; i < whole.length; i++) energy[i + 1] = energy[i] + whole[i] * whole[i];
  const own = Math.sqrt(probe.reduce((sum, v) => sum + v * v, 0)) || 1;
  let best = {at: 0, match: -1};
  for (let lag = 0; lag + probe.length <= whole.length; lag++) {
    const match = a[lag] / size / (own * Math.sqrt(energy[lag + probe.length] - energy[lag] || 1));
    if (match > best.match) best = {at: lag, match};
  }
  return best;
}

if (import.meta.main) {
  const song = process.argv.find(a => a.startsWith('--song='))?.slice(7), candidates = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!song || !candidates.length) throw new Error('Usage: node tools/music/source.ts --song=SONG RECORDING [RECORDING …]');
  const folder = join(ROOT, 'productions', song), excerpt = mono(join(folder, 'audio.mp3')), seconds = excerpt.length / RATE;
  const probe = excerpt.subarray(SKIP * RATE, Math.min(excerpt.length, (SKIP + PROBE) * RATE));
  let found: {path: string; start: number; match: number; end: number} | null = null;
  for (const path of candidates.map(c => resolve(c))) {
    const whole = mono(path), {at, match} = locate(whole, probe), start = at / RATE - SKIP;
    // the excerpt's last seconds, where a single contiguous cut would put them
    const tail = excerpt.subarray(excerpt.length - 10 * RATE), from = Math.round((start + seconds - 10) * RATE), there = whole.subarray(Math.max(0, from), Math.max(0, from) + tail.length);
    const dot = (x: Float32Array, y: Float32Array) => {let sum = 0; for (let i = 0; i < Math.min(x.length, y.length); i++) sum += x[i] * y[i]; return sum;};
    const end = there.length === tail.length ? dot(tail, there) / Math.sqrt(dot(tail, tail) * dot(there, there) || 1) : 0;
    console.log(`${basename(path)}: starts at ${start.toFixed(3)} s, match ${match.toFixed(2)} at its start, ${end.toFixed(2)} at its end`);
    if (match >= ENOUGH && (!found || match > found.match)) found = {path, start, match, end};
  }
  if (!found) throw new Error(`None of these is ${song}'s recording at the same speed (a match of ${ENOUGH} is needed).`);
  mkdirSync(join(ROOT, 'recordings'), {recursive: true});
  const file = basename(found.path), link = join(ROOT, 'recordings', file);
  if (!existsSync(link)) symlinkSync(found.path, link);
  const record = {file, sha256: createHash('sha256').update(readFileSync(found.path)).digest('hex'), sourceStartSeconds: Math.max(0, Math.round(found.start * 1000) / 1000), sourceEndSeconds: Math.round((found.start + seconds) * 1000) / 1000,
    match: {start: Math.round(found.match * 100) / 100, end: Math.round(found.end * 100) / 100}, ...(found.end < ENOUGH ? {note: 'the excerpt’s end does not match the recording there: it is not one contiguous cut, or it fades'} : {})};
  writeFileSync(join(folder, 'source.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(`wrote productions/${song}/source.json: ${file} from ${record.sourceStartSeconds} s`);
}
