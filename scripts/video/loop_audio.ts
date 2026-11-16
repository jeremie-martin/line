/** The recording a video plays, made to loop: its last moment blends into the sound that leads into its first.
 *
 * A song here is an excerpt of a longer recording. A video of it loops, so its end runs into its start. Played as cut, the music
 * stops dead and the opening comes from nothing. Here the last `seconds` fade out while the recording's own lead-in fades in
 * (the same length of the full recording, just before the excerpt starts), at equal power: when the video starts again its
 * first sample continues the lead-in, as the recording itself does. Nothing before the last `seconds` changes, and the first
 * sample stays the excerpt's first, so every time of the specification holds.
 *
 * An excerpt that starts at the recording's start, or whose full recording is not on this machine, has no lead-in: its last
 * `seconds` fade out and the opening starts as written. To try by ear, not production: `mirror` gives such a song its own
 * opening played backwards as a lead-in, a swell that arrives exactly on the first sample.
 *
 * The band is computed from this recording (scene.ts), so it loops with the sound. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
export const LOOP_SECONDS = 0.5;
const RATE = 48000, CHANNELS = 2;
/** The full recordings the excerpts were cut from (productions/<song>/source.json names the file and the excerpt's start). */
const recordings = () => process.env.LR_RECORDINGS ?? join(homedir(), 'prog/double-pendulum/music/tracks');

/** Interleaved stereo samples of `seconds` of a file from `start`. */
function decode(path: string, start = 0, seconds?: number): Float32Array {
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

/** The `frames` frames of the full recording that come just before the excerpt, or null when there are none. The excerpt's
 * place in the recording is found to the sample (the recorded start is a millisecond off on some files). */
function leadIn(song: string, excerpt: Float32Array, frames: number): Float32Array | null {
  const record = join(ROOT, 'productions', song, 'source.json');
  if (!existsSync(record)) return null;
  const {file, sourceStartSeconds: start} = JSON.parse(readFileSync(record, 'utf8')), path = join(recordings(), file), seconds = frames / RATE;
  if (!(start >= seconds + 0.1) || !existsSync(path)) return null;
  const MARGIN = 0.05, from = start - seconds - MARGIN, chunk = decode(path, from, seconds + 2 * MARGIN + 0.25), probe = Math.round(0.2 * RATE), expected = Math.round((seconds + MARGIN) * RATE);
  const mono = (a: Float32Array, i: number) => a[i * CHANNELS] + a[i * CHANNELS + 1];
  let best = -Infinity, at = expected;
  for (let lag = expected - Math.round(MARGIN * RATE); lag <= expected + Math.round(MARGIN * RATE); lag++) {
    let sum = 0; for (let i = 0; i < probe; i += 3) sum += mono(chunk, lag + i) * mono(excerpt, i);
    if (sum > best) {best = sum; at = lag;}
  }
  return chunk.slice((at - frames) * CHANNELS, at * CHANNELS);
}

/** The looping recording of `song`, repository-relative (a WAV under generated/loop-audio, made once per recording and
 * setting), and how its end was made: 'lead-in', 'fade' or 'mirror'. */
export function loopRecording(song: string, seconds = LOOP_SECONDS, mirror = false): {audio: string; loop: 'lead-in' | 'fade' | 'mirror'} {
  const recording = join(ROOT, 'productions', song, 'audio.mp3'), record = join(ROOT, 'productions', song, 'source.json');
  const source = existsSync(record) ? JSON.parse(readFileSync(record, 'utf8')) : null, here = source && existsSync(join(recordings(), source.file));
  const id = createHash('sha256').update(readFileSync(recording)).update(JSON.stringify([seconds, RATE, here ? [source.sha256, source.sourceStartSeconds] : null, mirror, 1])).digest('hex').slice(0, 24);
  const audio = join('generated/loop-audio', `${song}-${id}.wav`), marker = join(ROOT, `${audio}.json`);
  if (!existsSync(marker)) {
    mkdirSync(join(ROOT, 'generated/loop-audio'), {recursive: true});
    const excerpt = decode(recording), frames = Math.round(seconds * RATE), real = leadIn(song, excerpt, frames);
    // the opening backwards: frame i of the lead-in is frame (frames - 1 - i) of the excerpt
    const lead = real ?? (mirror ? Float32Array.from({length: frames * CHANNELS}, (_, k) => excerpt[(frames - 1 - (k >> 1)) * CHANNELS + (k & 1)]) : null), mixed = blendTail(excerpt, lead, frames);
    const temporary = join(ROOT, `${audio}.${process.pid}.tmp.wav`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(RATE), '-ac', String(CHANNELS), '-i', 'pipe:0', '-c:a', 'pcm_s24le', temporary], {input: Buffer.from(mixed.buffer, mixed.byteOffset, mixed.byteLength)});
    renameSync(temporary, join(ROOT, audio));
    writeFileSync(marker, JSON.stringify({song, seconds, loop: real ? 'lead-in' : lead ? 'mirror' : 'fade'}));
  }
  return {audio, loop: JSON.parse(readFileSync(marker, 'utf8')).loop};
}
