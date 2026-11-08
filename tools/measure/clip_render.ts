/** Review clips for the compiler's studies (pair studies, the visibility study, compare's before/after review): passages of
 * rides in the plain look (look.js PLAIN: the ride alone, black on white), 540 × 960, with the song, written directly by the
 * video writer at their song times. A ride is a saved record or a bare track; its timing (scripts/video/timing.js) places a
 * judged moment in song time, so a clip's moment is exactly where the manifest says, and a study's clips are all aligned or
 * all as compiled. Shared by pair_study, visibility and tools/eval/compare. */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildScene, rideAccount, songRecording, type Ride} from '../../scripts/video/scene.ts';
import {alignment, songTimeOfFrame} from '../../scripts/video/timing.js';
import {resolveLook} from '../../scripts/video/look.js';
import {writeVideo} from '../../scripts/video/write.ts';
import {AUDIO, KEEP, VIDEO} from '../../scripts/video/encoding.ts';

export const CLIP_BEFORE = 1.0, CLIP_LENGTH = 1.8, CLIP_WIDTH = 540;
const PLAIN = resolveLook('plain');
const sha = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');

/** A passage of a ride of `song` (a folder of productions/) from `from` to `to`, in song seconds. */
export type Clip = {song: string; ride: Ride; from: number; to: number};
const timingOf = (ride: Ride) => alignment(rideAccount(ride));
/** The clip whose judged moment (at physics frame `frame` of the ride, a hit or not) lands CLIP_BEFORE seconds in. */
export function momentClip(song: string, ride: Ride, frame: number): Clip {
  const from = songTimeOfFrame(frame, timingOf(ride).offset) - CLIP_BEFORE;
  assert.ok(from >= 0, `a moment at physics frame ${frame} is too early for a clip that starts ${CLIP_BEFORE} s before it`);
  return {song, ride, from, to: from + CLIP_LENGTH};
}
/** The beats inside a clip (seconds from its start, with their requested strengths): the ride's recorded beats; none without. */
export function clipBeats({ride, from, to}: Clip) {
  return (rideAccount(ride)?.targets ?? []).filter(t => t.beat !== undefined && t.beat >= from && t.beat <= to)
    .map(t => ({t: +(t.beat! - from).toFixed(4), impact: t.impact ?? null}));
}

export function assertReviewSources(song: string, input: {specSha256: string; audioSha256: string}, spec = `productions/${song}/spec.ts`) {
  assert.equal(sha(readFileSync(spec)), input.specSha256, 'review specification differs from compiled input');
  assert.equal(sha(readFileSync(songRecording(song))), input.audioSha256, 'review audio differs from compiled input');
}
/** What a clip is of; a written clip records it beside itself (<clip>.json). The recording is the one the clip is drawn to. */
export function clipInput({song, ride, from, to}: Clip) {
  return {song, rideHash: sha(JSON.stringify(ride)), timing: timingOf(ride), audioSha256: sha(readFileSync(songRecording(song))), from, to,
    width: CLIP_WIDTH, look: PLAIN};
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
  // one study, one timing: a blind comparison of an aligned ride with one shown as compiled would compare their timing too
  assert.ok(new Set([...inputs.values()].map(i => i.timing.aligned)).size <= 1, 'these clips mix aligned rides and rides shown as compiled');
  for (const id of clips.keys()) if (existsSync(join(dir, id + '.mp4'))) verifyCachedClip(join(dir, id + '.mp4'), inputs.get(id));
  const queue = [...clips.keys()].filter(id => !existsSync(join(dir, id + '.mp4')));
  const results = await Promise.allSettled(Array.from({length: jobs}, async () => {
    while (queue.length) {
      const id = queue.shift()!, {song, ride, from, to} = clips.get(id)!, movie = join(dir, id + '.mp4');
      await writeVideo({scene: buildScene(song, ride), look: PLAIN, out: movie, from, to, width: CLIP_WIDTH, log: () => {}});
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
