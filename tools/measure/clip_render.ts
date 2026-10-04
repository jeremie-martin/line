/** Plain landscape renders for review clips: the ride with the spec camera, no
 * overlay or beat punch (scripts/export.ts at 1280×720, zoom ×3.5), muxed with the
 * song; and clips cut around a hit. Shared by the pair studies and the night report. */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync, spawn} from 'node:child_process';
import {ensureMirror} from '../../scripts/produce/render.ts';

export const CLIP_BEFORE = 1.0, CLIP_LENGTH = 1.8;

/** Renders every ride in `tracks` (id → {song, track}) to `<dir>/<id>.mp4`,
 * skipping rides already rendered. */
export async function renderRides(tracks: Map<string, {song: string; track: any}>, dir: string, jobs = 4) {
  mkdirSync(dir, {recursive: true});
  const run = (args: string[]) => new Promise<void>((done, fail) => {
    const child = spawn(process.execPath, ['--import', 'tsx', ...args], {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']});
    child.once('exit', code => code === 0 ? done() : fail(new Error(`${args[0]} exited ${code}`)));
  });
  const mirror = await ensureMirror();
  try {
    const queue = [...tracks.keys()].filter(id => !existsSync(join(dir, id + '.mp4')));
    await Promise.all(Array.from({length: jobs}, async () => {
      while (queue.length) {
        const id = queue.shift()!, {song, track} = tracks.get(id)!, silent = join(dir, id + '.video.mp4'), trackPath = join(dir, id + '.track.json');
        writeFileSync(trackPath, JSON.stringify(track));
        await run(['scripts/export.ts', `--track=${trackPath}`, `--spec=productions/${song}/spec.ts`,
          '--zoom=action', '--zoom-mult=3.5', '--res=1280x720', `--out=${silent}`]);
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', `productions/${song}/audio.mp3`, '-map', '0:v:0', '-map', '1:a:0',
          '-c:v', 'copy', '-c:a', 'aac', '-shortest', join(dir, id + '.mp4')]);
        console.log(`rendered ${id}`);
      }
    }));
  } finally {mirror?.kill();}
}

/** Cuts a CLIP_LENGTH clip whose hit at `frame` lands CLIP_BEFORE seconds in. */
export function cutClip(ride: string, frame: number, out: string) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(frame / 40 - CLIP_BEFORE), '-i', ride, '-t', String(CLIP_LENGTH),
    '-vf', 'scale=960:540', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', out]);
}
