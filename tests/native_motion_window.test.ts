import {it, expect} from 'vitest';
import {LineRiderEngine as Engine, disposeEngines} from '../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory, resetFrameCount, getPhysicsFrameCount} from '../scripts/lib/detector.ts';
import {impactAccount, IMPACT_ACCOUNT_IDS} from '../scripts/v0/optimizer/impact_accounts.ts';

it('packed observations equal scalar observations under every strike contract, without stepping', () => {
  const engine = new Engine().setStart({x: 0, y: -15}, {x: 4, y: 0}).addLine([
    {id: 1, type: 0, x1: -50, y1: 10, x2: 120, y2: 10},
    {id: 2, type: 0, x1: 120, y1: 10, x2: 280, y2: -20},
  ]);
  try {
    resetFrameCount();
    expect(() => engine.readCachedMotionWindow(0, 60, values => Float64Array.from(values))).toThrow('already simulated');
    expect(engine.getLastFrameIndex()).toBe(0);
    expect(getPhysicsFrameCount()).toBe(0);
    const raw = extractRawTrajectory(engine, 60), work = getPhysicsFrameCount();
    const scalar = {getLastFrameIndex: () => engine.getLastFrameIndex(),
      getRider: (f: number) => engine.getRider(f), bodyMotionAt: (f: number) => engine.bodyMotionAt(f),
      hasContactAtFrame: (f: number) => engine.hasContactAtFrame(f)};
    for (const id of IMPACT_ACCOUNT_IDS) for (const from of [0, 1, 17, 60, 61]) {
      const account = impactAccount(id), frames = raw.frames.slice(from);
      expect(account.observe(engine, frames)).toEqual(account.observe(scalar, frames));
    }
    const saved = engine.readCachedMotionWindow(0, 60, values => Float64Array.from(values)).slice();
    expect(saved).toHaveLength(61 * 5);
    expect(engine.readCachedMotionWindow(60, 60, values => Float64Array.from(values))).toHaveLength(5);
    expect(getPhysicsFrameCount()).toBe(work);
    const sibling = engine.addLine({id: 3, type: 0, x1: -50, y1: 0, x2: 280, y2: 0});
    expect(() => sibling.readCachedMotionWindow(0, 60, values => Float64Array.from(values))).toThrow('already simulated');
    expect(getPhysicsFrameCount()).toBe(work);
    expect(() => engine.readCachedMotionWindow(5, 4, values => Float64Array.from(values))).toThrow('already simulated');
    expect(() => engine.readCachedMotionWindow(-1, 4, values => Float64Array.from(values))).toThrow(RangeError);
    expect(() => engine.readCachedMotionWindow(0, 4.5, values => Float64Array.from(values))).toThrow(RangeError);
    engine.dispose();
    expect(() => engine.readCachedMotionWindow(0, 0, values => Float64Array.from(values))).toThrow('disposed');
  } finally {disposeEngines();}
});

it('contains borrowed motion reads, restores access after failures, and lets owned results survive reuse', () => {
  const a = new Engine().setStart({x: 0, y: -15}, {x: 4, y: 0});
  const b = new Engine().setStart({x: 0, y: -15}, {x: 8, y: 0});
  try {
    a.getRider(10); b.getRider(10);
    const saved = a.readCachedMotionWindow(0, 10, values => Float64Array.from(values));
    const before = [...saved];
    for (const call of [() => b.getRider(10), () => new Engine(), () => a.dispose(),
      () => Engine.retainOnly([]), () => b.readCachedMotionWindow(0, 10, () => 0)]) {
      expect(() => a.readCachedMotionWindow(0, 10, call)).toThrow('inside a motion observation');
      expect(a.getLastFrameIndex()).toBe(10);
      expect(b.getLastFrameIndex()).toBe(10);
    }
    expect(() => a.readCachedMotionWindow(0, 10, () => { throw new Error('consumer failed'); })).toThrow('consumer failed');
    expect(() => a.readCachedMotionWindow(0, 10, (() => Promise.resolve()) as any)).toThrow('synchronous');
    b.readCachedMotionWindow(0, 10, values => { expect(values[0]).not.toBe(before[0]); });
    expect([...saved]).toEqual(before);
    expect(a.readCachedMotionWindow(0, 10, values => Array.from(values))).toEqual(before);
  } finally {disposeEngines();}
});
