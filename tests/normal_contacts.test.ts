import { expect, it } from 'vitest';
import { contactFragments, compileContactFragments, compileScatteredMotion } from '../scripts/v0/optimizer/normal_contacts.ts';
import { LineRiderEngine } from '../scripts/lib/_lr_engine_wasm.ts';
import { getPhysicsFrameCount } from '../scripts/lib/detector.ts';
import { compileNormalMotion } from '../scripts/v0/optimizer/normal_motion.ts';
import { arcTrajectoryLoss } from '../scripts/v0/optimizer/arc_refinement.ts';
import type { Spec, TrackLine } from '../scripts/v0/types.ts';
const line: TrackLine = { id: 7, type: 0, x1: 0, y1: 0, x2: 10, y2: 0, flipped: true, leftExtended: true, rightExtended: true };
it('merges overlapping contacts and leaves separated footprints disconnected, without extension or acceleration', () => {
  const fragments = contactFragments([line], new Map([[7, [.5, .51, .9]]]), .4);
  expect(fragments).toHaveLength(2);
  expect(fragments.map(l => l.id)).toEqual([1, 2]);
  expect(fragments[0].x1).toBeCloseTo(4.8);
  expect(fragments[0].x2).toBeCloseTo(5.3);
  expect(fragments[1].x1).toBeCloseTo(8.8);
  expect(fragments.every(l => l.type === 0 && l.flipped && !l.leftExtended && !l.rightExtended)).toBe(true);
  expect(line.rightExtended).toBe(true);
});
it('rejects unsupported material and malformed collision geometry', () => {
  for (const bad of [{ ...line, type: 1 }, { ...line, x2: 0 }, { ...line, x2: Infinity }])
    expect(() => contactFragments([bad], new Map([[7, [.5]]]), .1)).toThrow();
  expect(() => contactFragments([line, line], new Map(), .1)).toThrow('duplicate');
  expect(() => contactFragments([line], new Map([[7, [NaN]]]), .1)).toThrow('nonfinite');
  expect(() => contactFragments([line], new Map(), 0)).toThrow('positive');
});
const spec: Spec = { duration: 2, preroll: 5, jitter: 0,
  contacts: [.5, 1, 1.5, 2].map(t => ({ t, impact: .5 })),
  axes: { air: () => .5, speed: () => .5, amplitude: () => .1 } };
it('charges both construction phases and keeps a validated scattered incumbent', () => {
  const baseline = compileNormalMotion(spec, 17, { budget: 25000 });
  const retained = new LineRiderEngine().setStart({ x: 123, y: -45 }, { x: 3, y: 0 });
  const before = JSON.stringify(retained.getRider(0).ballisticState());
  const result = compileScatteredMotion(spec, 17, { budget: 25000 });
  expect(result.work.feedback).toBe(baseline.stats.sim_frames);
  expect(result.work.reconstruction).toBeGreaterThan(0);
  expect(result.work.total).toBe(result.work.feedback + result.work.reconstruction);
  expect(result.stats.sim_frames).toBe(result.work.total);
  expect(result.work.lastMeter).toBe(getPhysicsFrameCount());
  expect(result.work.lastMeter).toBe(result.work.reconstruction);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(25000);
  expect(arcTrajectoryLoss(result.report)).toBeLessThanOrEqual(arcTrajectoryLoss(baseline.report));
  expect(result.track.lines.every(l => l.type === 0)).toBe(true);
  expect(JSON.stringify(retained.getRider(0).ballisticState())).toBe(before);
  const repeat = compileScatteredMotion(spec, 17, { budget: 25000 });
  expect(repeat.track).toEqual(result.track);
  expect(repeat.work).toEqual(result.work);
});
it('refuses unsupported input or insufficient reconstruction work', () => {
  expect(() => compileContactFragments(spec, 17, { budget: 1000 })).toThrow('planning and validation');
  expect(() => compileScatteredMotion({ ...spec, axes: { rotation: () => 0 } as any }, 17, { budget: 25000 })).toThrow('supports');
});
