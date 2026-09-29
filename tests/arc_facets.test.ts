import { expect, it } from 'vitest';
import { motionArc } from '../scripts/v0/optimizer/arc_geometry.ts';
import { compileArcMotion } from '../scripts/v0/optimizer/arc_motion.ts';
import type { Spec } from '../scripts/v0/types.ts';
const points = [{ x: 0, y: 0 }, { x: 12, y: 1 }, { x: 4, y: 9 }, { x: 7, y: 4 }], velocity = { x: 9, y: 2 };
const control = { entry: 12, turn: -20, exit: 25, support: 20, bias: .2, offset: .1 };
it('keeps ordinary geometry exact and builds fewer, longer normal facets', () => {
  const smooth = motionArc(points, velocity, control, 1000, false, 12, false, 24);
  expect(motionArc(points, velocity, control, 1000, false, 12, false, 24, 4)).toEqual(smooth);
  const facets = motionArc(points, velocity, control, 1000, false, 12, false, 24, .5);
  expect(facets.length).toBeLessThan(smooth.length / 4);
  expect(facets.every(l => l.type === 0)).toBe(true);
  for (const n of [0, -1, Infinity, NaN, 5])
    expect(() => motionArc(points, velocity, control, 1000, false, 0, false, 0, n)).toThrow('subdivisions');
});
it.each([{ subdivisions: .5 }, { wave: true }])('searches the actual geometry and preserves replay/memo parity: %j', shape => {
  const spec: Spec = { duration: 2, preroll: 5, jitter: 0, contacts: [.5, 1, 1.5, 2].map(t => ({ t, impact: .4 })), axes: { air: () => .5, speed: () => .5 } };
  const options = { budget: 25000, samples: 24, channel: 12, radius: 24, bidirectional: true, memoCandidates: true, ...shape };
  const result = compileArcMotion(spec, 17, options);
  expect(result.track.lines.every(l => l.type === 0)).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
  expect(compileArcMotion(spec, 17, { ...options, reuseEvaluations: true }).track).toEqual(result.track);
});
