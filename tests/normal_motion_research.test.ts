import {expect, it} from 'vitest';
import {compileNormalMotion} from '../scripts/v0/optimizer/normal_motion.ts';
import {LineRiderEngine} from '../scripts/lib/_lr_engine_wasm.ts';
import {getPhysicsFrameCount} from '../scripts/lib/detector.ts';
import type {Spec} from '../scripts/v0/types.ts';
const spec: Spec = {duration: 2, preroll: 5, jitter: 0,
  contacts: [.5, 1, 1.5, 2].map(t => ({t, impact: .5})),
  axes: {air: () => .5, speed: () => .5, amplitude: () => .1}};
it('replays scattered normal segments within budget and preserves caller-owned engines', () => {
  const retained = new LineRiderEngine().setStart({x: 123, y: -45}, {x: 3, y: 0});
  const before = JSON.stringify(retained.getRider(0).ballisticState());
  const result = compileNormalMotion(spec, 17, {budget: 25000});
  expect(result.track.lines.length).toBeGreaterThan(0);
  expect(result.track.lines.every(l => l.type === 0)).toBe(true);
  expect(result.stats.sim_frames).toBe(getPhysicsFrameCount());
  expect(result.stats.sim_frames).toBeLessThanOrEqual(25000);
  expect(result.budgetTelemetry?.compile.total_spent_frames).toBe(result.stats.sim_frames);
  expect(JSON.stringify(retained.getRider(0).ballisticState())).toBe(before);
  expect(compileNormalMotion(spec, 17, {budget: 25000}).track).toEqual(result.track);
});
it('rejects an allowance that cannot pay for validation', () => {
  expect(() => compileNormalMotion(spec, 17, {budget: 180})).toThrow(/two complete replays/);
});
