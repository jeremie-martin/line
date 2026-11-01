import {describe, expect, it} from 'vitest';
// @ts-ignore: browser module of the review pages, plain JavaScript
import {heard, outputClock, displayTime} from '../shared/playback.js';

describe('music position from the audio output clock', () => {
  const run = {from: 12, startedAt: 3, rate: 1};
  it('holds the start position until the first sample is heard, then follows the context clock', () => {
    expect(heard(run, 2.98)).toBe(12);
    expect(heard(run, 3.5)).toBeCloseTo(12.5, 12);
    expect(heard({...run, rate: 0.5}, 4)).toBeCloseTo(12.5, 12);
  });
  it('runs through silence before the music on the same clock', () => {
    // A spec cursor 1 s before the music starts: the music begins 1 s after play.
    expect(heard({from: -1, startedAt: 3, rate: 1}, 3.5)).toBeCloseTo(-0.5, 12);
    expect(heard({from: -1, startedAt: 3, rate: 1}, 4.25)).toBeCloseTo(0.25, 12);
  });
  it('reads through output timestamps that lag by up to an audio block', () => {
    // True: context time = performance time / 1000 − 1.18 (output latency included).
    // Firefox reports the context time at the start of the current ~10.7 ms block.
    const clock = outputClock(), block = 512 / 48000;
    expect(clock.at(0)).toBeUndefined();
    let worst = 0;
    for (let frame = 0; frame < 300; frame++) {
      const ms = 2000 + frame * 1000 / 60, truth = (t: number) => t / 1000 - 1.18;
      clock.read({contextTime: Math.floor(truth(ms) / block) * block, performanceTime: ms});
      if (frame > 10) worst = Math.max(worst, Math.abs(clock.at(ms + 16) - truth(ms + 16)));
    }
    expect(worst).toBeLessThan(0.001);
  });
});

describe('display time of an animation frame', () => {
  it('is the next refresh, read from the shortest interval between frames', () => {
    const at = displayTime();
    expect(at(1000)).toBeCloseTo(1000 + 1000 / 60, 9);
    at(1000 + 1000 / 144); at(1000 + 2 * 1000 / 144);
    expect(at(1000 + 4 * 1000 / 144)).toBeCloseTo(1000 + 5 * 1000 / 144, 9);  // a dropped frame does not lengthen it
  });
});
