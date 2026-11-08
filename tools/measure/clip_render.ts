/** Review clips for the compiler's studies (pair studies, the visibility study, compare's before/after review): passages of
 * rides in the plain look (look.js PLAIN: the ride alone, black on white), 540 × 960, with the song, written directly by the
 * video writer. Study clips judge motion, not sync: their rides are bare tracks, shown as compiled, on the compile timeline (physics
 * frame f at f / 40 s of the song, scripts/video/timing.js with offset 0), so a judged moment is exactly where its frame says.
 * Their beat marks are the song's authored beats, from the spec the rides were compiled from. Shared by pair_study, visibility
 * and tools/eval/compare. */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildScene, songRecording, type Scene} from '../../scripts/video/scene.ts';
import {FPS} from '../../scripts/video/timing.js';
import {resolveLook} from '../../scripts/video/look.js';
import {writeVideo} from '../../scripts/video/write.ts';
import {AUDIO, KEEP, VIDEO} from '../../scripts/video/encoding.ts';
import {authoredBeats} from '../../scripts/produce/music_artifacts.ts';
import type {Spec} from '../../scripts/v0/types.ts';

export const CLIP_BEFORE = 1.0, CLIP_LENGTH = 1.8, CLIP_WIDTH = 540;
const PLAIN = resolveLook('plain');
const sha = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');

/** A passage of a bare track of `song` (a folder of productions/) from `from` to `to`, in seconds of the compile timeline. */
export type Clip = {song: string; track: Scene['track']; from: number; to: number};
/** The clip whose judged moment (at physics frame `frame`, a hit or not) lands CLIP_BEFORE seconds in. */
export function momentClip(song: string, track: Scene['track'], frame: number): Clip {
  const from = frame / FPS - CLIP_BEFORE;
  assert.ok(from >= 0, `a moment at physics frame ${frame} is too early for a clip that starts ${CLIP_BEFORE} s before it`);
  return {song, track, from, to: from + CLIP_LENGTH};
}
/** A spec's authored beats (music_artifacts.ts authoredBeats: seconds, as the spec gives them) with their requested strengths. */
export async function specBeats(path: string) {
  const spec: Spec = (await import(pathToFileURL(resolve(path)).href)).default;
  return authoredBeats(spec, path).map((t, i) => ({t, impact: spec.contacts[i].impact ?? null}));
}
/** The beats inside a clip, in seconds from its start. */
export function clipBeats({from, to}: Clip, beats: {t: number; impact: number | null}[]) {
  return beats.filter(b => b.t >= from && b.t <= to).map(b => ({t: +(b.t - from).toFixed(4), impact: b.impact}));
}

export function assertReviewSources(song: string, input: {specSha256: string; audioSha256: string}, spec = `productions/${song}/spec.ts`) {
  assert.equal(sha(readFileSync(spec)), input.specSha256, 'review specification differs from compiled input');
  assert.equal(sha(readFileSync(songRecording(song))), input.audioSha256, 'review audio differs from compiled input');
}
/** What a clip is of; a written clip records it beside itself (<clip>.json). The recording is the one the clip is drawn to. */
export function clipInput({song, track, from, to}: Clip) {
  return {song, trackHash: sha(JSON.stringify(track)), audioSha256: sha(readFileSync(songRecording(song))), from, to, width: CLIP_WIDTH, look: PLAIN};
}
/** An existing clip is reused only for the same inputs and intact bytes; otherwise the directory belongs to another study. */
export function verifyCachedClip(movie: string, input: unknown) {
  assert.ok(existsSync(movie + '.json'), `${movie} has no record of what it is of (an older or interrupted build); use a fresh directory`);
  const record = JSON.parse(readFileSync(movie + '.json', 'utf8'));
  assert.deepEqual(record.input, input, `${movie} is of other inputs; use a fresh directory`);
  assert.equal(record.movieSha256, sha(readFileSync(movie)), `${movie} differs from the clip that was written`);
}

/** Writes each clip (id → clip) to <dir>/<id>.mp4, `jobs` at a time, reusing a clip already written from the same inputs. */
export async function renderClips(clips: Map<string, Clip>, dir: string, jobs = 4) {
  mkdirSync(dir, {recursive: true});
  assert.ok(Number.isSafeInteger(jobs) && jobs > 0 && jobs <= 12, 'invalid render jobs');
  const inputs = new Map([...clips].map(([id, clip]) => [id, clipInput(clip)]));
  for (const id of clips.keys()) if (existsSync(join(dir, id + '.mp4'))) verifyCachedClip(join(dir, id + '.mp4'), inputs.get(id));
  const queue = [...clips.keys()].filter(id => !existsSync(join(dir, id + '.mp4')));
  const results = await Promise.allSettled(Array.from({length: jobs}, async () => {
    while (queue.length) {
      const id = queue.shift()!, {song, track, from, to} = clips.get(id)!, movie = join(dir, id + '.mp4');
      await writeVideo({scene: buildScene(song, {track}), look: PLAIN, out: movie, from, to, width: CLIP_WIDTH, log: () => {}});
      writeFileSync(movie + '.json', JSON.stringify({input: inputs.get(id), movieSha256: sha(readFileSync(movie))}));
      console.log(`rendered ${id}`);
    }
  }));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(r => r.reason), 'Review clips failed');
}

/** Two clips of the same passage side by side, with the left clip's sound, each captioned, and `mark` (seconds from the clips'
 * start) flagged in both. */
export function sideBySide(left: string, right: string, captions: [string, string], mark: number, out: string) {
  const text = (caption: string) => `drawtext=text='${caption.replace(/[\\':%]/g, '')}':x=12:y=12:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6,` +
    `drawtext=text='here':x=(w-tw)/2:y=48:fontsize=22:fontcolor=black:box=1:boxcolor=yellow@0.9:boxborderw=6:enable='between(t,${(mark - .12).toFixed(3)},${(mark + .25).toFixed(3)})'`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', left, '-i', right,
    '-filter_complex', `[0:v]${text(captions[0])},pad=iw+4:ih:0:0:color=gray[a];[1:v]${text(captions[1])}[b];[a][b]hstack,${KEEP}[v]`,
    '-map', '[v]', '-map', '0:a', ...VIDEO, ...AUDIO, '-movflags', '+faststart', out]);
}
