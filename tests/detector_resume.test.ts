import {expect, it} from 'vitest';
import {detect, detectFrom, detectPrefix, type RawFrame} from '../scripts/lib/detector.ts';
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
      const prefix = detectPrefix({duration: k - 1, frames: frames.slice(0, k)});
      expect(detectFrom(prefix, {duration, frames: frames.slice(0, k).concat(frames.slice(k))})).toEqual(whole);
    }
  }
});

it('rejects a trajectory that does not extend the detected frames', () => {
  const frames = trajectory(7, 40), prefix = detectPrefix({duration: 29, frames: frames.slice(0, 30)});
  expect(() => detectFrom(prefix, {duration: 39, frames: trajectory(7, 40)})).toThrow('does not extend');
});
