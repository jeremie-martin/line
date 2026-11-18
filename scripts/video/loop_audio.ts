/** The recording a video plays, made to loop: it ends in step with the music that leads into its start, and blends into it.
 *
 * A song here is an excerpt of a longer recording. A video of it loops, so its end runs into its start. Played as cut, the music
 * stops dead and the opening comes from nothing. Two things make it one piece of music:
 *
 *   the loop point: the excerpts were cut at round seconds, so the end is rarely in step with the start. The recording ends up
 *     to MAX_TRIM seconds early, where the rhythm of its last seconds matches the rhythm of the recording's own lead-in (the
 *     seconds of the full recording just before the excerpt), as a loop is cut on a bar line. Where nothing matches clearly
 *     it ends as cut.
 *   the blend: the last `seconds` fade out while the lead-in fades in, at equal power: when the video starts again its first
 *     sample continues the lead-in, as the recording itself does.
 *
 * Nothing before the end changes and the first sample stays the excerpt's first, so every time of the specification holds; the
 * video is as long as this recording (scene.ts).
 *
 * An excerpt that starts at the recording's start, or whose full recording is not on this machine, has no lead-in: it ends as
 * cut, its last `seconds` fade out and the opening starts as written. To try by ear, not production: `mirror` gives such a
 * song its own opening played backwards as a lead-in, a swell that arrives exactly on the first sample.
 *
 * The band is computed from this recording (scene.ts), so it loops with the sound. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
export const LOOP_SECONDS = 0.5;
/** The most a recording is shortened to end in step, and the seconds of rhythm compared. */
export const MAX_TRIM = 3, COMPARED = 6;
const RATE = 48000, CHANNELS = 2, FRAME = RATE / 60; // FRAME: the samples of one video frame (write.ts)
/** A full recording an excerpt was cut from, or null when it is not on this machine. productions/<song>/source.json names the
 * file and the excerpt's start (tools/music/source.ts writes it); the file is looked for in LR_RECORDINGS, or in recordings/
 * here and then in the music library. A record without a file (a cut of a song that has none, tools/music/cut.ts) has none. */
export const recording = (file: string | undefined) => !file ? null : (process.env.LR_RECORDINGS ? [process.env.LR_RECORDINGS] : [join(ROOT, 'recordings'), join(homedir(), 'prog/double-pendulum/music/tracks')])
  .map(folder => join(folder, file)).find(path => existsSync(path)) ?? null;

/** Interleaved stereo samples of `seconds` of a file from `start`. */
export function decode(path: string, start = 0, seconds?: number): Float32Array {
  const bytes = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(start), ...(seconds === undefined ? [] : ['-t', String(seconds)]), '-i', path,
    '-ac', String(CHANNELS), '-ar', String(RATE), '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
}

/** `song` with its last `frames` frames faded out and `lead` (that many frames, or none) faded in over them, at equal power.
 * Interleaved samples; pure. */
export function blendTail(song: Float32Array, lead: Float32Array | null, frames: number, channels = CHANNELS): Float32Array {
  const out = Float32Array.from(song), total = song.length / channels, n = Math.min(frames, total);
  for (let i = 0; i < n; i++) {
    const angle = (i + 1) / n * Math.PI / 2, down = Math.cos(angle), up = Math.sin(angle);
    for (let c = 0; c < channels; c++) {const at = (total - n + i) * channels + c; out[at] = song[at] * down + (lead ? lead[i * channels + c] * up : 0);}
  }
  return out;
}

/** The seconds of the full recording that come just before the excerpt (up to `seconds`), or null when there are none. The
 * excerpt's place in the recording is found to the sample (the recorded start is a millisecond off on some files). */
function leadIn(song: string, excerpt: Float32Array, seconds: number): Float32Array | null {
  const record = join(ROOT, 'productions', song, 'source.json');
  if (!existsSync(record)) return null;
  const {file, sourceStartSeconds: start} = JSON.parse(readFileSync(record, 'utf8')), path = recording(file), MARGIN = 0.05;
  const frames = Math.round(Math.min(seconds, start - 2 * MARGIN) * RATE);
  if (!(frames >= LOOP_SECONDS * RATE) || !path) return null;
  const from = start - frames / RATE - MARGIN, chunk = decode(path, from, frames / RATE + 2 * MARGIN + 0.25), probe = Math.round(0.2 * RATE), expected = frames + Math.round(MARGIN * RATE);
  const mono = (a: Float32Array, i: number) => a[i * CHANNELS] + a[i * CHANNELS + 1];
  let best = -Infinity, at = expected;
  for (let lag = expected - Math.round(MARGIN * RATE); lag <= expected + Math.round(MARGIN * RATE); lag++) {
    let sum = 0; for (let i = 0; i < probe; i += 3) sum += mono(chunk, lag + i) * mono(excerpt, i);
    if (sum > best) {best = sum; at = lag;}
  }
  return chunk.slice((at - frames) * CHANNELS, at * CHANNELS);
}

export const HOP = 256, WINDOW = 2048; // frames at 48 kHz: 5.3 ms apart, 43 ms long
/** The rhythm of interleaved samples: how much the spectrum rises from one moment to the next (onsets), every HOP frames,
 * around its mean. */
export function rhythm(samples: Float32Array): Float64Array {
  const n = WINDOW / 2, hann = Float64Array.from({length: n}, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
  // the last window ends on the last sample, so two rhythms compare from their ends
  const room = samples.length / CHANNELS - WINDOW, count = room < 0 ? 0 : Math.floor(room / HOP) + 1, skip = room < 0 ? 0 : room % HOP, out = new Float64Array(Math.max(0, count - 1));
  let before = new Float64Array(n / 2), now = new Float64Array(n / 2);
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let f = 0; f < count; f++) {
    // mono at half the rate, windowed
    for (let i = 0; i < n; i++) {const at = (skip + f * HOP + 2 * i) * CHANNELS; re[i] = (samples[at] + samples[at + 1] + samples[at + 2] + samples[at + 3]) / 4 * hann[i]; im[i] = 0;}
    fft(re, im);
    let rise = 0;
    for (let b = 0; b < n / 2; b++) {now[b] = Math.log1p(50 * Math.hypot(re[b], im[b])); if (f && now[b] > before[b]) rise += now[b] - before[b];}
    if (f) out[f - 1] = rise;
    [before, now] = [now, before];
  }
  const mean = out.reduce((a, b) => a + b, 0) / (out.length || 1);
  return out.map(v => v - mean);
}
/** In-place radix-2 transform. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) {[re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]];}}
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size;
    for (let start = 0; start < n; start += size) for (let k = 0; k < size / 2; k++) {
      const c = Math.cos(angle * k), s = Math.sin(angle * k), a = start + k, b = a + size / 2, x = re[b] * c - im[b] * s, y = re[b] * s + im[b] * c;
      re[b] = re[a] - x; im[b] = im[a] - y; re[a] += x; im[a] += y;
    }
  }
}
/** How many frames early `song` should end so that its last seconds are in step with `lead`, the sound that leads into its
 * start (both interleaved), and how well the two rhythms then match (correlation, 1 = the same rhythm). The least trim whose
 * match is within 0.1 of the best; none when the best is under 0.5. Pure. */
export function loopPoint(song: Float32Array, lead: Float32Array, most = MAX_TRIM * RATE): {trim: number; match: number} {
  const target = rhythm(lead), n = target.length, tail = rhythm(song.subarray(Math.max(0, song.length - (lead.length / CHANNELS + most + WINDOW) * CHANNELS)));
  const norm = (a: Float64Array) => Math.sqrt(a.reduce((sum, v) => sum + v * v, 0)) || 1, targetNorm = norm(target), matches: number[] = [];
  for (let k = 0; k * HOP <= most && tail.length - k - n >= 0; k++) {
    const part = tail.subarray(tail.length - k - n, tail.length - k);
    let dot = 0; for (let i = 0; i < n; i++) dot += part[i] * target[i];
    matches.push(dot / (norm(part) * targetNorm));
  }
  const best = Math.max(...matches, 0);
  if (best < 0.5) return {trim: 0, match: matches[0] ?? 0};
  const k = matches.findIndex((m, i) => m >= best - 0.1 && m >= (matches[i - 1] ?? -1) && m >= (matches[i + 1] ?? -1));
  return {trim: k * HOP, match: matches[k]};
}

/** The looping recording of `song`, repository-relative (a WAV under generated/loop-audio, made once per recording and
 * setting): how its end was made ('lead-in', 'fade' or 'mirror'), its length in seconds, how much shorter than the excerpt
 * that is, and how well its end matches its lead-in. */
export function loopRecording(song: string, seconds = LOOP_SECONDS, mirror = false, trimmed = true): {audio: string; loop: 'lead-in' | 'fade' | 'mirror'; length: number; trim: number; match: number | null} {
  const excerptPath = join(ROOT, 'productions', song, 'audio.mp3'), record = join(ROOT, 'productions', song, 'source.json');
  const source = existsSync(record) ? JSON.parse(readFileSync(record, 'utf8')) : null, here = source && recording(source.file);
  const id = createHash('sha256').update(readFileSync(excerptPath)).update(JSON.stringify([seconds, RATE, here ? [source.sha256, source.sourceStartSeconds] : null, mirror, trimmed, MAX_TRIM, COMPARED, 3])).digest('hex').slice(0, 24);
  const audio = join('generated/loop-audio', `${song}-${id}.wav`), marker = join(ROOT, `${audio}.json`);
  if (!existsSync(marker)) {
    mkdirSync(join(ROOT, 'generated/loop-audio'), {recursive: true});
    const whole = decode(excerptPath), frames = Math.round(seconds * RATE), before = leadIn(song, whole, COMPARED);
    const point = before && trimmed ? loopPoint(whole, before) : {trim: 0, match: null}, 
    // a whole number of video frames, so the video and its sound end together
    excerpt = whole.subarray(0, Math.floor((whole.length / CHANNELS - point.trim) / FRAME) * FRAME * CHANNELS);
    const real = before && before.subarray(before.length - frames * CHANNELS);
    // the opening backwards: frame i of the lead-in is frame (frames - 1 - i) of the excerpt
    const lead = real ?? (mirror ? Float32Array.from({length: frames * CHANNELS}, (_, k) => excerpt[(frames - 1 - (k >> 1)) * CHANNELS + (k & 1)]) : null), mixed = blendTail(excerpt, lead, frames);
    const temporary = join(ROOT, `${audio}.${process.pid}.tmp.wav`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(RATE), '-ac', String(CHANNELS), '-i', 'pipe:0', '-c:a', 'pcm_s24le', temporary], {input: Buffer.from(mixed.buffer, mixed.byteOffset, mixed.byteLength)});
    renameSync(temporary, join(ROOT, audio));
    writeFileSync(marker, JSON.stringify({song, seconds, loop: real ? 'lead-in' : lead ? 'mirror' : 'fade', length: excerpt.length / CHANNELS / RATE, trim: point.trim / RATE, match: point.match}));
  }
  const {loop, length, trim, match} = JSON.parse(readFileSync(marker, 'utf8'));
  return {audio, loop, length, trim, match};
}
