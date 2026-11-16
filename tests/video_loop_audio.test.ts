import {expect, it} from 'vitest';
import {blendTail} from '../scripts/video/loop_audio.ts';

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
