import {afterAll, beforeAll, expect, it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveLook} from '../scripts/video/look.js';
import {audioLag, verifyVideo, writeVideo} from '../scripts/video/write.ts';
import type {Scene} from '../scripts/video/scene.ts';

// A rider sliding down one line for 1.5 s, over 2 s of noise (a signal the audio check can align).
let dir: string, scene: Scene;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'line-video-'));
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=2:c=pink:r=48000:a=0.5', join(dir, 'song.wav')]);
  const track = {duration: 60, startPosition: {x: 0, y: 0}, riders: [{startPosition: {x: 0, y: 0}, startVelocity: {x: 2, y: 0}, remountable: 1}],
    lines: [{id: 1, type: 0, x1: -20, y1: 10, x2: 400, y2: 120, flipped: false, leftExtended: false, rightExtended: false}]};
  scene = {song: 'test', title: 'TEST', duration: 1.5, audio: join(dir, 'song.wav'), track, hits: [], phases: [{name: 'all', t0: 0, t1: 1.5}], drop: null,
    spectrum: {fps: 30, bands: 56, frames: Array.from({length: 60}, () => new Array(56).fill(0.3))}};
});
afterAll(() => rmSync(dir, {recursive: true, force: true}));

it('writes every frame once, under the standard, with the song exactly in place', async () => {
  const out = join(dir, 'video.mp4');
  expect(await writeVideo({scene, look: resolveLook('plain'), out, width: 180, log: () => {}})).toBe(90);
  expect(() => verifyVideo(out, {width: 180, height: 320, frames: 90})).not.toThrow();
  expect(Math.abs(audioLag(out, scene.audio, 0)!)).toBeLessThan(0.05);
  // an excerpt starts at its own song time
  const excerpt = join(dir, 'excerpt.mp4');
  expect(await writeVideo({scene, look: resolveLook(null, {band: 'bars'}), out: excerpt, from: 0.5, to: 1.25, width: 180, log: () => {}})).toBe(45);
  expect(Math.abs(audioLag(excerpt, scene.audio, 0.5)!)).toBeLessThan(0.05);
  // the check sees a delay: the same video with its sound 10 ms late
  const late = join(dir, 'late.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-i', out, '-c:v', 'copy', '-af', 'adelay=10', '-c:a', 'aac', late]);
  expect(audioLag(late, scene.audio, 0)).toBeCloseTo(10, 1);
}, 120000);
