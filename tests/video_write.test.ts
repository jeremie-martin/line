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
  scene = {song: 'test', title: 'TEST', audio: join(dir, 'song.wav'), span: [0, 1.5], timing: {offset: 0, aligned: false, reason: 'no impact account'},
    track, account: null, phases: [{name: 'all', t0: 0, t1: 1.5}], drop: null,
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

it('starts a mid-song excerpt with the song\'s own samples, also from an MP3', async () => {
  // a seek leaves an MP3 decoder without the bits its first frame borrows from earlier frames: that frame decodes wrong
  const mp3 = join(dir, 'song.mp3'), out = join(dir, 'mp3-excerpt.mp4'), RATE = 48000, at = 0.9;
  execFileSync('ffmpeg', ['-v', 'error', '-i', scene.audio, '-c:a', 'libmp3lame', '-b:a', '192k', mp3]);
  expect(await writeVideo({scene: {...scene, audio: mp3}, look: resolveLook('plain'), out, from: at, to: 1.4, width: 180, log: () => {}})).toBe(30);
  const pcm = (path: string) => {const b = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']); return new Float32Array(b.buffer, b.byteOffset, b.length >> 2);};
  const clip = pcm(out), song = pcm(mp3).subarray(Math.round(at * RATE));
  const rms = (f: (i: number) => number) => {let s = 0; for (let i = 0; i < 1152; i++) s += f(i) ** 2; return Math.sqrt(s / 1152);};
  // the first MP3 frame's worth of the excerpt is the song there: AAC's first frame keeps about a third of the signal as error,
  // the seek artifact was all of it (measured 0.33 against 0.99)
  expect(rms(i => clip[i] - song[i])).toBeLessThan(0.6 * rms(i => song[i]));
}, 120000);

it('shows physics frame f at song time f / 40 − offset, whatever the offset\'s sign, hits and all', async () => {
  // with nothing on the song's clock drawn (no band, title, drop or ends), the picture is a function of ride time only: the same
  // ride time must give the same frames, the ride and each hit's effects at its strongest frame alike
  const frames = (path: string) => execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-map', '0:v', '-f', 'framemd5', '-'], {encoding: 'utf8'})
    .split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(',').at(-1)!.trim());
  // one strong hit, answered at physics frame 22 (ride time 0.55 s), its strike beginning at 20
  const account = {targets: [{frame: 22, impact: 0.9}], events: [{onset: 20, peak: 22, strength: 0.9}], matches: [{target: 0, event: 0}]};
  const write = async (look: ReturnType<typeof resolveLook>, offset: number, from: number, name: string) => {
    const out = join(dir, name);
    await writeVideo({scene: {...scene, account, timing: {offset, aligned: false, reason: 'test'}}, look, out, from, to: from + 0.25, width: 180, log: () => {}});
    return frames(out);
  };
  for (const [name, look] of [['plain', resolveLook('plain')], ['hits', resolveLook('plain', {hits: 'v1'})]] as const) {
    const reference = await write(look, 0, 0.5, `${name}-offset0.mp4`);
    expect(reference).toHaveLength(15);
    expect(await write(look, 0.1, 0.4, `${name}-offset+.mp4`)).toEqual(reference); // shown 0.1 s early: ride time 0.5 at song time 0.4
    expect(await write(look, -0.1, 0.6, `${name}-offset-.mp4`)).toEqual(reference);
  }
  // the hit does show in that passage (the two looks differ only by their hits; encoded frames are compared whole, since a change
  // in one frame alters its neighbours' bytes)
  expect(frames(join(dir, 'hits-offset0.mp4'))).not.toEqual(frames(join(dir, 'plain-offset0.mp4')));
}, 180000);

it('refuses a passage outside the song span the ride covers', async () => {
  await expect(writeVideo({scene, look: resolveLook('plain'), out: join(dir, 'outside.mp4'), from: 1, to: 1.75, width: 180, log: () => {}}))
    .rejects.toThrow(/outside the song span the ride covers, 0–1.5 s/);
});
