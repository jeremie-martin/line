// Two 9:16 videos side by side at their own size, under the frame of frame.py (ground, rounded windows), encoded once.
//   node generated/concept-lab/then-and-now/join.ts old=OLD.mp4 new=MASTER.mp4 out=FILE.mp4 [caption=OLD.png] [skip=0.0833] [length=48]
// new: a lossless master (showcase.mjs master=yes, or video.ts --master=yes), so this is its only lossy encode; its sound is
// kept as it is; it carries its own caption (--caption). caption: a transparent 1080 × 1920 picture laid on the old video
// (caption.mjs). old: an early video, read once; its colours are BT.601 and are converted to the standard. skip: seconds dropped
// from the start of the old video (the old Tiki video's sound starts 79 ms after the song's: five frames).
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {KEEP, VIDEO} from '../../../scripts/video/encoding.ts';
import {FPS, verifyVideo} from '../../../scripts/video/write.ts';

const a = Object.fromEntries(process.argv.slice(2).map(s => {const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)];}));
if (!a.old || !a.new || !a.out) throw new Error('old=OLD.mp4 new=MASTER.mp4 out=FILE.mp4');
const W = 2256, H = 1984, M = 32, TILE = 1080, length = +(a.length ?? 48), frame = join(import.meta.dirname, 'frame.png');
const still = (path: string) => ['-loop', '1', '-framerate', String(FPS), '-i', path];
const png = 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int:sws_dither=none,format=yuva420p';
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', a.skip ?? '0.0833', '-i', a.old, '-i', a.new, ...still(frame), ...(a.caption ? still(a.caption) : []),
  '-filter_complex', [
    // the old video into the standard's colours, on the canvas; the new one beside it, untouched; the frame over both
    `[0:v]fps=${FPS},scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=tv:out_range=tv:flags=accurate_rnd+full_chroma_int:sws_dither=none,format=yuv420p,pad=${W}:${H}:${M}:${M}[left]`,
    ...(a.caption ? [`[3:v]${png}[word]`, `[left][word]overlay=${M}:${M}[named]`] : ['[left]null[named]']),
    `[named][1:v]overlay=${2 * M + TILE}:${M}[both]`,
    `[2:v]${png}[frame]`,
    `[both][frame]overlay=0:0,${KEEP}[v]`].join(';'),
  '-map', '[v]', '-map', '1:a', ...VIDEO, '-c:a', 'copy', '-t', String(length), '-movflags', '+faststart', a.out], {stdio: ['ignore', 'inherit', 'inherit']});
verifyVideo(a.out, {width: W, height: H, frames: Math.round(length * FPS)});
console.log(`${a.out}: ${W} × ${H}, ${length} s`);
