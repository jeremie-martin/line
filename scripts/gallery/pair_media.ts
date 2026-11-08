/** Derived pair previews: one video timeline, with either original soundtrack.
 * Source clips and published study manifests remain unchanged. */
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {access, mkdir, mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {join, relative, resolve, sep} from 'node:path';
import {promisify} from 'node:util';
import {KEEP, TAGS} from '../video/encoding.ts';

const execute = promisify(execFile);
const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
export type PairLayout = 'wide' | 'stacked';
export type PairMedia = {sources: {left: string; right: string}; width: number; height: number; frames: number; fps: number;
  duration: number; paneWidth: number; paneHeight: number; layout: PairLayout};
type Stream = {codec_type: string; width: number; height: number; nb_frames: string; avg_frame_rate: string;
  r_frame_rate: string; duration: string; start_time: string};
const exists = async (file: string): Promise<boolean> => {try {await access(file); return true;} catch {return false;}};
const rate = (text: string): number => {const [a, b] = text.split('/').map(Number); return a / b;};

export function createPairMedia(root: string = process.cwd()) {
  const cache = join(root, 'generated/pair-playback'), pending = new Map<string, Promise<PairMedia>>();
  const children = new Set<ReturnType<typeof execFile>>();
  const run = async (program: string, args: string[]): Promise<string> => {
    const job = execute(program, args, {maxBuffer: 2 ** 20, encoding: 'utf8'}); children.add(job.child);
    try {return (await job).stdout;} finally {children.delete(job.child);}
  };
  const local = (src: string): string => {
    const url = new URL(src, 'http://local');
    const file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!src.startsWith('/') || src.startsWith('//') || url.origin !== 'http://local' || url.search || url.hash ||
        !file.startsWith(resolve(root) + sep)) throw new Error('Pair clips must be local files under the review root');
    return file;
  };
  async function prepare(left: string, right: string, layout: PairLayout, duration: number): Promise<PairMedia> {
    if (!['wide', 'stacked'].includes(layout) || !Number.isFinite(duration) || duration <= 0) throw new Error('Invalid pair preview request');
    const inputs = [local(left), local(right)], hashes = await Promise.all(inputs.map(async p => digest(await readFile(p))));
    const key = digest(JSON.stringify({recipe: 'line.pair-preview.v2-crf12', hashes, layout, duration})), dir = join(cache, key);
    const metadata = join(dir, 'media.json');
    if (await exists(metadata)) return JSON.parse(await readFile(metadata, 'utf8')) as PairMedia;
    const prior = pending.get(key); if (prior) return prior;
    const job = (async (): Promise<PairMedia> => {
      const streams = await Promise.all(inputs.map(async p => (JSON.parse(await run('ffprobe', ['-v', 'error',
        '-show_entries', 'stream=codec_type,width,height,nb_frames,avg_frame_rate,r_frame_rate,duration,start_time', '-of', 'json', p])) as {streams: Stream[]}).streams));
      const video = streams.map(s => s.find(v => v.codec_type === 'video'));
      if (video.some(v => !v) || streams.some(s => !s.some(v => v.codec_type === 'audio'))) throw new Error('Both pair clips need video and audio');
      const a = video[0]!, b = video[1]!, fps = rate(a.avg_frame_rate), frames = Number(a.nb_frames);
      if (!(fps > 0) || !Number.isInteger(frames) || frames <= 0 || a.width !== b.width || a.height !== b.height ||
          a.nb_frames !== b.nb_frames || fps !== rate(b.avg_frame_rate) || fps !== rate(a.r_frame_rate) ||
          fps !== rate(b.r_frame_rate) || video.some(v => Math.abs(Number(v!.start_time)) > 1e-6 ||
            Math.abs(Number(v!.duration) - duration) > 1e-3) || Math.abs(frames / fps - duration) > 1e-3)
        throw new Error('Pair clips must have matching dimensions, zero-based constant-rate frames and declared duration');
      await mkdir(cache, {recursive: true}); const temporary = await mkdtemp(join(cache, '.building-'));
      try {
        const gap = Math.max(2, 2 * Math.round(a.width / 80));
        const filter = layout === 'wide' ? `[0:v]pad=iw+${gap}:ih:0:0:color=white[l];[l][1:v]hstack=inputs=2,${KEEP}[v]`
          : `[0:v]pad=iw:ih+${gap}:0:0:color=white[l];[l][1:v]vstack=inputs=2,${KEEP}[v]`;
        // Encode the shared picture once; remux its exact video packets with
        // the other original AAC soundtrack. No independent clocks in the UI.
        await run('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-i', inputs[0], '-i', inputs[1],
          '-filter_complex_threads', '1', '-filter_complex', filter, '-map', '[v]', '-map', '0:a:0',
          '-frames:v', String(frames), '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '12',
          '-pix_fmt', 'yuv420p', ...TAGS, '-c:a', 'copy', '-movflags', '+faststart', join(temporary, 'left.mp4')]);
        await run('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-i', join(temporary, 'left.mp4'), '-i', inputs[1],
          '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', join(temporary, 'right.mp4')]);
        const current = await Promise.all(inputs.map(async p => digest(await readFile(p))));
        if (current.some((hash, i) => hash !== hashes[i])) throw new Error('Source clips changed while preparing the pair');
        const url = '/' + relative(root, dir).split(sep).join('/');
        const media: PairMedia = {sources: {left: url + '/left.mp4', right: url + '/right.mp4'},
          width: layout === 'wide' ? 2 * a.width + gap : a.width,
          height: layout === 'stacked' ? 2 * a.height + gap : a.height, frames, fps, duration, paneWidth: a.width, paneHeight: a.height, layout};
        await writeFile(join(temporary, 'media.json'), JSON.stringify(media));
        try {await rename(temporary, dir);} catch (error) {if (!await exists(metadata)) throw error;}
        return media;
      } finally {await rm(temporary, {recursive: true, force: true});}
    })();
    pending.set(key, job);
    try {return await job;} finally {pending.delete(key);}
  }
  return {prepare, close() {for (const child of children) child.kill();}};
}
