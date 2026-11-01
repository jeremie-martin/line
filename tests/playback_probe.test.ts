import {afterEach, describe, expect, it, vi} from 'vitest';
// @ts-ignore: opt-in browser diagnostics module
import {installPlaybackProbe, summarizeCapture} from '../tools/measure/playback_probe.mjs';

describe('playback diagnostic summaries', () => {
  const frame = (ts: number, pose: number, playing = true) =>
    ({ts, pose, playing, visible: 'visible', rate: 1, entered: ts + 1, cost: 2});
  it('separates a delayed callback from a media-clock discontinuity', () => {
    const delayed = summarizeCapture({frames: [frame(0, 0), frame(16, .016), frame(66, .066)]});
    expect(delayed.intervalsOver25ms).toBe(1);
    expect(delayed.poseStepErrorMs.max).toBeCloseTo(0);
    const jump = summarizeCapture({frames: [frame(0, 0), frame(16, .016), frame(32, .08)]});
    expect(jump.intervalsOver25ms).toBe(0);
    expect(jump.poseStepErrorMs.max).toBeCloseTo(48);
  });
  it('excludes pause, background and speed-change boundaries from timing statistics', () => {
    const result = summarizeCapture({frames: [frame(0, 0), frame(16, .016, false), frame(2000, .016),
      {...frame(2016, .032), visible: 'hidden'}, frame(2032, .048), {...frame(2048, .056), rate: .5}]});
    expect(result.callbackIntervalMs.count).toBe(0);
  });
  it('does not report missed video callbacks as dropped video frames', () => {
    const result = summarizeCapture({videoFrames: {left: [
      {presentedFrames: 10, dropped: 4, expectedDisplayTime: 0},
      {presentedFrames: 12, dropped: 4, expectedDisplayTime: 33},
      {presentedFrames: 13, dropped: 5, expectedDisplayTime: 50},
    ]}});
    expect(result.videos.left.skippedCallbacks).toBe(1);
    expect(result.videos.left.droppedVideoFrames).toBe(1);
    expect(result.videos.left.presentedBetweenCallbacks).toBe(3);
  });
  it('handles video counters restarting when another pair is selected', () => {
    const result = summarizeCapture({videoFrames: {left: [
      {source: 'first.mp4', presentedFrames: 90, dropped: 4, expectedDisplayTime: 0},
      {source: 'next.mp4', presentedFrames: 1, dropped: 0, expectedDisplayTime: 100},
      {source: 'next.mp4', presentedFrames: 4, dropped: 1, expectedDisplayTime: 150},
    ]}});
    expect(result.videos.left.presentedBetweenCallbacks).toBe(3);
    expect(result.videos.left.skippedCallbacks).toBe(2);
    expect(result.videos.left.droppedVideoFrames).toBe(1);
  });
});

describe('opt-in playback probe lifecycle', () => {
  afterEach(() => {vi.unstubAllGlobals();});
  function browser() {
    let time = 0, callback: (ts: number) => void;
    class Input {id = 'seek'; stored = ''; get value() {return this.stored;} set value(v: string) {this.stored = String(v);}}
    class Audio {currentTime = 1; getOutputTimestamp() {return {contextTime: .9, performanceTime: 10};}}
    const seek = new Input(), listeners = new Map(), play = {textContent: 'Pause'}, rate = {value: '1'};
    const original = (fn: (ts: number) => void) => {callback = fn; return 1;};
    const w: any = {HTMLInputElement: Input, AudioContext: Audio, performance: {now: () => time}, requestAnimationFrame: original,
      document: {visibilityState: 'visible', getElementById: (id: string) => ({seek, play, rate}[id]),
        addEventListener: (type: string, fn: Function) => listeners.set(type, fn),
        removeEventListener: (type: string) => listeners.delete(type)},
      location: {pathname: '/motion-gallery/production.html', search: ''}, navigator: {userAgent: 'test'}};
    vi.stubGlobal('window', w);
    return {w, seek, original, listeners, advance(ts: number) {time = ts; callback(ts);}};
  }
  it('records only after starting, preserves exact slider input, marks events, and restores patched APIs', () => {
    const b = browser(), value = Object.getOwnPropertyDescriptor(b.w.HTMLInputElement.prototype, 'value');
    const output = b.w.AudioContext.prototype.getOutputTimestamp;
    const probe = installPlaybackProbe();
    expect(installPlaybackProbe()).toBe(probe);
    function tick(ts: number) {b.seek.value = String(ts / 1000); b.w.requestAnimationFrame(tick);}
    b.w.requestAnimationFrame(tick); b.advance(1);
    expect(probe.snapshot().frames).toHaveLength(0);
    probe.start(); b.advance(16.123); probe.mark('noticed here');
    const capture = probe.stop(); b.advance(32);
    expect(capture.frames).toHaveLength(1);
    expect(capture.frames[0].pose).toBeCloseTo(.016123);
    expect(capture.markers[0].label).toBe('noticed here');
    probe.dispose();
    expect(b.w.requestAnimationFrame).toBe(b.original);
    expect(b.w.AudioContext.prototype.getOutputTimestamp).toBe(output);
    expect(Object.getOwnPropertyDescriptor(b.w.HTMLInputElement.prototype, 'value')).toEqual(value);
    expect(b.listeners.size).toBe(0);
    expect(b.w.linePlaybackProbe).toBeUndefined();
  });
  it('stops collecting at the requested limit and starts a fresh capture on Record', () => {
    const b = browser(), probe = installPlaybackProbe({maxFrames: 2});
    function tick() {b.w.requestAnimationFrame(tick);}
    b.w.requestAnimationFrame(tick); probe.start(); b.advance(0); b.advance(16); b.advance(32);
    expect(probe.snapshot().frames).toHaveLength(2);
    expect(probe.snapshot().limitReached).toBe(true);
    probe.start(); b.advance(48);
    expect(probe.snapshot().frames).toHaveLength(1);
    expect(probe.snapshot().limitReached).toBeUndefined();
    probe.dispose();
  });
});
