import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
// @ts-ignore: browser module of the review pages, plain JavaScript
import {bodyCentre, followPath, createCamera} from '../scripts/gallery/native/camera.js';

// The mirror's follower step (module 560, CommonJS), exactly as the gallery bundle uses it.
const module = {exports: {} as any};
new Function('exports', 'module', 'require', readFileSync('unpacked/560.js', 'utf8'))(module.exports, module, () => {
  throw new Error('module 560 has no dependencies');
});
const step = module.exports;

/** Ten points on a rigid body spinning at 1.5 rev/s while its centre moves at a steady 400 units/s. */
function spinningRide(frames: number) {
  const offsets = Array.from({length: 10}, (_, i) => [8 * Math.cos(i), 5 * Math.sin(2 * i)]);
  const mean = offsets.reduce(([x, y], [a, b]) => [x + a / 10, y + b / 10], [0, 0]);
  return Array.from({length: frames}, (_, f) => {
    const angle = 2 * Math.PI * 1.5 * f / 40, c = Math.cos(angle), s = Math.sin(angle);
    return offsets.flatMap(([a, b]) => {
      const x = a - mean[0], y = b - mean[1];
      return [10 * f + c * x - s * y, 3 * f + s * x + c * y];
    });
  });
}

describe('review page camera', () => {
  const ride = spinningRide(400), view = {width: 1300, height: 420, zoom: 1.4};
  it('centres on the mean of the traced points', () => {
    expect(bodyCentre([0, 0, 2, 4, 4, 2])).toEqual({x: 2, y: 2});
    const centre = bodyCentre(ride[37]);
    expect(centre.x).toBeCloseTo(370, 9);
    expect(centre.y).toBeCloseTo(111, 9);
  });
  it('moves steadily through a spin once it has caught up, as the video follower does', () => {
    const path = followPath(step, ride.map(bodyCentre), view), speed = (f: number) => Math.hypot(path[2 * f + 2] - path[2 * f], path[2 * f + 3] - path[2 * f + 1]);
    const speeds = Array.from({length: 100}, (_, i) => speed(299 + i));
    // A single point on this body speeds up and slows down by about a fifth each turn.
    expect(Math.max(...speeds) / Math.min(...speeds) - 1).toBeLessThan(1e-6);
    expect(speeds[0]).toBeCloseTo(Math.hypot(10, 3), 6);
  });
  it('matches the mirror follower frame by frame and interpolates between frames', () => {
    const centres = ride.map(bodyCentre), path = followPath(step, centres, view);
    let camera = step(centres[0], centres[0], view);
    for (let f = 1; f <= 50; f++) camera = step(camera, centres[f], view);
    expect([path[100], path[101]]).toEqual([camera.x, camera.y]);
    const at = createCamera(step, centres), shown = at({w: 1300, h: 420, z: 1.4}, 50.25);
    expect(shown.x).toBeCloseTo(path[100] + (path[102] - path[100]) / 4, 9);
    expect(shown.y).toBeCloseTo(path[101] + (path[103] - path[101]) / 4, 9);
  });
});
