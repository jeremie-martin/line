import {expect, it} from 'vitest';
import {detect, DetectionContinuation, type RawFrame} from '../scripts/lib/detector.ts';
import {makeRng} from '../scripts/lib/rng.ts';

/** Contact/air runs with occasional stalls, bind breaks and world exits. */
function trajectory(seed: number, length: number): RawFrame[] {
  const rng = makeRng(seed), frames: RawFrame[] = [];
  let air = false, slow = false, x = 0, y = 0;
  for (let frame = 0; frame < length; frame++) {
    if (rng() < .15) air = !air;
    if (rng() < .05) slow = !slow;
    const speed = slow ? .05 : 1 + 6 * rng(), angle = (rng() - .5) * (rng() < .1 ? 3 : .4);
    const velocity = {x: speed * Math.cos(angle), y: speed * Math.sin(angle)};
    x += velocity.x; y += velocity.y;
    const touched = air ? (rng() < .2 ? ['PEG'] : []) : ['PEG', 'TAIL'].slice(0, 1 + Math.floor(2 * rng()));
    frames.push({frame, position: {x: rng() < .002 ? 1e7 : x, y}, velocity, sledContacts: touched,
      contactLineIds: touched.map((_, k) => 1000 + k), sledBroken: rng() < .002, riderEjected: rng() < .002});
  }
  return frames;
}

it('resuming a detected prefix equals detecting the whole trajectory', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const frames = trajectory(seed, 60 + seed * 3), duration = frames.length - (seed % 3);
    const whole = detect({duration, frames});
    for (let k = 1; k <= frames.length; k++) {
      const prefix = new DetectionContinuation({duration: k - 1, frames: frames.slice(0, k)});
      prefix.withDetection({duration, frames: frames.slice(0, k).concat(frames.slice(k))}, detection => { expect(detection).toEqual(whole); });
    }
  }
});

it('rejects a trajectory that does not extend the detected frames', () => {
  const frames = trajectory(7, 40), prefix = new DetectionContinuation({duration: 29, frames: frames.slice(0, 30)});
  expect(() => prefix.withDetection({duration: 39, frames: trajectory(7, 40)}, () => {})).toThrow('does not extend');
});

it('reuses one continuation across short, long, terminated and alternate suffixes', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const frames = trajectory(seed, 100), head = frames.slice(0, 20);
    const continuation = new DetectionContinuation({duration: 19, frames: head});
    const alternate = trajectory(seed + 100, 100);
    for (const tail of [frames, alternate, frames]) for (const length of [100, 24, 70, 21]) {
      const raw = {duration: length - 1, frames: head.concat(tail.slice(20, length))};
      continuation.withDetection(raw, result => { expect(result).toEqual(detect(raw)); });
    }
  }
});

it('restores the continuation after exceptions and rejects nested or asynchronous use', () => {
  const frames = trajectory(7, 40), raw = {duration: 39, frames};
  const continuation = new DetectionContinuation({duration: 19, frames: frames.slice(0, 20)});
  expect(() => continuation.withDetection(raw, () => { throw new Error('consumer failed'); })).toThrow('consumer failed');
  expect(() => continuation.withDetection(raw, () => continuation.withDetection(raw, () => 1))).toThrow('already in use');
  expect(() => continuation.withDetection(raw, (() => Promise.resolve(1)) as any)).toThrow('must be synchronous');
  continuation.withDetection(raw, result => { expect(result).toEqual(detect(raw)); });
});
