import {afterEach, expect, it} from 'vitest';
import {LineRiderEngine as Engine, disposeEngines, withEngineScope} from '../scripts/lib/native_motion/engine.ts';
import {getRiderMetered, getPhysicsFrameCount, resetFrameCount, setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
import {wasm, views} from '../scripts/lib/native_motion/wasm.ts';

afterEach(() => { disposeEngines(); setPhysicsFrameLimit(null); });

it('gives an empty batch its existing owner and releases a handle only once', () => {
  expect(() => {
    // @ts-expect-error callers cannot adopt an arbitrary native handle
    new Engine(0);
  }).toThrow('native handles can only be adopted by engine operations');
  const base = new Engine();
  const same = base.addLine([]);
  expect(same).toBe(base);
  Engine.retainOnly([same]);
  expect(base.getLastFrameIndex()).toBe(0);
  base.dispose();
  const replacement = new Engine(); // the native slot is now reusable
  same.dispose();
  expect(replacement.getLastFrameIndex()).toBe(0);
  expect(() => base.getRider(0)).toThrow('disposed');
  expect(() => base.getUpdatesAtFrame(0)).toThrow('disposed');
  expect(() => base.addLine([])).toThrow('disposed');
  expect(() => Engine.retainOnly([base])).toThrow('disposed');
  expect(replacement.getLastFrameIndex()).toBe(0);
});

it('rejects escaped scoped engines and async scope callbacks', () => {
  const caller = new Engine();
  const escaped = withEngineScope(() => new Engine());
  expect(() => escaped.getLastFrameIndex()).toThrow('disposed');
  // Runtime guard also covers untyped callers. The TS signature rejects this callback.
  expect(() => {
    // @ts-expect-error asynchronous callbacks cannot keep scoped engines alive
    withEngineScope(() => Promise.resolve());
  }).toThrow('synchronous');
  expect(caller.getLastFrameIndex()).toBe(0);
});

it('keeps interleaved observations with their version and exposes pending replay work', () => {
  const base = new Engine();
  const sibling = base.addLine({id: 1, x1: 10000, y1: 10000, x2: 11000, y2: 10000});
  const other = new Engine().setStart({x: 100, y: 50}, {x: 2, y: 1});
  for (const e of [base, sibling, other]) e.prepareCollisionTrace(4);
  resetFrameCount(); setPhysicsFrameLimit(null);
  getRiderMetered(base, 4);
  const expected = base.readCollisionTrace();
  expect(() => sibling.readCollisionTrace()).toThrow('incomplete');
  expect(() => other.readCollisionTrace()).toThrow('incomplete');
  expect(getPhysicsFrameCount()).toBe(4);
  getRiderMetered(sibling, 4);
  expect(getPhysicsFrameCount()).toBe(5); // sibling replay was evicted before accounting
  expect(sibling.readCollisionTrace()).toEqual(expected);
  getRiderMetered(other, 4);
  expect(other.readCollisionTrace()).not.toEqual(expected);
  expect(base.readCollisionTrace()).toEqual(expected);
  const detached = base.detach();
  expect(() => detached.readCollisionTrace()).toThrow('incomplete');
  const child = base.addLine({id: 2, x1: 12000, y1: 10000, x2: 13000, y2: 10000});
  expect(() => child.readCollisionTrace()).toThrow('incomplete');
  expect(base.readCollisionTrace()).toEqual(expected);
  base.prepareCollisionTrace(6);
  expect(() => base.readCollisionTrace()).toThrow('incomplete');
  getRiderMetered(base, 6);
  expect(base.readCollisionTrace()).not.toEqual(expected);
  expect(sibling.readCollisionTrace()).toEqual(expected);
});

it('refreshes every fixed view after memory growth and returns owned contact snapshots', () => {
  const base = new Engine().setStart({x: 0, y: -15}, {x: 4, y: 0})
    .addLine({id: 1, x1: -50, y1: 10, x2: 400, y2: 10});
  base.getRider(40);
  const contacts = base.getCachedContactPositions(0, 40), before = [...contacts];
  expect(contacts.length).toBeGreaterThan(0);
  const previous = views();
  wasm.memory.grow(1);
  const current = views();
  expect(current === previous).toBe(false);
  expect(previous.scratch.byteLength).toBe(0);
  for (const view of Object.values(current)) expect(view.buffer).toBe(wasm.memory.buffer);
  expect(current.scratch.length).toBe(84);
  base.getRider(50);
  base.getCachedContactPositions(0, 0);
  expect([...contacts]).toEqual(before);
  const window = base.getCandidateWindow(0, 50)!;
  expect(window.frames).toBe(51);
  const saved = [...window.data.slice(0, 51 * 9)];
  const savedContacts = [...window.contacts.slice(0, window.contactCount)];
  expect(savedContacts.length).toBeGreaterThan(0);
  base.getUpdatesAtFrame(40); // event reads no longer overwrite window contacts
  expect([...window.data.slice(0, 51 * 9)]).toEqual(saved);
  expect([...window.contacts.slice(0, window.contactCount)]).toEqual(savedContacts);
});

it('rejects invalid frame reads and prevents observations from simulating', () => {
  const engine = new Engine();
  for (const frame of [-1, 0.5, NaN, Infinity, 0x80000000]) {
    expect(() => engine.getRider(frame)).toThrow('frame');
    expect(() => engine.getStateMapAtFrame(frame)).toThrow('frame');
    expect(() => engine.getUpdatesAtFrame(frame)).toThrow('frame');
  }
  expect(() => engine.bodyMotionAt(4)).toThrow('already simulated');
  expect(() => engine.hasContactAtFrame(4)).toThrow('already simulated');
  expect(() => engine.getAllContactLineIdsAtFrame(4)).toThrow('already simulated');
  expect(engine.getLastFrameIndex()).toBe(0);
  engine.getRider(4);
  expect(engine.bodyMotionAt(4).R).toBeGreaterThan(0);
  expect(engine.hasContactAtFrame(4)).toBe(false);
  const motion = engine.bodyMotionAt(4);
  const sibling = engine.setStart({x: 100, y: 50}, {x: 2, y: 1});
  sibling.getRider(4);
  expect(sibling.bodyMotionAt(4)).not.toEqual(motion);
  expect(() => engine.bodyMotionAt(4)).toThrow('already simulated');
  expect(engine.getLastFrameIndex()).toBe(0); // reconciliation must not simulate
  engine.getRider(4);
  expect(engine.bodyMotionAt(4)).toEqual(motion);
  const detached = engine.detach();
  engine.dispose();
  expect(detached.bodyMotionAt(4)).toEqual(motion);
});

it('sizes candidate output to the requested window instead of the retired batch limit', () => {
  const engine = new Engine(), end = 16_385;
  const window = engine.getCandidateWindow(0, end)!;
  expect(window.frames).toBe(end + 1);
  expect(window.data.length).toBeGreaterThanOrEqual((end + 1) * 9);
  const tail = [...window.data.slice(end * 9, end * 9 + 6)];
  const rider = engine.getRider(end);
  expect(tail).toEqual([rider.position.x, rider.position.y, rider.velocity.x, rider.velocity.y,
    rider.get('RIDER_MOUNTED').framesSinceUnbind, rider.get('SLED_INTACT').framesSinceUnbind]);
  const small = engine.getCandidateWindow(0, 2)!;
  expect(small.frames).toBe(3);
  const shifted=engine.getCandidateWindow(end-1,end)!;
  const previous=engine.getRider(end-1);
  expect([...shifted.data.slice(0,2)]).toEqual([previous.position.x,previous.position.y]);
  expect(engine.getLastFrameIndex()).toBe(end);
});
