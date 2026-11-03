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
    expect(() => engine.getCachedMotionWindow(0, 60)).toThrow('already simulated');
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
    const saved = engine.getCachedMotionWindow(0, 60).slice();
    expect(saved).toHaveLength(61 * 5);
    expect(engine.getCachedMotionWindow(60, 60)).toHaveLength(5);
    expect(getPhysicsFrameCount()).toBe(work);
    const sibling = engine.addLine({id: 3, type: 0, x1: -50, y1: 0, x2: 280, y2: 0});
    expect(() => sibling.getCachedMotionWindow(0, 60)).toThrow('already simulated');
    expect(getPhysicsFrameCount()).toBe(work);
    expect(() => engine.getCachedMotionWindow(5, 4)).toThrow('already simulated');
    expect(() => engine.getCachedMotionWindow(-1, 4)).toThrow(RangeError);
    expect(() => engine.getCachedMotionWindow(0, 4.5)).toThrow(RangeError);
    engine.dispose();
    expect(() => engine.getCachedMotionWindow(0, 0)).toThrow('disposed');
  } finally {disposeEngines();}
});
