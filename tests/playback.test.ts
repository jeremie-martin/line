import {describe, expect, it} from 'vitest';
// @ts-ignore: browser module of the review pages, plain JavaScript
import {heard, outputClock, follow, displayTime, lastFrame, shownGap} from '../motion-gallery/playback.js';

describe('music position from the audio output clock', () => {
  const run = {from: 12, startedAt: 3, rate: 1};
  it('holds the start position until the first sample is heard, then follows the context clock', () => {
    expect(heard(run, 2.98)).toBe(12);
    expect(heard(run, 3.5)).toBeCloseTo(12.5, 12);
    expect(heard({...run, rate: 0.5}, 4)).toBeCloseTo(12.5, 12);
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

describe('what the two clips show', () => {
  function fakeVideo() {
    const listeners: Record<string, Array<() => void>> = {}, callbacks: Array<(now: number, meta: object) => void> = [];
    return {addEventListener(type: string, f: () => void) {(listeners[type] ??= []).push(f);},
      requestVideoFrameCallback(f: (now: number, meta: object) => void) {callbacks.push(f);},
      present(meta: object) {callbacks.shift()!(0, meta);},
      fire(type: string) {for (const f of listeners[type] ?? []) f();}};
  }
  it('remembers the last presented frame until a pause or seek', () => {
    const video = fakeVideo(), last = lastFrame(video);
    expect(last()).toBeUndefined();
    video.present({mediaTime: 0.5, expectedDisplayTime: 1000});
    video.present({mediaTime: 0.5 + 1 / 60, expectedDisplayTime: 1016});
    expect(last()).toEqual({mediaTime: 0.5 + 1 / 60, expectedDisplayTime: 1016});
    video.fire('seeking');
    expect(last()).toBeUndefined();
  });
  it('compares the frames on screen, or the position of a clip without a current frame', () => {
    const frame = (mediaTime: number, expectedDisplayTime: number) => ({mediaTime, expectedDisplayTime});
    const clip = (f: object | undefined, time: number, paused = false) => ({frame: f, time, paused});
    expect(shownGap(clip(frame(1, 990), 1.01), clip(frame(0.95, 990), 0.96), 1000)).toBeCloseTo(0.05, 12);
    // A leader whose first frame waits for its sound is where its currentTime says.
    expect(shownGap(clip(frame(0, 900), 0.01), clip(frame(0.05, 990), 0.06), 1000)).toBeCloseTo(-0.04, 12);
    expect(shownGap(clip(frame(0.1, 995), 0.11), clip(frame(0.2, 900), 0.15, true), 1000)).toBeCloseTo(-0.05, 12);
  });
});

describe('follower', () => {
  it('ignores a one-frame difference, and seeks only when far apart', () => {
    expect(follow(1 / 60, 'play')).toBe('play');
    expect(follow(-1 / 60, 'play')).toBe('play');
    expect(follow(-0.3, 'play')).toBe('seek');
  });
  it('waits when ahead until the leader reaches it, and catches up when behind until level', () => {
    expect(follow(-2 / 60, 'play')).toBe('wait');
    expect(follow(-0.005, 'wait')).toBe('wait');
    expect(follow(0, 'wait')).toBe('play');
    expect(follow(2 / 60, 'play')).toBe('catch');
    expect(follow(0.005, 'catch')).toBe('catch');
    expect(follow(0, 'catch')).toBe('play');
  });
  it('absorbs a 50 ms start of the leader\'s sound without a seek', () => {
    // The leader holds its first frame while its sound starts; the follower started at once.
    let leader = 0, follower = 0, mode = 'play', seeks = 0, worst = 0;
    for (let f = 0; f < 90; f++) {
      mode = follow(leader - follower, mode);
      if (mode === 'seek') seeks++;
      if (f >= 3) leader += 1 / 60;
      if (mode !== 'wait') follower += (mode === 'catch' ? 1.05 : 1) / 60;
      if (f > 10) worst = Math.max(worst, Math.abs(leader - follower));
    }
    expect(seeks).toBe(0);
    expect(worst).toBeLessThan(0.5 / 60);
  });
});
