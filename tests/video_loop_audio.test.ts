import {expect, it} from 'vitest';
import {blendTail, loopPoint} from '../scripts/video/loop_audio.ts';

it('the looping recording changes only its last frames: the song fades out, its lead-in fades in at equal power and ends whole', () => {
  const frames = 1000, song = new Float32Array(frames * 2).fill(0.5), lead = new Float32Array(200 * 2).fill(-0.25);
  const out = blendTail(song, lead, 200);
  expect(Array.from(out.subarray(0, 800 * 2)).every(v => v === 0.5)).toBe(true); // nothing before the blend changes
  expect(out[999 * 2]).toBeCloseTo(-0.25, 6); expect(out[999 * 2 + 1]).toBeCloseTo(-0.25, 6); // the last frame is the lead-in's last
  const mid = 800 + 99, down = Math.cos(100 / 200 * Math.PI / 2), up = Math.sin(100 / 200 * Math.PI / 2);
  expect(out[mid * 2]).toBeCloseTo(0.5 * down - 0.25 * up, 6); expect(down * down + up * up).toBeCloseTo(1, 9);
  expect(song[999 * 2]).toBe(0.5); // the input is left alone
});
it('without a lead-in the last frames fade to silence', () => {
  const out = blendTail(new Float32Array(100 * 2).fill(1), null, 10);
  expect(out[89 * 2]).toBe(1); expect(out[99 * 2]).toBeCloseTo(0, 6); expect(out[94 * 2]).toBeGreaterThan(0.5);
});
it('the loop point ends the song where its rhythm is in step with its lead-in, and leaves a song with no clear match as cut', () => {
  const RATE = 48000, clicks = (seconds: number, first: number, period = 0.5) => {
    const out = new Float32Array(Math.round(seconds * RATE) * 2);
    for (let t = first; t < seconds - 0.01; t += period) for (let i = 0; i < 240; i++) {const at = (Math.round(t * RATE) + i) * 2; out[at] = out[at + 1] = Math.sin(i * 1.7) * (1 - i / 240);}
    return out;
  };
  // the lead-in's clicks fall half-seconds before its end (the song's start); the song runs 38 analysis steps (0.2 s) past its own grid
  const {trim, match} = loopPoint(clicks(12 + 38 * 256 / RATE, 0), clicks(6, 0));
  expect(trim).toBe(38 * 256); expect(match).toBeGreaterThan(0.9);
  expect(loopPoint(clicks(12, 0), clicks(6, 0)).trim).toBe(0); // already in step
  const noise = Float32Array.from({length: 12 * RATE * 2}, (_, i) => Math.sin(i * i * 1e-7) * 0.3);
  expect(loopPoint(noise, clicks(6, 0)).trim).toBe(0); // nothing to match
});
