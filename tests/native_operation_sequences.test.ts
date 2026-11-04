import {expect, it} from 'vitest';
import {LineRiderEngine as Native, disposeEngines} from '../scripts/lib/native_motion/engine.ts';
import {getRiderMetered, getPhysicsFrameCount, resetFrameCount, setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
import {makeRng} from '../scripts/lib/rng.ts';

const core: any = await import('lr-core/line-rider-engine/index.js');
const Reference = typeof core.default === 'function' ? core.default : core.default.default;
const line = core.createLineFromJson ?? core.default.createLineFromJson;
type Geometry = {id: number; type: number; x1: number; y1: number; x2: number; y2: number; leftExtended?: boolean; rightExtended?: boolean};
type Version = {native: Native; lines: Geometry[]; position: {x: number; y: number}; velocity: {x: number; y: number}};
function reference(v: Omit<Version, 'native'>) {
  let e = new Reference().setStart(v.position, v.velocity);
  for (const l of v.lines) e = e.addLine(line(l));
  return e;
}

it.each([1, 7, 41, 307, 20261104])('matches independent JS physics through seeded ownership and cache operations (seed %i)', seed => {
  const rng = makeRng(seed), pick = (n: number) => Math.floor(rng() * n);
  const start = {position: {x: 0, y: -15}, velocity: {x: 4, y: 0},
    lines: [{id: 1, type: 0, x1: -80, y1: 10, x2: 700, y2: 10}]};
  const versions: Version[] = [{...start, native: new Native().setStart(start.position, start.velocity).addLine(start.lines)}];
  const events = (e: any, frame: number) => e.getUpdatesAtFrame(frame).filter((u: any) => u.type === 'CollisionUpdate')
    .map((u: any) => [u.id, u.updated.map((p: any) => p.id)]);
  const history: string[] = [];
  let id = 2;
  resetFrameCount(); setPhysicsFrameLimit(null);
  try {
    for (let step = 0; step < 100; step++) {
      const index = pick(versions.length), v = versions[index], operation = step % 7;
      history.push(`${operation}:${index}`);
      const context = `seed=${seed} step=${step} operations=${history.join(',')}`;
      if (operation === 0) {
        const y = pick(55) - 15;
        const l = {id: id++, type: pick(2), x1: -40 + pick(40), y1: y, x2: 250 + pick(150), y2: y + pick(50) - 25,
          leftExtended: !!pick(2), rightExtended: !!pick(2)};
        versions.push({...v, lines: [...v.lines, l], native: v.native.addLine(l)});
      } else if (operation === 1) {
        // Detached snapshots stay in the same operation pool as their source.
        versions.push({...v, native: v.native.detach()});
      } else if (operation === 2) {
        const position = {x: pick(50) - 25, y: -15 - pick(40)}, velocity = {x: pick(7) - 2, y: pick(3) - 1};
        versions.push({...v, position, velocity, native: v.native.setStart(position, velocity)});
      } else if (operation === 3) {
        const frame = 5 + pick(85);
        getRiderMetered(v.native, frame);
        // Reconstruct the reference from declared geometry at each observation.
        // lr-core has no detach API, and its shared computed cache can retain
        // stale geometry after a branch/reset switch; it is not a cache oracle.
        const oracle = reference(v);
        const actual = v.native.getStateMapAtFrame(frame), expected = oracle.getStateMapAtFrame(frame);
        for (const [key, state] of actual)
          expect(JSON.stringify(state.__state__), `${context} ${key}`).toBe(JSON.stringify(expected.get(key).__state__));
        expect(events(v.native, frame), context).toEqual(events(oracle, frame));
        const charged = getPhysicsFrameCount(), saved = v.native.getCachedRawFrames(0, frame);
        v.native.readCachedMotionWindow(0, frame, values => {expect(values.length, context).toBe((frame + 1) * 5);});
        expect(v.native.getCachedRawFrames(0, frame), context).toEqual(saved);
        expect(getPhysicsFrameCount(), context).toBe(charged);
      } else if (operation === 4) {
        const before = v.native.getLastFrameIndex(), charged = getPhysicsFrameCount();
        setPhysicsFrameLimit(charged + 3);
        expect(() => getRiderMetered(v.native, before + 10), context).toThrow('budget hard limit');
        expect(v.native.getLastFrameIndex(), context).toBe(before);
        expect(getPhysicsFrameCount(), context).toBe(charged);
        setPhysicsFrameLimit(null);
      } else if (operation === 5 && versions.length > 1) {
        v.native.dispose(); versions.splice(index, 1);
        expect(() => v.native.getRider(0), context).toThrow('disposed');
      } else {
        const last = v.native.getLastFrameIndex();
        expect(() => v.native.getCachedRawFrames(0, last + 1), context).toThrow('already simulated');
        expect(v.native.getLastFrameIndex(), context).toBe(last);
      }
      if (versions.length > 8) versions.shift()!.native.dispose();
      Native.retainOnly(versions.map(v => v.native));
    }
  } finally {setPhysicsFrameLimit(null); disposeEngines();}
});
