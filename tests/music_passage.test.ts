import {expect, it} from 'vitest';
import {passages} from '../tools/music/passage.ts';
import {HOP} from '../scripts/video/loop_audio.ts';

it('lists passages whose end is in step with what leads into their start: whole bars of a repeating rhythm', () => {
  const STEP = HOP / 48000, bar = Math.round(2 / STEP), beat = new Float64Array(Math.round(80 / STEP)).fill(-0.1);
  // a two-second bar: a strong onset at its start, two weaker ones inside, never the same twice within the bar
  for (let i = 0; i < beat.length; i++) {const at = i % bar; if (at === 0) beat[i] = 5; else if (at === Math.round(0.7 / STEP)) beat[i] = 2; else if (at === Math.round(1.3 / STEP)) beat[i] = 3;}
  const found = passages(beat, {min: 30, max: 45});
  expect(found.length).toBeGreaterThan(3);
  for (const p of found.slice(0, 5)) {
    expect(p.match).toBeGreaterThan(0.99);
    const bars = (p.end - p.start) / (bar * STEP); expect(Math.abs(bars - Math.round(bars))).toBeLessThan(0.01);
    expect(p.end - p.start).toBeGreaterThanOrEqual(30 - STEP); expect(p.end - p.start).toBeLessThanOrEqual(45 + STEP); expect(p.start).toBeGreaterThanOrEqual(6 - 2 * STEP);
  }
  // a passage asked to contain two moments contains them
  for (const p of passages(beat, {contain: [20, 52]})) {expect(p.start).toBeLessThanOrEqual(20); expect(p.end).toBeGreaterThanOrEqual(52);}
});
