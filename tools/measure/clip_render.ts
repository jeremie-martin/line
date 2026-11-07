/** Plain landscape renders for review clips: the ride with the spec camera, no
 * overlay or beat punch (scripts/export.ts at 1280×720, zoom ×3.5), muxed with the
 * song; and clips cut around a hit. Shared by the pair studies and the night report. */
import {existsSync, mkdirSync, writeFileSync, readFileSync, renameSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {renderVideo} from '../../scripts/produce/render.ts';

export const CLIP_BEFORE = 1.0, CLIP_LENGTH = 1.8;

const sha = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
export function reviewRenderInput(song: string, track: any, spec = `productions/${song}/spec.ts`) {
  const files = [spec, `productions/${song}/audio.mp3`,
    'tools/measure/clip_render.ts', 'scripts/produce/render.ts', 'scripts/lib/video_options.ts', 'scripts/lib/export.ts', 'scripts/v0/core/camera.ts',
    'scripts/gallery/build_renderer.mjs', 'scripts/gallery/native/video.js', 'scripts/gallery/native/sprites.js', 'scripts/v0/types.ts', 'scripts/produce/jolt.ts', 'package-lock.json',
    'mirror/index.html', 'mirror/helper.js', 'mirror/manifest.json', 'mirror/_v2153.0/main.js'];
  return {trackHash: sha(JSON.stringify(track)), files: Object.fromEntries(files.map(p => [p, sha(readFileSync(p))])),
    ffmpeg: sha(execFileSync('ffmpeg', ['-version']))};
}
export function assertReviewSources(song: string, input: {specSha256: string; audioSha256: string}, spec = `productions/${song}/spec.ts`) {
  assert.equal(sha(readFileSync(spec)), input.specSha256, 'review specification differs from compiled input');
  assert.equal(sha(readFileSync(`productions/${song}/audio.mp3`)), input.audioSha256, 'review audio differs from compiled input');
}
export function verifyCachedRide(movie: string, input: unknown) {
  const record = JSON.parse(readFileSync(movie + '.render.json', 'utf8'));
  assert.deepEqual(record.input, input, 'review render inputs changed; use a fresh render directory');
  assert.equal(record.movieSha256, sha(readFileSync(movie)), 'cached review video differs');
}

/** Renders every ride in `tracks` (id → {song, track, spec?}) to `<dir>/<id>.mp4`,
 * reusing only renders with matching input identity and movie bytes. `spec`
 * (the camera) defaults to the song's spec.ts. */
export async function renderRides(tracks: Map<string, {song: string; track: any; spec?: string}>, dir: string, jobs = 4) {
  mkdirSync(dir, {recursive: true});
  assert.ok(Number.isSafeInteger(jobs) && jobs > 0 && jobs <= 12, 'invalid render jobs');
  const inputs = new Map([...tracks].map(([id, {song, track, spec}]) => [id, reviewRenderInput(song, track, spec)]));
  for (const id of tracks.keys()) if (existsSync(join(dir, id + '.mp4'))) verifyCachedRide(join(dir, id + '.mp4'), inputs.get(id));
  const queue = [...tracks.keys()].filter(id => !existsSync(join(dir, id + '.mp4')));
  const results = await Promise.allSettled(Array.from({length: jobs}, async () => {
    while (queue.length) {
      const id = queue.shift()!, {song, track, spec = `productions/${song}/spec.ts`} = tracks.get(id)!, trackPath = join(dir, id + '.track.json');
      writeFileSync(trackPath, JSON.stringify(track));
      const movie = await renderVideo({name: id, trackPath, audioPath: `productions/${song}/audio.mp3`,
        specPath: spec, style: 'plain', qp: 28, jolt: 0,
        render: {res: '1280x720', zoomMult: 3.5, beatPunchPct: 0}, workDir: join(dir, 'render-work', id)});
      renameSync(movie, join(dir, id + '.mp4'));
      assert.deepEqual(reviewRenderInput(song, track, spec), inputs.get(id), 'render inputs changed during rendering');
      writeFileSync(join(dir, id + '.mp4.render.json'), JSON.stringify({input: inputs.get(id), movieSha256: sha(readFileSync(join(dir, id + '.mp4')))}));
      console.log(`rendered ${id}`);
    }
  }));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(r => r.reason), 'Review renders failed');
}

/** Cuts a CLIP_LENGTH clip whose hit at `frame` lands CLIP_BEFORE seconds in. */
export function cutClip(ride: string, frame: number, out: string) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(frame / 40 - CLIP_BEFORE), '-i', ride, '-t', String(CLIP_LENGTH),
    '-vf', 'scale=960:540', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', out]);
}

/** One clip of two rides, `top` above `bottom`, over the same `from`..`to`
 * seconds (so synchronized by construction), with the top ride's sound, each half
 * captioned, a gray rule between them, and `mark` (seconds, absolute) flagged in both halves. */
export function stackClip(top: string, bottom: string, from: number, to: number, captions: [string, string], mark: number, out: string) {
  const text = (caption: string) => `drawtext=text='${caption.replace(/[\\':%]/g, '')}':x=16:y=14:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8,` +
    `drawtext=text='here':x=(w-tw)/2:y=14:fontsize=26:fontcolor=black:box=1:boxcolor=yellow@0.9:boxborderw=8:enable='between(t,${(mark - from - .12).toFixed(3)},${(mark - from + .25).toFixed(3)})'`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(from), '-t', String(to - from), '-i', top, '-ss', String(from), '-t', String(to - from), '-i', bottom,
    '-filter_complex', `[0:v]scale=960:540,setpts=PTS-STARTPTS,${text(captions[0])},pad=960:544:0:0:color=gray[a];[1:v]scale=960:540,setpts=PTS-STARTPTS,${text(captions[1])}[b];[a][b]vstack[v]`,
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-crf', '22', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', out]);
}
