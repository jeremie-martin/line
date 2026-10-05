/** Plain landscape renders for review clips: the ride with the spec camera, no
 * overlay or beat punch (scripts/export.ts at 1280×720, zoom ×3.5), muxed with the
 * song; and clips cut around a hit. Shared by the pair studies and the night report. */
import {existsSync, mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync, spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ensureMirror} from '../../scripts/produce/render.ts';

export const CLIP_BEFORE = 1.0, CLIP_LENGTH = 1.8;

const sha = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
export function reviewRenderInput(song: string, track: any) {
  const files = [`productions/${song}/spec.ts`, `productions/${song}/audio.mp3`,
    'tools/measure/clip_render.ts', 'scripts/export.ts', 'scripts/lib/export.ts', 'scripts/v0/core/camera.ts',
    'scripts/v0/types.ts', 'scripts/produce/jolt.ts', 'package-lock.json',
    'mirror/index.html', 'mirror/helper.js', 'mirror/manifest.json', 'mirror/_v2153.0/main.js'];
  return {trackHash: sha(JSON.stringify(track)), files: Object.fromEntries(files.map(p => [p, sha(readFileSync(p))])),
    ffmpeg: sha(execFileSync('ffmpeg', ['-version']))};
}
export function assertReviewSources(song: string, input: {specSha256: string; audioSha256: string}) {
  assert.equal(sha(readFileSync(`productions/${song}/spec.ts`)), input.specSha256, 'review specification differs from compiled input');
  assert.equal(sha(readFileSync(`productions/${song}/audio.mp3`)), input.audioSha256, 'review audio differs from compiled input');
}
export function verifyCachedRide(movie: string, input: unknown) {
  const record = JSON.parse(readFileSync(movie + '.render.json', 'utf8'));
  assert.deepEqual(record.input, input, 'review render inputs changed; use a fresh render directory');
  assert.equal(record.movieSha256, sha(readFileSync(movie)), 'cached review video differs');
}

/** Renders every ride in `tracks` (id → {song, track}) to `<dir>/<id>.mp4`,
 * reusing only renders with matching input identity and movie bytes. */
export async function renderRides(tracks: Map<string, {song: string; track: any}>, dir: string, jobs = 4) {
  mkdirSync(dir, {recursive: true});
  const run = (args: string[]) => new Promise<void>((done, fail) => {
    const child = spawn(process.execPath, ['--import', 'tsx', ...args], {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']});
    child.once('error', fail);
    child.once('exit', code => code === 0 ? done() : fail(new Error(`${args[0]} exited ${code}`)));
  });
  assert.ok(Number.isSafeInteger(jobs) && jobs > 0 && jobs <= 12, 'invalid render jobs');
  const inputs = new Map([...tracks].map(([id, {song, track}]) => [id, reviewRenderInput(song, track)]));
  for (const id of tracks.keys()) if (existsSync(join(dir, id + '.mp4'))) verifyCachedRide(join(dir, id + '.mp4'), inputs.get(id));
  const mirror = await ensureMirror();
  try {
    const queue = [...tracks.keys()].filter(id => !existsSync(join(dir, id + '.mp4')));
    const results = await Promise.allSettled(Array.from({length: jobs}, async () => {
      while (queue.length) {
        const id = queue.shift()!, {song, track} = tracks.get(id)!, silent = join(dir, id + '.video.mp4'), trackPath = join(dir, id + '.track.json');
        writeFileSync(trackPath, JSON.stringify(track));
        await run(['scripts/export.ts', `--track=${trackPath}`, `--spec=productions/${song}/spec.ts`,
          '--zoom=action', '--zoom-mult=3.5', '--res=1280x720', `--out=${silent}`]);
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', `productions/${song}/audio.mp3`, '-map', '0:v:0', '-map', '1:a:0',
          '-c:v', 'copy', '-c:a', 'aac', '-shortest', join(dir, id + '.mp4')]);
        assert.deepEqual(reviewRenderInput(song, track), inputs.get(id), 'render inputs changed during rendering');
        writeFileSync(join(dir, id + '.mp4.render.json'), JSON.stringify({input: inputs.get(id), movieSha256: sha(readFileSync(join(dir, id + '.mp4')))}));
        console.log(`rendered ${id}`);
      }
    }));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(r => r.reason), 'Review renders failed');
  } finally {mirror?.kill();}
}

/** Cuts a CLIP_LENGTH clip whose hit at `frame` lands CLIP_BEFORE seconds in. */
export function cutClip(ride: string, frame: number, out: string) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(frame / 40 - CLIP_BEFORE), '-i', ride, '-t', String(CLIP_LENGTH),
    '-vf', 'scale=960:540', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', out]);
}
