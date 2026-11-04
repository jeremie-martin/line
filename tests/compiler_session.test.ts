import {afterEach, expect, it} from 'vitest';
import {LineRiderEngine as Engine, disposeEngines} from '../scripts/lib/native_motion/engine.ts';
import {getRiderMetered, getFrameCount, getPhysicsFrameCount, resetFrameCount, setPhysicsFrameLimit,
  withPhysicsFrameSession, withPhysicsFrameProbe} from '../scripts/lib/detector.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {withSequenceObserver} from '../scripts/v0/optimizer/arc_sequence.ts';
import type {Spec} from '../scripts/v0/types.ts';

const spec: Spec = {duration: 4, preroll: 5, contacts: [.6, 1.2, 1.8, 2.4, 3, 3.6].map(t => ({t, impact: .4})),
  axes: {air: () => .5, speed: () => .5}};
const options = {budget: 6000, samples: 32, channel: 12, radius: 24};
afterEach(() => {disposeEngines(); setPhysicsFrameLimit(null); resetFrameCount();});

it('keeps an outer compiler budget intact when a study tries to compile recursively', async () => {
  const baseline = compileArcMotion(spec, 17, options);
  let observations = 0;
  const actual = await withSequenceObserver(() => {
    observations++;
    const before = [getFrameCount(), getPhysicsFrameCount()];
    expect(() => compileArcMotion(spec, 18, options)).toThrow('compilation is already active');
    expect([getFrameCount(), getPhysicsFrameCount()]).toEqual(before);
  }, async () => compileArcMotion(spec, 17, options));
  expect(observations).toBeGreaterThan(0);
  expect(actual.track).toEqual(baseline.track);
  expect(actual.stats.sim_frames).toBe(baseline.stats.sim_frames);
});

it('removes failed study observers and rejects overlapping installations', async () => {
  let calls = 0;
  await expect(withSequenceObserver(() => {calls++; throw new Error('observer failed');}, async () => {
    await expect(withSequenceObserver(() => {}, async () => 0)).rejects.toThrow('study is already active');
    return compileArcMotion(spec, 17, options);
  })).rejects.toThrow('observer failed');
  expect(calls).toBe(1);
  compileArcMotion(spec, 17, options);
  expect(calls).toBe(1);
  await withSequenceObserver(() => {calls++;}, async () => compileArcMotion(spec, 17, options));
  expect(calls).toBeGreaterThan(1);
});

it('restores caller limits on success and failure, and restores probe accounting after interruption', () => {
  const engine = new Engine();
  resetFrameCount(); setPhysicsFrameLimit(5);
  getRiderMetered(engine, 2);
  const before = [getFrameCount(), getPhysicsFrameCount()];
  expect(() => withPhysicsFrameProbe(() => {
    getRiderMetered(engine, 4);
    getRiderMetered(engine, 8); // a real hard-budget interruption
  })).toThrow('budget hard limit');
  expect([getFrameCount(), getPhysicsFrameCount()]).toEqual(before);
  for (const fail of [false, true]) {
    try { withPhysicsFrameSession(() => {setPhysicsFrameLimit(100); if (fail) throw new Error('session failed');}); }
    catch (error) {expect(String(error)).toContain('session failed');}
    expect(() => getRiderMetered(engine, 8)).toThrow('budget hard limit');
  }
  expect(() => withPhysicsFrameProbe(() => {setPhysicsFrameLimit(100); throw new Error('probe failed');})).toThrow('probe failed');
  expect(() => getRiderMetered(engine, 8)).toThrow('budget hard limit');
  expect(() => withPhysicsFrameSession((() => Promise.resolve()) as any)).toThrow('synchronous');
  expect(withPhysicsFrameSession(() => 42)).toBe(42);
});
